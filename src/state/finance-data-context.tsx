import { createContext, Dispatch, ReactNode, useMemo, useReducer } from 'react';
import { Loan } from '../models/loan-model';
import { Investment } from '../models/investment-model';
import { generateId } from '../helpers/id-helpers';
import {
  FinanceAction,
  FinanceState,
  financeReducer,
  initialFinanceState,
} from './finance-reducer';

export interface FinanceDataContextValue {
  state: FinanceState;
  dispatch: Dispatch<FinanceAction>;
  // Convenience action creators. ID assignment for new entities happens here
  // (outside the reducer) so the reducer stays pure/deterministic.
  addLoan: (loan: Loan) => void;
  updateLoan: (loan: Loan) => void;
  deleteLoan: (id: string) => void;
  // Undo a loan delete by restoring it at its original index (roadmap 0.7).
  insertLoanAt: (loan: Loan, index: number) => void;
  addInvestment: (investment: Investment) => void;
  updateInvestment: (investment: Investment) => void;
  deleteInvestment: (id: string) => void;
  // Undo an investment delete by restoring it at its original index.
  insertInvestmentAt: (investment: Investment, index: number) => void;
  importMerge: (loans: Loan[], investments: Investment[]) => void;
  loadSampleData: (loans: Loan[], investments: Investment[]) => void;
  clearSampleData: () => void;
}

export const FinanceDataContext = createContext<
  FinanceDataContextValue | undefined
>(undefined);

export const FinanceDataProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(financeReducer, initialFinanceState);

  // The action creators close over only the stable `dispatch` (and their own
  // arguments), so build them once. Stable identities mean a consumer that reads
  // a single method off the context isn't re-rendered by every unrelated state
  // change — only the `value` object below re-memoizes when `state` changes.
  const actions = useMemo(
    () => ({
      addLoan: (loan: Loan) =>
        dispatch({
          type: 'AddLoan',
          loan: { ...loan, Id: loan.Id || generateId() },
        }),
      updateLoan: (loan: Loan) => dispatch({ type: 'UpdateLoan', loan }),
      deleteLoan: (id: string) => dispatch({ type: 'DeleteLoan', id }),
      insertLoanAt: (loan: Loan, index: number) =>
        dispatch({ type: 'InsertLoanAt', loan, index }),
      addInvestment: (investment: Investment) =>
        dispatch({
          type: 'AddInvestment',
          investment: { ...investment, Id: investment.Id || generateId() },
        }),
      updateInvestment: (investment: Investment) =>
        dispatch({ type: 'UpdateInvestment', investment }),
      deleteInvestment: (id: string) =>
        dispatch({ type: 'DeleteInvestment', id }),
      insertInvestmentAt: (investment: Investment, index: number) =>
        dispatch({ type: 'InsertInvestmentAt', investment, index }),
      importMerge: (loans: Loan[], investments: Investment[]) =>
        dispatch({ type: 'ImportMerge', loans, investments }),
      loadSampleData: (loans: Loan[], investments: Investment[]) =>
        dispatch({ type: 'LoadSampleData', loans, investments }),
      clearSampleData: () => dispatch({ type: 'ClearSampleData' }),
    }),
    []
  );

  const value = useMemo<FinanceDataContextValue>(
    () => ({ state, dispatch, ...actions }),
    [state, actions]
  );

  return (
    <FinanceDataContext.Provider value={value}>
      {children}
    </FinanceDataContext.Provider>
  );
};
