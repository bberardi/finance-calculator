import { createContext, Dispatch, ReactNode, useMemo, useReducer } from 'react';
import { Loan } from '../models/loan-model';
import { Asset } from '../models/asset-model';
import { Scenario } from '../models/scenario-model';
import { generateId } from '../helpers/id-helpers';
import {
  DataSnapshot,
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
  // Asset actions (Phase 7; investments are folded in as AssetType.Investment).
  // Id assignment happens here so the reducer stays pure.
  addAsset: (asset: Asset) => void;
  updateAsset: (asset: Asset) => void;
  deleteAsset: (id: string) => void;
  // Undo an asset delete by restoring it at its original index.
  insertAssetAt: (asset: Asset, index: number) => void;
  importMerge: (
    loans: Loan[],
    scenarios?: Scenario[],
    assets?: Asset[]
  ) => void;
  // Undo an import merge by restoring a pre-merge snapshot (roadmap 6.3).
  restoreData: (snapshot: DataSnapshot) => void;
  loadSampleData: (loans: Loan[], assets: Asset[]) => void;
  clearSampleData: () => void;
  // Scenario actions (Phase 4). addScenario assigns an Id and returns it so the
  // caller can immediately make the new scenario active.
  addScenario: (scenario: Scenario) => string;
  updateScenario: (scenario: Scenario) => void;
  deleteScenario: (id: string) => void;
  setActiveScenario: (id: string | null) => void;
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
      addAsset: (asset: Asset) =>
        dispatch({
          type: 'AddAsset',
          asset: { ...asset, Id: asset.Id || generateId() },
        }),
      updateAsset: (asset: Asset) => dispatch({ type: 'UpdateAsset', asset }),
      deleteAsset: (id: string) => dispatch({ type: 'DeleteAsset', id }),
      insertAssetAt: (asset: Asset, index: number) =>
        dispatch({ type: 'InsertAssetAt', asset, index }),
      importMerge: (loans: Loan[], scenarios?: Scenario[], assets?: Asset[]) =>
        dispatch({
          type: 'ImportMerge',
          loans,
          scenarios,
          assets,
        }),
      restoreData: (snapshot: DataSnapshot) =>
        dispatch({ type: 'RestoreData', snapshot }),
      loadSampleData: (loans: Loan[], assets: Asset[]) =>
        dispatch({ type: 'LoadSampleData', loans, assets }),
      clearSampleData: () => dispatch({ type: 'ClearSampleData' }),
      addScenario: (scenario: Scenario) => {
        const id = scenario.Id || generateId();
        dispatch({ type: 'AddScenario', scenario: { ...scenario, Id: id } });
        return id;
      },
      updateScenario: (scenario: Scenario) =>
        dispatch({ type: 'UpdateScenario', scenario }),
      deleteScenario: (id: string) => dispatch({ type: 'DeleteScenario', id }),
      setActiveScenario: (id: string | null) =>
        dispatch({ type: 'SetActiveScenario', id }),
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
