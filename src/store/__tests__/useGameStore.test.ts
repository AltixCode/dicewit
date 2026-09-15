import AsyncStorage from "@react-native-async-storage/async-storage";

import { GAME_CACHE_KEY, useGameStore } from "../useGameStore";
import { ROLLS_PER_TURN } from "@/logic/turn";
import { UPPER_BONUS } from "@/logic/yahtzee";

/** Every die lands on `value`, so a category's score is arithmetic rather than luck. */
const allFaces = (value: number) => () => (value - 1) / 6;

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  useGameStore.getState().newGame();
});

describe("a turn", () => {
  it("starts with no roll taken, so nothing can be scored yet", () => {
    expect(useGameStore.getState().turn.rollsUsed).toBe(0);
    expect(useGameStore.getState().score("ones")).toBe("no-roll");
  });

  it("rolls, holds, and rerolls only what is not held", () => {
    useGameStore.getState().roll(allFaces(5));
    useGameStore.getState().hold(0);
    useGameStore.getState().roll(allFaces(2));
    expect(useGameStore.getState().turn.dice).toEqual([5, 2, 2, 2, 2]);
  });

  it("will not roll a fourth time", () => {
    for (let i = 0; i < ROLLS_PER_TURN; i += 1)
      useGameStore.getState().roll(allFaces(3));
    expect(useGameStore.getState().roll(allFaces(6))).toBe("no-rolls-left");
    expect(useGameStore.getState().turn.dice).toEqual([3, 3, 3, 3, 3]);
  });
});

describe("scoring", () => {
  it("banks the category and starts a fresh turn", () => {
    useGameStore.getState().roll(allFaces(4));
    expect(useGameStore.getState().score("fours")).toBe("scored");
    expect(useGameStore.getState().card.fours).toBe(20);
    expect(useGameStore.getState().turn.rollsUsed).toBe(0);
    expect(useGameStore.getState().turn.held).toEqual([
      false,
      false,
      false,
      false,
      false,
    ]);
  });

  it("refuses a category that is already filled rather than overwriting it", () => {
    useGameStore.getState().roll(allFaces(4));
    useGameStore.getState().score("fours");
    useGameStore.getState().roll(allFaces(1));
    expect(useGameStore.getState().score("fours")).toBe("already-used");
    expect(useGameStore.getState().card.fours).toBe(20);
  });

  it("banks a zero, which is a legal and sometimes necessary move", () => {
    // Five sixes scored as ones is zero — a real choice when everything else is full.
    useGameStore.getState().roll(allFaces(6));
    expect(useGameStore.getState().score("ones")).toBe("scored");
    expect(useGameStore.getState().card.ones).toBe(0);
    // Zero must be distinguishable from "not yet scored", or the category looks free again.
    expect(useGameStore.getState().isUsed("ones")).toBe(true);
  });
});

describe("the upper bonus", () => {
  it("is awarded once the upper section reaches the threshold", () => {
    // Three of each upper face scores 3×n, totalling 63 exactly.
    const faces = [
      ["ones", 1],
      ["twos", 2],
      ["threes", 3],
      ["fours", 4],
      ["fives", 5],
      ["sixes", 6],
    ] as const;
    for (const [category, face] of faces) {
      useGameStore.getState().roll(allFaces(face));
      useGameStore.getState().hold(0);
      useGameStore.getState().hold(1);
      useGameStore.getState().hold(2);
      // Reroll the other two to a different face so only three count.
      useGameStore.getState().roll(allFaces(face === 6 ? 1 : 6));
      useGameStore.getState().score(category);
    }
    const t = useGameStore.getState().totals();
    expect(t.upper).toBeGreaterThanOrEqual(63);
    expect(t.bonus).toBe(UPPER_BONUS);
  });
});

describe("game completion", () => {
  it("is not complete while a category remains", () => {
    expect(useGameStore.getState().isComplete()).toBe(false);
  });

  it("is complete once every category is filled", () => {
    for (const category of useGameStore.getState().remaining()) {
      useGameStore.getState().roll(allFaces(1));
      useGameStore.getState().score(category);
    }
    expect(useGameStore.getState().isComplete()).toBe(true);
    expect(useGameStore.getState().remaining()).toHaveLength(0);
  });
});

describe("persistence", () => {
  it("round-trips a game in progress", async () => {
    useGameStore.getState().roll(allFaces(2));
    useGameStore.getState().score("twos");
    await useGameStore.getState().persist();

    useGameStore.setState({ card: {}, best: 0 });
    await useGameStore.getState().hydrate();
    expect(useGameStore.getState().card.twos).toBe(10);
  });

  it("records a best score when a game completes", async () => {
    for (const category of useGameStore.getState().remaining()) {
      useGameStore.getState().roll(allFaces(6));
      useGameStore.getState().score(category);
    }
    expect(useGameStore.getState().best).toBeGreaterThan(0);
  });

  it("starts clean on stored rubbish rather than refusing to launch", async () => {
    await AsyncStorage.setItem(
      GAME_CACHE_KEY,
      '{"card":[1,2,3],"best":"lots"}',
    );
    await useGameStore.getState().hydrate();
    expect(useGameStore.getState().card).toEqual({});
    expect(useGameStore.getState().best).toBe(0);
  });
});
