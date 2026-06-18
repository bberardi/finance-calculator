import { Loan } from '../models/loan-model';
import { Investment } from '../models/investment-model';
import { Scenario } from '../models/scenario-model';
import { mergeData } from '../helpers/data-helpers';

// State shape for the finance data context (D2).
//
// `loans`/`investments` are the data currently shown to the user. While sample
// data is loaded (roadmap 0.9), these hold the sample entities and the user's
// real data is parked in `stashedLoans`/`stashedInvestments` until sample data
// is cleared again. `sampleDataLoaded` mirrors that state.
export interface FinanceState {
  loans: Loan[];
  investments: Investment[];
  sampleDataLoaded: boolean;
  // User data stashed while sample data is loaded; null otherwise.
  stashedLoans: Loan[] | null;
  stashedInvestments: Investment[] | null;
  // Named what-if scenarios (Phase 4). Session-scoped until 4.5 persists them.
  scenarios: Scenario[];
  // Which scenario is currently overlaid on the chart, or null for none.
  activeScenarioId: string | null;
}

// The data fields an ImportMerge can touch, captured before a merge so the
// import-undo (6.3) can restore them exactly. `sampleDataLoaded` and
// `activeScenarioId` are untouched by a merge, so they are not part of the
// snapshot.
export interface DataSnapshot {
  loans: Loan[];
  investments: Investment[];
  scenarios: Scenario[];
  stashedLoans: Loan[] | null;
  stashedInvestments: Investment[] | null;
}

export const initialFinanceState: FinanceState = {
  loans: [],
  investments: [],
  sampleDataLoaded: false,
  stashedLoans: null,
  stashedInvestments: null,
  scenarios: [],
  activeScenarioId: null,
};

// Reducer actions (D2). ID generation happens OUTSIDE the reducer (in the
// dispatch call sites) so the reducer stays pure/deterministic: AddLoan /
// AddInvestment expect a fully-formed entity whose Id is already assigned.
export type FinanceAction =
  | { type: 'AddLoan'; loan: Loan }
  | { type: 'UpdateLoan'; loan: Loan }
  | { type: 'DeleteLoan'; id: string }
  // Soft-undo for delete (roadmap 0.7): restore an entity at the position it
  // held before deletion. The delete call site remembers the original index and
  // replays it here on UNDO, so the list looks untouched. The index is clamped,
  // so an out-of-range index (e.g. the list shrank meanwhile) appends sanely
  // instead of throwing or leaving a hole.
  | { type: 'InsertLoanAt'; loan: Loan; index: number }
  | { type: 'AddInvestment'; investment: Investment }
  | { type: 'UpdateInvestment'; investment: Investment }
  | { type: 'DeleteInvestment'; id: string }
  | { type: 'InsertInvestmentAt'; investment: Investment; index: number }
  | {
      type: 'ImportMerge';
      loans: Loan[];
      investments: Investment[];
      scenarios?: Scenario[];
    }
  // Soft-undo for an import merge (roadmap 6.3): restore the data captured
  // immediately before the merge, reverting a merge-by-Id clobber.
  | { type: 'RestoreData'; snapshot: DataSnapshot }
  | { type: 'LoadSampleData'; loans: Loan[]; investments: Investment[] }
  | { type: 'ClearSampleData' }
  // Scenario actions (Phase 4). Like entities, Id generation happens at the
  // dispatch call site so the reducer stays pure.
  | { type: 'AddScenario'; scenario: Scenario }
  | { type: 'UpdateScenario'; scenario: Scenario }
  | { type: 'DeleteScenario'; id: string }
  | { type: 'SetActiveScenario'; id: string | null };

// Insert `item` into `list` at `index`, clamping the index into [0, length].
// Pure helper: returns a new array and never mutates the input.
const insertAt = <T>(list: T[], item: T, index: number): T[] => {
  const clamped = Math.max(0, Math.min(index, list.length));
  return [...list.slice(0, clamped), item, ...list.slice(clamped)];
};

