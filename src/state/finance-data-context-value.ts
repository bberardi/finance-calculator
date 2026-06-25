import { createContext, Dispatch } from 'react';
import { Loan } from '../models/loan-model';
import { Asset } from '../models/asset-model';
import { Scenario } from '../models/scenario-model';
import { DataSnapshot, FinanceAction, FinanceState } from './finance-reducer';

// The finance-data context object and the shape of its value. Kept in this
// (component-free) module, separate from the FinanceDataProvider component, so
// that the provider file exports only a component and stays compatible with
// React Fast Refresh (the react-refresh/only-export-components rule).
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
