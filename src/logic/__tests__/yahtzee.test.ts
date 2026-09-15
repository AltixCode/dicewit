import {
  ALL_CATEGORIES,
  UPPER_BONUS,
  UPPER_BONUS_THRESHOLD,
  scoreAll,
  scoreFor,
  totals,
  upperBonusGap,
  type Scorecard,
} from '../yahtzee';

describe('the upper section', () => {
  it('counts only its own face', () => {
    expect(scoreFor('threes', [3, 3, 3, 1, 2])).toBe(9);
    expect(scoreFor('sixes', [3, 3, 3, 1, 2])).toBe(0);
  });

  it('scores zero for a hand with none of that face', () => {
    expect(scoreFor('ones', [2, 3, 4, 5, 6])).toBe(0);
  });
});

describe('three and four of a kind', () => {
  it('scores the SUM OF ALL FIVE DICE, not three times the face', () => {
    // The commonest mis-implementation would give 9 here.
    expect(scoreFor('threeOfAKind', [3, 3, 3, 5, 6])).toBe(20);
  });

  it('scores zero without enough matching dice', () => {
    expect(scoreFor('threeOfAKind', [3, 3, 2, 5, 6])).toBe(0);
    expect(scoreFor('fourOfAKind', [3, 3, 3, 5, 6])).toBe(0);
  });

  it('counts five of a kind as satisfying both', () => {
    expect(scoreFor('threeOfAKind', [4, 4, 4, 4, 4])).toBe(20);
    expect(scoreFor('fourOfAKind', [4, 4, 4, 4, 4])).toBe(20);
  });
});

describe('full house', () => {
  it('is 25 for three of one and two of another', () => {
    expect(scoreFor('fullHouse', [2, 2, 2, 5, 5])).toBe(25);
  });

  it('counts five of a kind as a full house, which the strict reading misses', () => {
    expect(scoreFor('fullHouse', [4, 4, 4, 4, 4])).toBe(25);
  });

  it('is zero for two pairs or four of a kind', () => {
    expect(scoreFor('fullHouse', [2, 2, 5, 5, 6])).toBe(0);
    expect(scoreFor('fullHouse', [2, 2, 2, 2, 6])).toBe(0);
  });
});

describe('straights', () => {
  it('a small straight is any run of four, wherever it sits', () => {
    expect(scoreFor('smallStraight', [1, 2, 3, 4, 6])).toBe(30);
    expect(scoreFor('smallStraight', [2, 3, 4, 5, 5])).toBe(30);
    expect(scoreFor('smallStraight', [3, 4, 5, 6, 6])).toBe(30);
  });

  it('ignores a duplicate that would break a naive sort-and-compare', () => {
    expect(scoreFor('smallStraight', [1, 2, 2, 3, 4])).toBe(30);
  });

  it('is zero without four in a row', () => {
    expect(scoreFor('smallStraight', [1, 2, 3, 5, 6])).toBe(0);
  });

  it('a large straight is all five in a row', () => {
    expect(scoreFor('largeStraight', [1, 2, 3, 4, 5])).toBe(40);
    expect(scoreFor('largeStraight', [2, 3, 4, 5, 6])).toBe(40);
  });

  it('a small straight is not a large one', () => {
    expect(scoreFor('largeStraight', [1, 2, 3, 4, 6])).toBe(0);
  });

  it('a large straight also satisfies the small', () => {
    expect(scoreFor('smallStraight', [1, 2, 3, 4, 5])).toBe(30);
  });
});

describe('yahtzee and chance', () => {
  it('a yahtzee is 50', () => {
    expect(scoreFor('yahtzee', [6, 6, 6, 6, 6])).toBe(50);
  });

  it('four of a kind is not a yahtzee', () => {
    expect(scoreFor('yahtzee', [6, 6, 6, 6, 1])).toBe(0);
  });

  it('chance is always the sum', () => {
    expect(scoreFor('chance', [1, 2, 3, 4, 5])).toBe(15);
  });
});

describe('robustness', () => {
  it('ignores a die outside 1..6 rather than scoring it', () => {
    expect(scoreFor('chance', [1, 2, 3, 4, 99])).toBe(10);
    expect(scoreFor('sixes', [6, 6, 0, -1, 7])).toBe(12);
  });

  it('handles an empty hand', () => {
    for (const category of ALL_CATEGORIES) {
      expect(scoreFor(category, [])).toBe(0);
    }
  });

  it('scoreAll reports every category', () => {
    const all = scoreAll([1, 2, 3, 4, 5]);
    expect(Object.keys(all).sort()).toEqual([...ALL_CATEGORIES].sort());
    expect(all.largeStraight).toBe(40);
    expect(all.chance).toBe(15);
  });
});

describe('totals and the upper bonus', () => {
  it('sums both sections', () => {
    const card: Scorecard = { ones: 3, sixes: 24, yahtzee: 50, chance: 20 };
    const result = totals(card);
    expect(result.upper).toBe(27);
    expect(result.lower).toBe(70);
    expect(result.grand).toBe(97);
  });

  it('awards the bonus at exactly the threshold, not above it', () => {
    const card: Scorecard = { ones: 3, twos: 6, threes: 9, fours: 12, fives: 15, sixes: 18 };
    expect(totals(card).upper).toBe(63);
    expect(totals(card).bonus).toBe(UPPER_BONUS);
  });

  it('withholds the bonus one point short', () => {
    const card: Scorecard = { ones: 3, twos: 6, threes: 9, fours: 12, fives: 15, sixes: 17 };
    expect(totals(card).upper).toBe(62);
    expect(totals(card).bonus).toBe(0);
  });

  it('counts what is left to fill', () => {
    expect(totals({}).remaining).toBe(ALL_CATEGORIES.length);
    expect(totals({ ones: 0 }).remaining).toBe(ALL_CATEGORIES.length - 1);
  });

  it('treats a deliberate zero as filled, because taking a zero is a real move', () => {
    expect(totals({ yahtzee: 0 }).remaining).toBe(ALL_CATEGORIES.length - 1);
  });
});

describe('upperBonusGap', () => {
  it('reports how much more is needed', () => {
    expect(upperBonusGap({ ones: 3 })).toBe(UPPER_BONUS_THRESHOLD - 3);
  });

  it('is zero once the bonus is earned', () => {
    expect(upperBonusGap({ sixes: 30, fives: 25, fours: 12 })).toBe(0);
  });
});