export const financeReducer = (
  state: FinanceState,
  action: FinanceAction
): FinanceState => {
  switch (action.type) {
    case 'AddLoan':
      return { ...state, loans: [...state.loans, action.loan] };

    case 'UpdateLoan':
      // Replace in place, preserving order (regression for #48).
      return {
        ...state,
        loans: state.loans.map((loan) =>
          loan.Id === action.loan.Id ? action.loan : loan
        ),
      };

    case 'DeleteLoan':
      // Explicit delete by Id, no sentinel (regression for #49).
      return {
        ...state,
        loans: state.loans.filter((loan) => loan.Id !== action.id),
      };

    case 'InsertLoanAt':
      // Restore a deleted loan at its original index (undo). If the same Id is
      // somehow already present (e.g. re-added meanwhile), don't duplicate it.
      if (state.loans.some((loan) => loan.Id === action.loan.Id)) {
        return state;
      }
      return {
        ...state,
        loans: insertAt(state.loans, action.loan, action.index),
      };

    case 'AddInvestment':
      return {
        ...state,
        investments: [...state.investments, action.investment],
      };

    case 'UpdateInvestment':
      // Replace in place, preserving order (regression for #48).
      return {
        ...state,
        investments: state.investments.map((investment) =>
          investment.Id === action.investment.Id
            ? action.investment
            : investment
        ),
      };

    case 'DeleteInvestment':
      // Explicit delete by Id, no sentinel (regression for #49).
      return {
        ...state,
        investments: state.investments.filter(
          (investment) => investment.Id !== action.id
        ),
      };

    case 'InsertInvestmentAt':
      // Restore a deleted investment at its original index (undo).
      if (state.investments.some((inv) => inv.Id === action.investment.Id)) {
        return state;
      }
      return {
        ...state,
        investments: insertAt(
          state.investments,
          action.investment,
          action.index
        ),
      };

    case 'ImportMerge': {
      // Scenarios merge by Id too (Phase 4.5); omitted means "leave unchanged".
      const mergedScenarios = action.scenarios
        ? mergeData(state.scenarios, action.scenarios).items
        : state.scenarios;

      // While sample data is loaded, the visible loans/investments are the
      // samples and the user's real data is parked in the stash. Merge imports
      // into the *stashed real data* (not the samples), so an import isn't
      // silently discarded when ClearSampleData restores the stash. Samples stay
      // visible and untouched until cleared, at which point the merged real data
      // (including the import) is restored. (#83)
      if (state.sampleDataLoaded) {
        const { items: mergedLoans } = mergeData(
          state.stashedLoans ?? [],
          action.loans
        );
        const { items: mergedInvestments } = mergeData(
          state.stashedInvestments ?? [],
          action.investments
        );
        return {
          ...state,
          stashedLoans: mergedLoans,
          stashedInvestments: mergedInvestments,
          scenarios: mergedScenarios,
        };
      }

      // Preserve DataManager's merge-by-Id semantics exactly.
      const { items: mergedLoans } = mergeData(state.loans, action.loans);
      const { items: mergedInvestments } = mergeData(
        state.investments,
        action.investments
      );
      return {
        ...state,
        loans: mergedLoans,
        investments: mergedInvestments,
        scenarios: mergedScenarios,
      };
    }

    case 'RestoreData':
      // Replace exactly the fields a merge can have changed. Other state
      // (sample-data flag, active scenario) is left as-is.
      return {
        ...state,
        loans: action.snapshot.loans,
        investments: action.snapshot.investments,
        scenarios: action.snapshot.scenarios,
        stashedLoans: action.snapshot.stashedLoans,
        stashedInvestments: action.snapshot.stashedInvestments,
      };

    case 'LoadSampleData': {
      // Loading sample data: stash the user's real data and show the samples
      // instead. Real data is never destroyed. Idempotent — loading again while
      // already showing samples does not overwrite an existing stash.
      if (state.sampleDataLoaded) {
        return state;
      }
      return {
        ...state,
        sampleDataLoaded: true,
        stashedLoans: state.loans,
        stashedInvestments: state.investments,
        loans: action.loans,
        investments: action.investments,
      };
    }

    case 'ClearSampleData': {
      // Clearing sample data: discard whatever is currently shown (the samples,
      // plus any edits made while they were loaded) and restore the stash.
      if (!state.sampleDataLoaded) {
        return state;
      }
      return {
        ...state,
        sampleDataLoaded: false,
        loans: state.stashedLoans ?? [],
        investments: state.stashedInvestments ?? [],
        stashedLoans: null,
        stashedInvestments: null,
      };
    }

    case 'AddScenario':
      return { ...state, scenarios: [...state.scenarios, action.scenario] };

    case 'UpdateScenario':
      return {
        ...state,
        scenarios: state.scenarios.map((scenario) =>
          scenario.Id === action.scenario.Id ? action.scenario : scenario
        ),
      };

    case 'DeleteScenario':
      return {
        ...state,
        scenarios: state.scenarios.filter(
          (scenario) => scenario.Id !== action.id
        ),
        // Drop the active selection if the deleted scenario was active.
        activeScenarioId:
          state.activeScenarioId === action.id ? null : state.activeScenarioId,
      };

    case 'SetActiveScenario':
      return { ...state, activeScenarioId: action.id };

    default:
      return state;
  }
};
