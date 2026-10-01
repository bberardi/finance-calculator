// Pure formatting helpers shared across the UI. Per decision D7 this module is
// part of the boundary-enforced core layer: TypeScript only, NO React/MUI
// imports. It centralizes the currency/percent formatting that was previously
// duplicated (and subtly inconsistent) across the loan/investment tables and
// their popouts.

// Reuse a single Intl.NumberFormat instance per shape. Constructing an
// Intl.NumberFormat is relatively expensive, and these run once per table cell.
const usdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

// Compact currency for dense surfaces like chart axes/tooltips, where a full
// "$1,234,567.00" would overlap: e.g. `1234567` -> `"$1.2M"`, `6000` -> `"$6K"`.
const usdCompactFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  // Currency style defaults the minimum to 2; with a max of 1 Intl would clamp
  // the minimum to 1 and render "$6.0K". An explicit 0 minimum drops the
  // trailing zero so round thousands read "$6K".
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

// Percent formatters are keyed by fraction-digit count so callers that want a
// different precision (loans: 2 digits, investments: 3) share cached instances.
const percentFormatters = new Map<number, Intl.NumberFormat>();

const getPercentFormatter = (fractionDigits: number): Intl.NumberFormat => {
  let formatter = percentFormatters.get(fractionDigits);
  if (!formatter) {
    formatter = new Intl.NumberFormat('en-US', {
      style: 'percent',
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    });
    percentFormatters.set(fractionDigits, formatter);
  }
  return formatter;
};

/**
 * Formats a number as US dollars, e.g. `1234.5` -> `"$1,234.50"`.
 * Always shows exactly two fraction digits, matching the prior behavior of the
 * loan/investment tables and PIT/schedule popouts.
 */
// Intl keeps the minus sign on -0 and on any negative that rounds to zero at
// the displayed precision ("-$0.00"). Round to that precision first and fold
// -0 into +0 so an effectively-zero amount never shows a spurious sign. (#182)
const normalizeForDisplay = (
  amount: number,
  fractionDigits: number
): number => {
  const scale = 10 ** fractionDigits;
  const rounded = Math.round(amount * scale) / scale;
  return rounded === 0 ? 0 : amount;
};

export const formatCurrency = (amount: number): string =>
  usdFormatter.format(normalizeForDisplay(amount, 2));

/**
 * Formats a number as compact US dollars for space-constrained surfaces (chart
 * axis ticks, tooltips), e.g. `1234567` -> `"$1.2M"`, `-6000` -> `"-$6K"`.
 */
export const formatCurrencyCompact = (amount: number): string =>
  usdCompactFormatter.format(amount === 0 ? 0 : amount);

/**
 * Formats a signed net-worth *change* for the scenario/optimizer panels: a
 * leading "+" for a gain, the native "-" for a loss, and the literal
 * "No change" when the delta is zero at cent precision (rather than a
 * confusing "+$0.00").
 */
// The zero test runs at the displayed (cent) precision, so a sub-cent delta
// also reads "No change" rather than a signed "$0.00". (#182)
export const formatNetWorthDelta = (delta: number): string => {
  const cents = Math.round(delta * 100) / 100;
  return cents === 0
    ? 'No change'
    : `${cents > 0 ? '+' : ''}${formatCurrency(delta)}`;
};

/**
 * Formats a percentage value, where `percent` is the human-facing percent
 * number (e.g. `5.5` for 5.5%, not the fraction `0.055`).
 *
 * @param percent - the percentage value (5.5 means 5.5%)
 * @param fractionDigits - number of fraction digits to show (default 2). Loans
 *   display 2 digits; investment return rates historically displayed 3.
 */
export const formatPercent = (percent: number, fractionDigits = 2): string =>
  getPercentFormatter(fractionDigits).format(percent / 100);
