import { Loan } from '../models/loan-model';
import { Investment } from '../models/investment-model';
import { mergeData } from '../helpers/data-helpers';

// State shape for the finance data context (D2).
//
// `loans`/`investments` are the data currently shown to the user. When the
// "Test Data" dev toggle is on, these hold the fake data and the user's real
// data is parked in `stashedLoans`/`stashedInvestments` until the toggle is
// turned off again (issue #47). `testDataEnabled` mirrors the toggle.
export interface FinanceState {
  loans: Loan[];
  investments: Investment[];
  testDataEnabled: boolean;
  // User data stashed while test data is enabled; null when test data is off.
  stashedLoans: Loan[] | null;
  stashedInvestments: Investment[] | null;
}

export const initialFinanceState: FinanceState = {
  loans: [],
  investments: [],
  testDataEnabled: false,
  stashedLoans: null,
  stashedInvestments: null,
};

// Reducer actions (D2). ID generation happens OUTSIDE the reducer (in the
// dispatch call sites) so the reducer stays pure/deterministic: AddLoan /
// AddInvestment expect a fully-formed entity whose Id is already assigned.
export type FinanceAction =
  | { type: 'AddLoan'; loan: Loan }
  | { type: 'UpdateLoan'; loan: Loan }
  | { type: 'DeleteLoan'; id: string }
  | { type: 'AddInvestment'; investment: Investment }
  | { type: 'UpdateInvestment'; investment: Investment }
  | { type: 'DeleteInvestment'; id: string }
  | { type: 'ImportMerge'; loans: Loan[]; investments: Investment[] }
  | { type: 'EnableTestData'; loans: Loan[]; investments: Investment[] }
  | { type: 'DisableTestData' };

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

    case 'ImportMerge': {
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
      };
    }

    case 'EnableTestData': {
      // Toggling on: stash the user's real data and show fake data instead.
      // Real data is never destroyed (issue #47). Idempotent — re-enabling
      // while already on does not overwrite an existing stash.
      if (state.testDataEnabled) {
        return state;
      }
      return {
        ...state,
        testDataEnabled: true,
        stashedLoans: state.loans,
        stashedInvestments: state.investments,
        loans: action.loans,
        investments: action.investments,
      };
    }

    case 'DisableTestData': {
      // Toggling off: discard whatever is currently shown (the fake data, plus
      // any edits made while test data was enabled) and restore the stash.
      if (!state.testDataEnabled) {
        return state;
      }
      return {
        ...state,
        testDataEnabled: false,
        loans: state.stashedLoans ?? [],
        investments: state.stashedInvestments ?? [],
        stashedLoans: null,
        stashedInvestments: null,
      };
    }

    default:
      return state;
  }
};
