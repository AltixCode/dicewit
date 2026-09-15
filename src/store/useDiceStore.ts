/**
 * Saved roll presets, the roll log, and the dice colour.
 *
 * Every limit here is a promise the paywall makes, so each one is enforced in exactly one
 * place and takes `isPremium` explicitly rather than reaching into another store. That keeps
 * the gate testable without mounting anything and makes the rule visible at the call site.
 *
 * Rolling itself lives in `src/logic/notation.ts`; this store only sequences it and records
 * what came out.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

import {
  type RollResult,
  formatNotation,
  parseNotation,
  roll,
} from "@/logic/notation";

export const DICE_CACHE_KEY = "dicewit.state.v1";

/** Saved presets on the free tier. The paywall sells "unlimited saved roll presets". */
export const FREE_PRESETS = 3;
/** Roll log entries kept on the free tier. The paywall sells the full log and its export. */
export const FREE_HISTORY = 25;

/** The dice palettes. `default` is free; the rest are what "every dice colour" means. */
export const DICE_COLORS = [
  "default",
  "ruby",
  "jade",
  "amber",
  "violet",
] as const;
export type DiceColor = (typeof DICE_COLORS)[number];

export interface Preset {
  id: string;
  label: string;
  notation: string;
}

export interface HistoryEntry {
  id: string;
  /** The notation as rolled, normalised — `d20` is recorded as `1d20`. */
  notation: string;
  dice: number[];
  total: number;
  /** Absolute time, so the log is still truthful after the app has been closed for a week. */
  at: number;
}

type Rng = () => number;

interface DiceState {
  presets: Preset[];
  history: HistoryEntry[];
  diceColor: DiceColor;

  savePreset: (
    label: string,
    notation: string,
    isPremium: boolean,
  ) => "saved" | "invalid" | "limit-reached";
  removePreset: (id: string) => void;
  rollNotation: (text: string, rng?: Rng, isPremium?: boolean) => RollResult | null;
  clearHistory: () => void;
  exportHistory: () => string;
  setDiceColor: (color: DiceColor, isPremium: boolean) => void;
  persist: () => Promise<void>;
  hydrate: () => Promise<void>;
}

let counter = 0;
/** Ids only have to be unique within one device's stored list. */
const nextId = (): string =>
  `${Date.now().toString(36)}-${(counter += 1).toString(36)}`;

/**
 * Trusts nothing that comes back from storage.
 *
 * A shape mismatch here is a crash on launch with no way for the user to recover short of
 * reinstalling, so every field is checked and anything unrecognised is dropped.
 */
function validPresets(value: unknown): Preset[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (p): p is Preset =>
      !!p &&
      typeof p === "object" &&
      typeof (p as Preset).id === "string" &&
      typeof (p as Preset).label === "string" &&
      typeof (p as Preset).notation === "string" &&
      parseNotation((p as Preset).notation) !== null,
  );
}

function validHistory(value: unknown): HistoryEntry[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (h): h is HistoryEntry =>
      !!h &&
      typeof h === "object" &&
      typeof (h as HistoryEntry).id === "string" &&
      typeof (h as HistoryEntry).notation === "string" &&
      Array.isArray((h as HistoryEntry).dice) &&
      typeof (h as HistoryEntry).total === "number" &&
      typeof (h as HistoryEntry).at === "number",
  );
}

function validColor(value: unknown): DiceColor {
  return DICE_COLORS.includes(value as DiceColor)
    ? (value as DiceColor)
    : "default";
}

export const useDiceStore = create<DiceState>((set, get) => ({
  presets: [],
  history: [],
  diceColor: "default",

  savePreset(label, notation, isPremium) {
    const parsed = parseNotation(notation);
    // Refuse before checking the cap: telling a user they are out of slots for something that
    // was never going to roll would be two wrong answers at once.
    if (!parsed) return "invalid";
    if (!isPremium && get().presets.length >= FREE_PRESETS)
      return "limit-reached";

    const trimmed = label.trim();
    const preset: Preset = {
      id: nextId(),
      // An unnamed preset is listed by what it rolls, which is more use than an empty row.
      label: trimmed || formatNotation(parsed),
      notation: formatNotation(parsed),
    };
    set((s) => ({ presets: [...s.presets, preset] }));
    void get().persist();
    return "saved";
  },

  removePreset(id) {
    set((s) => ({ presets: s.presets.filter((p) => p.id !== id) }));
    void get().persist();
  },

  rollNotation(text, rng = Math.random, isPremium = false) {
    const parsed = parseNotation(text);
    if (!parsed) return null;
    const result = roll(parsed, rng);
    const entry: HistoryEntry = {
      id: nextId(),
      notation: formatNotation(parsed),
      dice: result.dice,
      total: result.total,
      at: Date.now(),
    };
    // Newest first. The cap is applied on write rather than on read, so a user whose
    // entitlement has lapsed does not keep a hidden log they can no longer see — but a paying
    // user keeps everything, which is what the paywall means by "full roll history".
    set((s) => {
      const next = [entry, ...s.history];
      return { history: isPremium ? next : next.slice(0, FREE_HISTORY) };
    });
    void get().persist();
    return result;
  },

  clearHistory() {
    set({ history: [] });
    void get().persist();
  },

  exportHistory() {
    return get()
      .history.map((h) => {
        const when = new Date(h.at).toISOString();
        return `${when}  ${h.notation}  [${h.dice.join(", ")}]  = ${h.total}`;
      })
      .join("\n");
  },

  setDiceColor(color, isPremium) {
    if (!DICE_COLORS.includes(color)) return;
    if (!isPremium && color !== "default") return;
    set({ diceColor: color });
    void get().persist();
  },

  async persist() {
    const { presets, history, diceColor } = get();
    try {
      await AsyncStorage.setItem(
        DICE_CACHE_KEY,
        JSON.stringify({ presets, history, diceColor }),
      );
    } catch {
      // A failed write costs this session's log, never the running app.
    }
  },

  async hydrate() {
    try {
      const raw = await AsyncStorage.getItem(DICE_CACHE_KEY);
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return;
      const record = parsed as Record<string, unknown>;
      set({
        presets: validPresets(record.presets),
        history: validHistory(record.history),
        diceColor: validColor(record.diceColor),
      });
    } catch {
      // Corrupt or unreadable storage starts empty rather than preventing launch.
    }
  },
}));
