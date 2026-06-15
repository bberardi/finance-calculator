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
}

export const emptyScenario: Scenario = {
  Id: '',
  Name: '',
  ExtraLoanPayments: {},
  ExtraContributions: {},
};
