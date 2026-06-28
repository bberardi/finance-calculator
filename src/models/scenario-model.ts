// A named what-if scenario (Phase 4): extra monthly amounts applied on top of
// existing payments/contributions, keyed by entity Id. The shape is a superset
// of ScenarioInput (forecast-model) with required maps + identity fields, so a
// Scenario can be passed straight to the forecast engine as a ScenarioInput.
//
// Input-only, like the other models: derived overlays are computed on demand by
// the engine, never stored.
export interface Scenario {
  Id: string;
  Name: string;
  ExtraLoanPayments: Record<string, number>;
  ExtraContributions: Record<string, number>;
  // One-time lump-sum amounts applied once at the first forecast month (Phase
  // 8.2). Optional so the common case — a recurring-only scenario — carries no
  // empty clutter, and so existing scenarios (and import files) stay valid
  // without migration. A Scenario remains a valid ScenarioInput either way.
  OneTimeLoanPayments?: Record<string, number>;
  OneTimeContributions?: Record<string, number>;
}

export const emptyScenario: Scenario = {
  Id: '',
  Name: '',
  ExtraLoanPayments: {},
  ExtraContributions: {},
};
