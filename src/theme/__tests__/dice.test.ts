import { DICE_THEMES, dicePalette } from "../dice";
import { contrastRatio } from "../color";
import { DICE_COLORS } from "@/store/useDiceStore";

describe("every dice palette is legible", () => {
  // The pips carry the entire meaning of a die. A palette whose pips wash out against its own
  // face is not a style choice, it is an unreadable die — and it is exactly the kind of thing
  // that looks fine on the one colour the author happened to be looking at.
  for (const [name, theme] of Object.entries(DICE_THEMES)) {
    for (const scheme of ["light", "dark"] as const) {
      it(`${name} (${scheme}) has AA contrast between pip and face`, () => {
        const { face, pip } = theme[scheme];
        expect(contrastRatio(pip, face)).toBeGreaterThanOrEqual(4.5);
      });

      it(`${name} (${scheme}) marks a held die distinguishably`, () => {
        const { face, held } = theme[scheme];
        // The held ring must be visible against the die it surrounds, or "kept" is invisible.
        expect(contrastRatio(held, face)).toBeGreaterThanOrEqual(3);
      });
    }
  }
});

describe("dicePalette", () => {
  it("has a palette for every colour the store will accept", () => {
    // Otherwise a colour a user can select renders as the default and the purchase is a lie.
    for (const name of DICE_COLORS) {
      expect(DICE_THEMES[name]).toBeDefined();
    }
  });

  it("falls back to the default rather than throwing on an unknown name", () => {
    expect(dicePalette("chartreuse", "light")).toEqual(
      DICE_THEMES.default!.light,
    );
  });

  it("returns the scheme asked for", () => {
    expect(dicePalette("ruby", "dark")).toEqual(DICE_THEMES.ruby!.dark);
  });
});
