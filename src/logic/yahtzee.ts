/**
 * Yahtzee scoring. Pure, and written from the published rules rather than from memory, because
 * every one of these categories has a common mis-implementation that looks right in casual play.
 *
 * The scorer never *chooses* a category — it reports what each would score for a given hand and
 * lets the player decide. A scorer that auto-picked "the best" would quietly remove the actual
 * game, which is deciding what to sacrifice.
 */

export type UpperCategory = 'ones' | 'twos' | 'threes' | 'fours' | 'fives' | 'sixes';
export type LowerCategory =
  | 'threeOfAKind' | 'fourOfAKind' | 'fullHouse'
  | 'smallStraight' | 'largeStraight' | 'yahtzee' | 'chance';
export type Category = UpperCategory | LowerCategory;

export const UPPER_CATEGORIES: UpperCategory[] = ['ones', 'twos', 'threes', 'fours', 'fives', 'sixes'];
export const LOWER_CATEGORIES: LowerCategory[] = [
  'threeOfAKind', 'fourOfAKind', 'fullHouse', 'smallStraight', 'largeStraight', 'yahtzee', 'chance',
];
export const ALL_CATEGORIES: Category[] = [...UPPER_CATEGORIES, ...LOWER_CATEGORIES];

/** The upper-section bonus, and the subtotal that earns it. */
export const UPPER_BONUS = 35;
export const UPPER_BONUS_THRESHOLD = 63;

const FACE_OF: Record<UpperCategory, number> = {
  ones: 1, twos: 2, threes: 3, fours: 4, fives: 5, sixes: 6,
};

/** How many of each face, indexed 1..6. */
function tally(dice: readonly number[]): number[] {
  const counts = new Array(7).fill(0);
  for (const die of dice) {
    if (Number.isInteger(die) && die >= 1 && die <= 6) counts[die] += 1;
  }
  return counts;
}

const hasRun = (counts: readonly number[], length: number): boolean => {
  let run = 0;
  for (let face = 1; face <= 6; face += 1) {
    run = counts[face]! > 0 ? run + 1 : 0;
    if (run >= length) return true;
  }
  return false;
};

/**
 * What `category` scores for `dice`. Always a number; a hand that does not qualify scores zero,
 * which is a real and often deliberate move in Yahtzee rather than an error.
 */
export function scoreFor(category: Category, dice: readonly number[]): number {
  const counts = tally(dice);
  const sum = dice.reduce((a, b) => (Number.isInteger(b) && b >= 1 && b <= 6 ? a + b : a), 0);

  if (UPPER_CATEGORIES.includes(category as UpperCategory)) {
    const face = FACE_OF[category as UpperCategory];
    return counts[face]! * face;
  }

  switch (category as LowerCategory) {
    case 'threeOfAKind':
      // Scores the SUM OF ALL FIVE DICE, not three times the face. The commonest mistake.
      return counts.some((c) => c >= 3) ? sum : 0;
    case 'fourOfAKind':
      return counts.some((c) => c >= 4) ? sum : 0;
    case 'fullHouse':
      // Five of a kind is a full house under standard rules: it is three of one and two of the
      // same one. Requiring two DIFFERENT faces scores a Yahtzee as zero here, which is wrong.
      return counts.some((c) => c === 5) || (counts.some((c) => c === 3) && counts.some((c) => c === 2))
        ? 25
        : 0;
    case 'smallStraight':
      return hasRun(counts, 4) ? 30 : 0;
    case 'largeStraight':
      return hasRun(counts, 5) ? 40 : 0;
    case 'yahtzee':
      return counts.some((c) => c === 5) ? 50 : 0;
    case 'chance':
      return sum;
  }
}

/** What every category would score, for showing the player their options. */
export function scoreAll(dice: readonly number[]): Record<Category, number> {
  return Object.fromEntries(ALL_CATEGORIES.map((c) => [c, scoreFor(c, dice)])) as Record<Category, number>;
}

export type Scorecard = Partial<Record<Category, number>>;

export interface Totals {
  upper: number;
  bonus: number;
  lower: number;
  grand: number;
  /** Categories still to fill. Zero means the game is over. */
  remaining: number;
}

export function totals(card: Scorecard): Totals {
  const upper = UPPER_CATEGORIES.reduce((sum, c) => sum + (card[c] ?? 0), 0);
  const bonus = upper >= UPPER_BONUS_THRESHOLD ? UPPER_BONUS : 0;
  const lower = LOWER_CATEGORIES.reduce((sum, c) => sum + (card[c] ?? 0), 0);
  const filled = ALL_CATEGORIES.filter((c) => card[c] !== undefined).length;
  return { upper, bonus, lower, grand: upper + bonus + lower, remaining: ALL_CATEGORIES.length - filled };
}

/** How much more the upper section needs for the bonus. Zero once it is earned. */
export function upperBonusGap(card: Scorecard): number {
  const { upper } = totals(card);
  return Math.max(0, UPPER_BONUS_THRESHOLD - upper);
}
