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
 * Formats a percentage value, where `percent` is the human-facing percent
 * number (e.g. `5.5` for 5.5%, not the fraction `0.055`).
 *
 * @param percent - the percentage value (5.5 means 5.5%)
 * @param fractionDigits - number of fraction digits to show (default 2). Loans
 *   display 2 digits; investment return rates historically displayed 3.
 */
export const formatPercent = (percent: number, fractionDigits = 2): string =>
  getPercentFormatter(fractionDigits).format(percent / 100);
