// A single point on a date-indexed monthly forecast series.
// For loans the value is the remaining balance (a liability);
// for investments it is the projected value; for net worth it is
// total investment value minus total loan balance.
export type ForecastPoint = {
  Date: Date;
  Value: number;
};

// Extra monthly amounts applied on top of existing payments/contributions,
// keyed by entity ID. Used to model what-if scenarios without mutating the
// underlying loans/investments.
export type ScenarioInput = {
  ExtraLoanPayments?: Record<string, number>;
  ExtraContributions?: Record<string, number>;
};
