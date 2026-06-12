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
  addInvestment: (investment: Investment) => void;
  updateInvestment: (investment: Investment) => void;
  deleteInvestment: (id: string) => void;
  importMerge: (loans: Loan[], investments: Investment[]) => void;
  enableTestData: (loans: Loan[], investments: Investment[]) => void;
  disableTestData: () => void;
}

export const FinanceDataContext = createContext<
  FinanceDataContextValue | undefined
>(undefined);

export const FinanceDataProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(financeReducer, initialFinanceState);

  const value = useMemo<FinanceDataContextValue>(
    () => ({
      state,
      dispatch,
      addLoan: (loan: Loan) =>
        dispatch({
          type: 'AddLoan',
          loan: { ...loan, Id: loan.Id || generateId() },
        }),
      updateLoan: (loan: Loan) => dispatch({ type: 'UpdateLoan', loan }),
      deleteLoan: (id: string) => dispatch({ type: 'DeleteLoan', id }),
      addInvestment: (investment: Investment) =>
        dispatch({
          type: 'AddInvestment',
          investment: { ...investment, Id: investment.Id || generateId() },
        }),
      updateInvestment: (investment: Investment) =>
        dispatch({ type: 'UpdateInvestment', investment }),
      deleteInvestment: (id: string) =>
        dispatch({ type: 'DeleteInvestment', id }),
      importMerge: (loans: Loan[], investments: Investment[]) =>
        dispatch({ type: 'ImportMerge', loans, investments }),
      enableTestData: (loans: Loan[], investments: Investment[]) =>
        dispatch({ type: 'EnableTestData', loans, investments }),
      disableTestData: () => dispatch({ type: 'DisableTestData' }),
    }),
    [state]
  );

  return (
    <FinanceDataContext.Provider value={value}>
      {children}
    </FinanceDataContext.Provider>
  );
};
