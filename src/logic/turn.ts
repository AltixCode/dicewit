/**
 * One Yahtzee turn: five dice, three rolls, and whichever dice the player keeps between them.
 *
 * Pure and dependency-free with the random source injected, like the rest of `src/logic/`, so
 * fairness and the hold rule are both testable from `npm test` alone.
 *
 * The turn is modelled as a **value**, not as a mutable object. Every function returns a new
 * `Turn`, which is what lets the store treat a turn as a single piece of state and makes an
 * illegal fourth roll a no-op rather than a mutation that already happened.
 */

export interface Turn {
  /** Each die's face. Zero means "not yet rolled" and is never shown as a face. */
  dice: number[];
  /** Which dice the player is keeping through the next roll. */
  held: boolean[];
  /** Rolls already spent this turn, 0 through `ROLLS_PER_TURN`. */
  rollsUsed: number;
}

type Rng = () => number;

export const DICE_PER_TURN = 5;
export const ROLLS_PER_TURN = 3;

/** A turn before anything has been rolled. */
export function freshTurn(): Turn {
  return {
    dice: new Array(DICE_PER_TURN).fill(0),
    held: new Array(DICE_PER_TURN).fill(false),
    rollsUsed: 0,
  };
}

function face(rng: Rng): number {
  // Math.floor over [0, 1) gives 0..5; the clamp guards a supplied generator that returns
  // exactly 1, which would otherwise produce a seven.
  return Math.min(6, Math.floor(rng() * 6) + 1);
}

/**
 * Rolls every die the player is not holding.
 *
 * Returns the turn unchanged once all three rolls are spent. Refusing here rather than in the
 * UI means no screen can accidentally grant a fourth roll.
 */
export function rollTurn(turn: Turn, rng: Rng = Math.random): Turn {
  if (turn.rollsUsed >= ROLLS_PER_TURN) return turn;
  return {
    dice: turn.dice.map((value, i) => (turn.held[i] ? value : face(rng))),
    held: [...turn.held],
    rollsUsed: turn.rollsUsed + 1,
  };
}

/**
 * Keeps or releases one die.
 *
 * Holding before the first roll is refused: there is no face to keep, and allowing it would
 * let a player freeze a zero into the hand.
 */
export function toggleHold(turn: Turn, index: number): Turn {
  if (turn.rollsUsed === 0) return turn;
  if (!Number.isInteger(index) || index < 0 || index >= DICE_PER_TURN)
    return turn;
  return {
    ...turn,
    dice: [...turn.dice],
    held: turn.held.map((h, i) => (i === index ? !h : h)),
  };
}

/** Every roll spent — the player must now choose a category. */
export function isTurnOver(turn: Turn): boolean {
  return turn.rollsUsed >= ROLLS_PER_TURN;
}

/** A category may be banked once there is a real hand to bank, which is after any roll. */
export function canScore(turn: Turn): boolean {
  return turn.rollsUsed > 0;
}
