import dayjs from 'dayjs';

// Inflation adjustment (ROADMAP 9.2): a long-horizon nominal projection overstates
// real buying power — $1M in 30 years is not $1M today. This layer discounts
// nominal future values back to "today's dollars" (real terms) so charts and
// milestones can be viewed either way. Pure post-processing on already-computed
// nominal values — no engine changes, and it never rounds the intermediate rate.

const roundToCents = (value: number): number => Math.round(value * 100) / 100;

// Default assumed annual inflation, in percent. A single documented assumption
// (surfaced in the assumptions panel), not a per-position input.
export const DEFAULT_INFLATION_PCT = 3;

// Discount a nominal value by `years` of inflation to today's dollars. `years`
// may be fractional: 0 leaves it unchanged, a positive (future) horizon shrinks it
// toward real terms, and a negative one — a past date — scales it up, which is the
// correct today's-dollars value of a past amount. In practice the app only ever
// passes years >= 0. Not rounded, so callers can round once at the end.
export const toRealValueOverYears = (
  nominal: number,
  years: number,
  annualInflationPct: number = DEFAULT_INFLATION_PCT
): number => nominal / Math.pow(1 + annualInflationPct / 100, years);

// Real value of a nominal amount dated `date`, discounted from `today`.
export const toRealValue = (
  nominal: number,
  date: Date,
  today: Date,
  annualInflationPct: number = DEFAULT_INFLATION_PCT
): number =>
  toRealValueOverYears(
    nominal,
    dayjs(date).diff(dayjs(today), 'year', true),
    annualInflationPct
  );

// Deflate a nominal series to real terms point by point, using each value's date
// to measure the years elapsed since `today`. Index 0 (today) is unchanged.
// Rounded to cents per point, matching the forecast engine's output policy.
export const toRealSeries = (
  values: number[],
  dates: Date[],
  today: Date,
  annualInflationPct: number = DEFAULT_INFLATION_PCT
): number[] =>
  values.map((value, index) =>
    roundToCents(toRealValue(value, dates[index], today, annualInflationPct))
  );
