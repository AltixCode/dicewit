import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  DICE_CACHE_KEY,
  FREE_HISTORY,
  FREE_PRESETS,
  useDiceStore,
} from "../useDiceStore";

const reset = () =>
  useDiceStore.setState({ presets: [], history: [], diceColor: "default" });

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  reset();
});

describe("presets — the free tier keeps three", () => {
  it("saves a preset from valid notation", () => {
    expect(useDiceStore.getState().savePreset("Fireball", "8d6", false)).toBe(
      "saved",
    );
    expect(useDiceStore.getState().presets).toHaveLength(1);
    expect(useDiceStore.getState().presets[0]!.notation).toBe("8d6");
  });

  it("refuses notation it cannot parse rather than saving something that will not roll", () => {
    expect(
      useDiceStore.getState().savePreset("Nonsense", "not dice", false),
    ).toBe("invalid");
    expect(useDiceStore.getState().presets).toHaveLength(0);
  });

  it("stops a free user at the cap", () => {
    for (let i = 0; i < FREE_PRESETS; i += 1) {
      expect(useDiceStore.getState().savePreset(`P${i}`, "1d6", false)).toBe(
        "saved",
      );
    }
    expect(
      useDiceStore.getState().savePreset("One too many", "1d6", false),
    ).toBe("limit-reached");
    expect(useDiceStore.getState().presets).toHaveLength(FREE_PRESETS);
  });

  it("lets a premium user past it — the paywall promises unlimited presets", () => {
    for (let i = 0; i < FREE_PRESETS + 5; i += 1) {
      expect(useDiceStore.getState().savePreset(`P${i}`, "1d6", true)).toBe(
        "saved",
      );
    }
    expect(useDiceStore.getState().presets).toHaveLength(FREE_PRESETS + 5);
  });

  it("removes a preset by id, and ignores an id it does not hold", () => {
    useDiceStore.getState().savePreset("Keep", "1d6", false);
    useDiceStore.getState().savePreset("Drop", "2d6", false);
    const id = useDiceStore.getState().presets[1]!.id;
    useDiceStore.getState().removePreset(id);
    expect(useDiceStore.getState().presets.map((p) => p.label)).toEqual([
      "Keep",
    ]);
    useDiceStore.getState().removePreset("nope");
    expect(useDiceStore.getState().presets).toHaveLength(1);
  });

  it("names an unlabelled preset after its notation rather than leaving it blank", () => {
    useDiceStore.getState().savePreset("   ", "2d20+1", false);
    expect(useDiceStore.getState().presets[0]!.label).toBe("2d20+1");
  });
});

describe("history", () => {
  it("records a roll, newest first", () => {
    useDiceStore.getState().rollNotation("1d6", () => 0.5);
    useDiceStore.getState().rollNotation("2d6", () => 0.5);
    expect(useDiceStore.getState().history[0]!.notation).toBe("2d6");
  });

  it("returns null for notation it cannot parse, and records nothing", () => {
    expect(
      useDiceStore.getState().rollNotation("rubbish", () => 0.5),
    ).toBeNull();
    expect(useDiceStore.getState().history).toHaveLength(0);
  });

  it("keeps a free user to the most recent entries", () => {
    for (let i = 0; i < FREE_HISTORY + 20; i += 1)
      useDiceStore.getState().rollNotation("1d6", () => 0.5, false);
    expect(useDiceStore.getState().history).toHaveLength(FREE_HISTORY);
  });

  it("keeps everything for a premium user — the paywall sells the FULL log", () => {
    for (let i = 0; i < FREE_HISTORY + 20; i += 1)
      useDiceStore.getState().rollNotation("1d6", () => 0.5, true);
    expect(useDiceStore.getState().history).toHaveLength(FREE_HISTORY + 20);
  });

  it("trims a premium log down once the entitlement is gone", () => {
    for (let i = 0; i < FREE_HISTORY + 20; i += 1)
      useDiceStore.getState().rollNotation("1d6", () => 0.5, true);
    // The next free roll must not leave a hidden log the user can no longer see.
    useDiceStore.getState().rollNotation("1d6", () => 0.5, false);
    expect(useDiceStore.getState().history).toHaveLength(FREE_HISTORY);
  });

  it("clears on request", () => {
    useDiceStore.getState().rollNotation("1d6", () => 0.5);
    useDiceStore.getState().clearHistory();
    expect(useDiceStore.getState().history).toHaveLength(0);
  });
});

describe("export — what the paywall calls an exportable log", () => {
  it("produces one line per roll, newest first, with the result", () => {
    useDiceStore.getState().rollNotation("2d6", () => 0);
    const text = useDiceStore.getState().exportHistory();
    // 2d6 with rng 0 rolls two ones.
    expect(text).toContain("2d6");
    expect(text).toContain("1, 1");
    expect(text.trim().split("\n")).toHaveLength(1);
  });

  it("is empty rather than throwing when there is nothing to export", () => {
    expect(useDiceStore.getState().exportHistory()).toBe("");
  });
});

describe("dice colour", () => {
  it("starts on the default", () => {
    expect(useDiceStore.getState().diceColor).toBe("default");
  });

  it("a free user cannot choose another — the paywall sells it", () => {
    useDiceStore.getState().setDiceColor("ruby", false);
    expect(useDiceStore.getState().diceColor).toBe("default");
  });

  it("a premium user can", () => {
    useDiceStore.getState().setDiceColor("ruby", true);
    expect(useDiceStore.getState().diceColor).toBe("ruby");
  });

  it("refuses a colour that is not on the list, whoever asks", () => {
    useDiceStore.getState().setDiceColor("chartreuse" as never, true);
    expect(useDiceStore.getState().diceColor).toBe("default");
  });
});

describe("persistence", () => {
  it("round-trips presets, history and colour", async () => {
    useDiceStore.getState().savePreset("Fireball", "8d6", false);
    useDiceStore.getState().rollNotation("1d20", () => 0.5);
    useDiceStore.getState().setDiceColor("ruby", true);
    await useDiceStore.getState().persist();

    reset();
    await useDiceStore.getState().hydrate();

    expect(useDiceStore.getState().presets[0]!.label).toBe("Fireball");
    expect(useDiceStore.getState().history).toHaveLength(1);
    expect(useDiceStore.getState().diceColor).toBe("ruby");
  });

  it("survives stored rubbish rather than crashing on launch", async () => {
    await AsyncStorage.setItem(
      DICE_CACHE_KEY,
      '{"presets":"not an array","diceColor":42}',
    );
    await useDiceStore.getState().hydrate();
    expect(useDiceStore.getState().presets).toEqual([]);
    expect(useDiceStore.getState().diceColor).toBe("default");
  });

  it("survives a value that is not JSON at all", async () => {
    await AsyncStorage.setItem(DICE_CACHE_KEY, "not json");
    await expect(useDiceStore.getState().hydrate()).resolves.toBeUndefined();
    expect(useDiceStore.getState().presets).toEqual([]);
  });
});
