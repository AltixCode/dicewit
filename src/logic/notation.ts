/**
 * Dice notation — `2d6+3`, `4d8`, `d20`, `3d6-1` — parsed, rolled and scored.
 *
 * Pure and dependency-free, with the random source injected, so every distribution claim is
 * testable. The parser is strict on purpose: a tabletop group will type `2d6+3` and expect
 * exactly that, and a notation parser that quietly reinterprets what it could not read is worse
 * than one that says it did not understand.
 */

export interface Notation {
  /** Number of dice. */
  count: number;
  /** Sides per die. */
  sides: number;
  /** Flat modifier added to the total, positive or negative. */
  modifier: number;
}

export interface RollResult {
  notation: Notation;
  /** Each die's face, in roll order. */
  dice: number[];
  /** Sum of the dice before the modifier. */
  subtotal: number;
  /** Sum plus the modifier. */
  total: number;
}

/** Practical ceilings. Beyond these the UI cannot show the result and nobody is rolling them. */
export const MAX_COUNT = 100;
export const MAX_SIDES = 1000;

const PATTERN = /^\s*(\d*)\s*d\s*(\d+)\s*(?:([+-])\s*(\d+))?\s*$/i;

/**
 * Parses dice notation, or returns null.
 *
 * Null rather than a default: silently reading an unparseable string as `1d6` would roll
 * something the user did not ask for and present it as their result.
 */
export function parseNotation(text: string): Notation | null {
  const match = PATTERN.exec(text);
  if (!match) return null;
  // `d20` with no leading number means one die, which is how everyone writes it.
  const count = match[1] === '' ? 1 : Number(match[1]);
  const sides = Number(match[2]);
  const sign = match[3] === '-' ? -1 : 1;
  const modifier = match[4] === undefined ? 0 : sign * Number(match[4]);

  if (!Number.isInteger(count) || count < 1 || count > MAX_COUNT) return null;
  if (!Number.isInteger(sides) || sides < 2 || sides > MAX_SIDES) return null;
  if (!Number.isInteger(modifier) || Math.abs(modifier) > 10_000) return null;
  return { count, sides, modifier };
}

/** Canonical form, so `  2 D 6 + 3 ` and `2d6+3` are stored and displayed identically. */
export function formatNotation({ count, sides, modifier }: Notation): string {
  const base = `${count}d${sides}`;
  if (modifier === 0) return base;
  return `${base}${modifier > 0 ? '+' : '-'}${Math.abs(modifier)}`;
}

type Rng = () => number;

const unit = (rng: Rng): number => {
  const value = rng();
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(value, 0), 0.9999999999);
};

export function roll(notation: Notation, rng: Rng = Math.random): RollResult {
  const dice = Array.from({ length: notation.count }, () =>
    Math.floor(unit(rng) * notation.sides) + 1,
  );
  const subtotal = dice.reduce((a, b) => a + b, 0);
  return { notation, dice, subtotal, total: subtotal + notation.modifier };
}

/** The lowest and highest a notation can produce. Used to sanity-check and to show a range. */
export function bounds(notation: Notation): { min: number; max: number } {
  return {
    min: notation.count + notation.modifier,
    max: notation.count * notation.sides + notation.modifier,
  };
}
