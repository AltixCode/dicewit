/**
 * The fill that marks a scorecard category as already used.
 *
 * **Why this is not `surfaceAlt`.** A used row was `surfaceAlt` and an unused
 * one `surface`, which on the dark theme is #1B2531 against #121A24 — a contrast
 * ratio of **1.13:1**, which nobody can see. On a scorecard, "which categories
 * have I already filled" is the single thing a player scans for between rolls.
 *
 * 3:1 is the WCAG threshold for a non-text UI component, and a row state read at
 * a glance down a list is exactly that. These clear it in both themes.
 *
 * The constraint that sets the ceiling: the label and score sit on this fill and
 * must stay above 4.5:1 against it. That is what stops the dark fill going
 * lighter than #556C84.
 */
export interface RowStates {
  /** A category that has been scored. */
  used: string;
}

export const darkRows: RowStates = { used: '#556C84' };
export const lightRows: RowStates = { used: '#8F8F89' };

export const rowsFor = (isDark: boolean): RowStates => (isDark ? darkRows : lightRows);
