import {
  DICE_PER_TURN,
  ROLLS_PER_TURN,
  type Turn,
  canScore,
  freshTurn,
  isTurnOver,
  rollTurn,
  toggleHold,
} from "../turn";

/** Deterministic faces, so a claim about holds is about holds and not about luck. */
const facesFrom = (values: number[]) => {
  let i = 0;
  // Math.random() is [0, 1); (v - 1) / sides lands exactly on face v.
  return () => {
    const v = values[i++ % values.length]!;
    return (v - 1) / 6;
  };
};

describe("freshTurn", () => {
  it("starts with five dice and no roll taken", () => {
    const t = freshTurn();
    expect(t.dice).toHaveLength(DICE_PER_TURN);
    expect(t.rollsUsed).toBe(0);
    expect(t.held).toEqual([false, false, false, false, false]);
  });

  it("cannot be scored before anything has been rolled", () => {
    // Scoring an unrolled turn would bank a category against five phantom dice.
    expect(canScore(freshTurn())).toBe(false);
  });
});

describe("rollTurn", () => {
  it("fills every die on the first roll", () => {
    const t = rollTurn(freshTurn(), facesFrom([3]));
    expect(t.dice).toEqual([3, 3, 3, 3, 3]);
    expect(t.rollsUsed).toBe(1);
  });

  it("leaves held dice exactly as they were", () => {
    let t = rollTurn(freshTurn(), facesFrom([6]));
    t = toggleHold(t, 0);
    t = toggleHold(t, 2);
    t = rollTurn(t, facesFrom([1]));
    // Held positions keep their 6; the rest are rerolled to 1.
    expect(t.dice).toEqual([6, 1, 6, 1, 1]);
  });

  it("counts each roll", () => {
    let t = freshTurn();
    for (let i = 1; i <= ROLLS_PER_TURN; i += 1) {
      t = rollTurn(t, facesFrom([2]));
      expect(t.rollsUsed).toBe(i);
    }
  });

  it("refuses a fourth roll rather than silently allowing one", () => {
    let t = freshTurn();
    for (let i = 0; i < ROLLS_PER_TURN; i += 1) t = rollTurn(t, facesFrom([2]));
    const after = rollTurn(t, facesFrom([5]));
    expect(after).toEqual(t);
  });

  it("never produces a face outside 1..6", () => {
    let seed = 99;
    const rng = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    for (let i = 0; i < 2000; i += 1) {
      for (const face of rollTurn(freshTurn(), rng).dice) {
        expect(face).toBeGreaterThanOrEqual(1);
        expect(face).toBeLessThanOrEqual(6);
      }
    }
  });

  it("is fair across the six faces", () => {
    const counts = new Array(7).fill(0);
    let seed = 4;
    const rng = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    for (let i = 0; i < 12000; i += 1)
      for (const f of rollTurn(freshTurn(), rng).dice) counts[f]! += 1;
    // 60 000 dice over six faces: 10 000 each.
    for (let f = 1; f <= 6; f += 1)
      expect(Math.abs(counts[f]! - 10000)).toBeLessThan(500);
  });
});

describe("toggleHold", () => {
  it("does nothing before the first roll — there is nothing to hold", () => {
    const t = freshTurn();
    expect(toggleHold(t, 0).held).toEqual(t.held);
  });

  it("holds and releases the same die", () => {
    const rolled = rollTurn(freshTurn(), facesFrom([4]));
    const held = toggleHold(rolled, 3);
    expect(held.held[3]).toBe(true);
    expect(toggleHold(held, 3).held[3]).toBe(false);
  });

  it("ignores an index outside the hand rather than growing the array", () => {
    const rolled = rollTurn(freshTurn(), facesFrom([4]));
    expect(toggleHold(rolled, 9).held).toHaveLength(DICE_PER_TURN);
    expect(toggleHold(rolled, -1).held).toEqual(rolled.held);
  });
});

describe("isTurnOver", () => {
  it("is true only once every roll has been spent", () => {
    let t: Turn = freshTurn();
    expect(isTurnOver(t)).toBe(false);
    for (let i = 0; i < ROLLS_PER_TURN; i += 1) t = rollTurn(t, facesFrom([2]));
    expect(isTurnOver(t)).toBe(true);
  });
});

describe("canScore", () => {
  it("is true after one roll — a player may bank early", () => {
    expect(canScore(rollTurn(freshTurn(), facesFrom([5])))).toBe(true);
  });
});
