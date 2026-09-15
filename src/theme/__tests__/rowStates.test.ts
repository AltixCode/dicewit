import { contrastRatio } from '../color';
import { darkRows, lightRows, rowsFor } from '../rowStates';
import { darkPalette, lightPalette } from '../tokens';

/** WCAG's threshold for a non-text UI component, which a row state is. */
const MIN_STATE_SEPARATION = 3;

describe('scorecard row states', () => {
  it('makes a used category clearly distinguishable from an unused one', () => {
    expect(contrastRatio(darkRows.used, darkPalette.surface)).toBeGreaterThan(
      MIN_STATE_SEPARATION,
    );
    expect(contrastRatio(lightRows.used, lightPalette.surface)).toBeGreaterThan(
      MIN_STATE_SEPARATION,
    );
  });

  // The regression this replaces, stated as a number so it cannot come back.
  it('is nowhere near the 1.13:1 it replaced', () => {
    expect(contrastRatio(darkRows.used, darkPalette.surface)).toBeGreaterThan(2.5);
  });

  // The constraint that sets the ceiling: the label and score sit on this fill.
  it('keeps the label and score legible on a used row', () => {
    expect(contrastRatio(darkPalette.text, darkRows.used)).toBeGreaterThan(4.5);
    expect(contrastRatio(lightPalette.text, lightRows.used)).toBeGreaterThan(4.5);
  });

  it('picks the right set for the theme', () => {
    expect(rowsFor(true)).toBe(darkRows);
    expect(rowsFor(false)).toBe(lightRows);
  });
});
