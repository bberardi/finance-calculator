// A single point on a date-indexed monthly forecast series.
// For loans the value is the remaining balance (a liability);
// for investments it is the projected value; for net worth it is
// total investment value minus total loan balance.
export type ForecastPoint = {
  Date: Date;
  Value: number;
};

// Extra amounts applied on top of existing payments/contributions, keyed by
// entity ID. Used to model what-if scenarios without mutating the underlying
// loans/investments.
//
// `Extra*` are recurring monthly amounts (Phase 4/5). `OneTime*` are single
// lump-sum amounts applied once, at the first forecast month (Phase 8.2) — the
// "where does a $5k bonus go?" counterpart to the monthly optimizer. The two are
// independent: a scenario can carry both, and the engine applies each to the
// matching loan/investment by ID.
export type ScenarioInput = {
  ExtraLoanPayments?: Record<string, number>;
  ExtraContributions?: Record<string, number>;
  OneTimeLoanPayments?: Record<string, number>;
  OneTimeContributions?: Record<string, number>;
};
