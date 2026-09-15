import {
  MAX_COUNT,
  MAX_SIDES,
  bounds,
  formatNotation,
  parseNotation,
  roll,
} from '../notation';

const rng = (seed: number) => {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
};

describe('parseNotation', () => {
  it.each([
    ['2d6', { count: 2, sides: 6, modifier: 0 }],
    ['d20', { count: 1, sides: 20, modifier: 0 }],
    ['4d8+3', { count: 4, sides: 8, modifier: 3 }],
    ['3d6-1', { count: 3, sides: 6, modifier: -1 }],
    ['1D100', { count: 1, sides: 100, modifier: 0 }],
    ['  2 d 6 + 3  ', { count: 2, sides: 6, modifier: 3 }],
  ])('reads %p', (text, expected) => {
    expect(parseNotation(text)).toEqual(expected);
  });

  it.each(['', 'abc', '2x6', 'd', '2d', 'd1', '0d6', '2d6+', '2d6++1', '2.5d6'])(
    'refuses %p rather than guessing',
    (text) => {
      expect(parseNotation(text)).toBeNull();
    },
  );

  it('refuses a die with fewer than two sides', () => {
    expect(parseNotation('1d1')).toBeNull();
    expect(parseNotation('1d2')).not.toBeNull();
  });

  it('refuses counts and sides beyond what can be shown', () => {
    expect(parseNotation(`${MAX_COUNT}d6`)).not.toBeNull();
    expect(parseNotation(`${MAX_COUNT + 1}d6`)).toBeNull();
    expect(parseNotation(`1d${MAX_SIDES}`)).not.toBeNull();
    expect(parseNotation(`1d${MAX_SIDES + 1}`)).toBeNull();
  });
});

describe('formatNotation', () => {
  it.each([
    [{ count: 2, sides: 6, modifier: 0 }, '2d6'],
    [{ count: 4, sides: 8, modifier: 3 }, '4d8+3'],
    [{ count: 3, sides: 6, modifier: -1 }, '3d6-1'],
  ])('renders %p as %p', (notation, expected) => {
    expect(formatNotation(notation)).toBe(expected);
  });

  it('round-trips through the parser', () => {
    for (const text of ['2d6', '4d8+3', '3d6-1', '1d20']) {
      expect(formatNotation(parseNotation(text)!)).toBe(text);
    }
  });

  it('normalises spacing and case, so one preset is stored one way', () => {
    expect(formatNotation(parseNotation('  2 D 6 + 3 ')!)).toBe('2d6+3');
  });
});

describe('roll', () => {
  const n = (text: string) => parseNotation(text)!;

  it('rolls the right number of dice', () => {
    expect(roll(n('4d8'), rng(1)).dice).toHaveLength(4);
  });

  it('adds the modifier to the total but not the subtotal', () => {
    const result = roll(n('2d6+3'), () => 0.5);
    expect(result.total).toBe(result.subtotal + 3);
  });

  it('subtracts a negative modifier', () => {
    const result = roll(n('2d6-1'), () => 0.5);
    expect(result.total).toBe(result.subtotal - 1);
  });

  it('never rolls outside 1..sides', () => {
    const generator = rng(99);
    for (let i = 0; i < 2000; i += 1) {
      for (const face of roll(n('5d20'), generator).dice) {
        expect(face).toBeGreaterThanOrEqual(1);
        expect(face).toBeLessThanOrEqual(20);
      }
    }
  });

  it('can roll the minimum and the maximum', () => {
    expect(roll(n('2d6'), () => 0).dice).toEqual([1, 1]);
    expect(roll(n('2d6'), () => 0.9999999).dice).toEqual([6, 6]);
  });

  it('is uniform across faces', () => {
    const counts = new Array(7).fill(0);
    const generator = rng(2024);
    for (let i = 0; i < 60000; i += 1) counts[roll(n('1d6'), generator).dice[0]!]! += 1;
    for (let face = 1; face <= 6; face += 1) {
      expect(counts[face]).toBeGreaterThan(9000);
      expect(counts[face]).toBeLessThan(11000);
    }
  });
});

describe('bounds', () => {
  it('is the lowest and highest the notation can produce', () => {
    expect(bounds(parseNotation('2d6+3')!)).toEqual({ min: 5, max: 15 });
  });

  it('accounts for a negative modifier', () => {
    expect(bounds(parseNotation('3d6-2')!)).toEqual({ min: 1, max: 16 });
  });

  it('agrees with what rolling actually produces', () => {
    const notation = parseNotation('4d10+2')!;
    const { min, max } = bounds(notation);
    const generator = rng(7);
    for (let i = 0; i < 3000; i += 1) {
      const { total } = roll(notation, generator);
      expect(total).toBeGreaterThanOrEqual(min);
      expect(total).toBeLessThanOrEqual(max);
    }
  });
});
