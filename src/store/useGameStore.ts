/**
 * One game of the scorecard: the turn in hand, the categories already banked, and the best
 * grand total this device has seen.
 *
 * All the arithmetic is in `src/logic/yahtzee.ts` and all the turn rules in
 * `src/logic/turn.ts`. This store only sequences them and persists the result, so the scoring
 * traps — three of a kind scores all five dice, five of a kind is a full house — stay testable
 * without mounting a screen.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

import {
  type Turn,
  canScore,
  freshTurn,
  rollTurn,
  toggleHold,
} from "@/logic/turn";
import {
  ALL_CATEGORIES,
  type Category,
  type Scorecard,
  type Totals,
  scoreFor,
  totals as totalsOf,
} from "@/logic/yahtzee";

export const GAME_CACHE_KEY = "dicewit.game.v1";

type Rng = () => number;

interface GameState {
  turn: Turn;
  card: Scorecard;
  /** Best grand total completed on this device. Local only — there is no account. */
  best: number;

  roll: (rng?: Rng) => "rolled" | "no-rolls-left";
  hold: (index: number) => void;
  score: (category: Category) => "scored" | "already-used" | "no-roll";
  isUsed: (category: Category) => boolean;
  remaining: () => Category[];
  isComplete: () => boolean;
  totals: () => Totals;
  newGame: () => void;
  persist: () => Promise<void>;
  hydrate: () => Promise<void>;
}

/**
 * A stored card is only trusted when every key is a real category and every value a number.
 *
 * A bad entry here would not crash so much as quietly corrupt a game — a category that can
 * never be filled, or a total that does not add up — which is worse than starting fresh.
 */
function validCard(value: unknown): Scorecard {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Scorecard = {};
  for (const [key, score] of Object.entries(value as Record<string, unknown>)) {
    if (!ALL_CATEGORIES.includes(key as Category)) continue;
    if (typeof score !== "number" || !Number.isFinite(score) || score < 0)
      continue;
    out[key as Category] = score;
  }
  return out;
}

export const useGameStore = create<GameState>((set, get) => ({
  turn: freshTurn(),
  card: {},
  best: 0,

  roll(rng = Math.random) {
    const next = rollTurn(get().turn, rng);
    // rollTurn returns the same turn when the rolls are spent; say so rather than pretending.
    if (next === get().turn) return "no-rolls-left";
    set({ turn: next });
    return "rolled";
  },

  hold(index) {
    set((s) => ({ turn: toggleHold(s.turn, index) }));
  },

  score(category) {
    const { turn, card } = get();
    if (!canScore(turn)) return "no-roll";
    // `undefined` rather than falsy: a banked zero is a real, often forced, move and must not
    // read as an empty category.
    if (card[category] !== undefined) return "already-used";

    const next: Scorecard = {
      ...card,
      [category]: scoreFor(category, turn.dice),
    };
    const complete = totalsOf(next).remaining === 0;
    const grand = totalsOf(next).grand;
    set((s) => ({
      card: next,
      turn: freshTurn(),
      best: complete ? Math.max(s.best, grand) : s.best,
    }));
    void get().persist();
    return "scored";
  },

  isUsed(category) {
    return get().card[category] !== undefined;
  },

  remaining() {
    const { card } = get();
    return ALL_CATEGORIES.filter((c) => card[c] === undefined);
  },

  isComplete() {
    return totalsOf(get().card).remaining === 0;
  },

  totals() {
    return totalsOf(get().card);
  },

  newGame() {
    set({ turn: freshTurn(), card: {} });
    void get().persist();
  },

  async persist() {
    const { card, best } = get();
    try {
      await AsyncStorage.setItem(
        GAME_CACHE_KEY,
        JSON.stringify({ card, best }),
      );
    } catch {
      // Losing one game's progress is survivable; failing to start is not.
    }
  },

  async hydrate() {
    try {
      const raw = await AsyncStorage.getItem(GAME_CACHE_KEY);
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return;
      const record = parsed as Record<string, unknown>;
      const best = record.best;
      set({
        card: validCard(record.card),
        best:
          typeof best === "number" && Number.isFinite(best) && best >= 0
            ? best
            : 0,
        // The turn is deliberately not restored: dice in hand from a previous launch would let
        // a player reopen the app to reroll, which is a different game.
        turn: freshTurn(),
      });
    } catch {
      // Unreadable storage starts a new game rather than preventing launch.
    }
  },
}));
