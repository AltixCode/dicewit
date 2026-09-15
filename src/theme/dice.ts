/**
 * The dice palettes.
 *
 * These live in `src/theme/` because every colour literal in the app does — a die's face is
 * chrome like anything else, and keeping it here is what lets the contrast test see it.
 *
 * Each palette carries its own `pip` colour rather than deriving one. A pip drawn in a single
 * fixed colour reads well on amber and disappears on violet, and "derive it from luminance"
 * is the kind of rule that is right on four of five palettes and wrong on the one nobody
 * checks. Both variants are chosen against their own face for at least 4.5:1.
 */

export interface DicePalette {
  /** The die body. */
  face: string;
  /** The dots. Contrast-checked against `face` by `__tests__/dice.test.ts`. */
  pip: string;
  /** The ring drawn around a die the player is keeping. */
  held: string;
}

export interface DiceTheme {
  light: DicePalette;
  dark: DicePalette;
}

export const DICE_THEMES: Record<string, DiceTheme> = {
  default: {
    light: { face: '#FFFFFF', pip: '#000000', held: '#8C8C8C' },
    dark: { face: '#E2E8F0', pip: '#000000', held: '#7C8084' },
  },
  ruby: {
    light: { face: '#B91C1C', pip: '#FFFFFF', held: '#E3A4A4' },
    dark: { face: '#DC2626', pip: '#FFFFFF', held: '#4D0D0D' },
  },
  jade: {
    light: { face: '#047857', pip: '#FFFFFF', held: '#A7D0C4' },
    dark: { face: '#059669', pip: '#000000', held: '#023C2A' },
  },
  amber: {
    light: { face: '#B45309', pip: '#FFFFFF', held: '#E5C3A9' },
    dark: { face: '#D97706', pip: '#000000', held: '#623603' },
  },
  violet: {
    light: { face: '#6D28D9', pip: '#FFFFFF', held: '#BD9EEE' },
    dark: { face: '#7C3AED', pip: '#FFFFFF', held: '#CBB0F8' },
  },
};

/** Falls back to `default` rather than throwing, so a stale stored name cannot break a launch. */
export function dicePalette(
  name: string,
  scheme: "light" | "dark",
): DicePalette {
  const theme = DICE_THEMES[name] ?? DICE_THEMES.default!;
  return scheme === "dark" ? theme.dark : theme.light;
}
