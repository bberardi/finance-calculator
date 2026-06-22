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
export const formatCurrency = (amount: number): string =>
  usdFormatter.format(amount);

/**
 * Formats a number as compact US dollars for space-constrained surfaces (chart
 * axis ticks, tooltips), e.g. `1234567` -> `"$1.2M"`, `-6000` -> `"-$6K"`.
 */
export const formatCurrencyCompact = (amount: number): string =>
  usdCompactFormatter.format(amount);

/**
 * Formats a signed net-worth *change* for the scenario/optimizer panels: a
 * leading "+" for a gain, the native "-" for a loss, and the literal
 * "No change" when the delta is exactly zero. The zero case keeps a pure
 * debt-paydown — which clears the loan by the horizon either way, so it doesn't
 * move net worth there (v1 doesn't redirect the freed payment) — from reading as
 * a confusing "+$0"; that plan's real benefit shows as interest saved and an
 * earlier debt-free date instead.
 */
export const formatNetWorthDelta = (delta: number): string =>
  delta === 0 ? 'No change' : `${delta > 0 ? '+' : ''}${formatCurrency(delta)}`;

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
