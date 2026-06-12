import { useContext } from 'react';
import {
  FinanceDataContext,
  FinanceDataContextValue,
} from './finance-data-context';

export const useFinanceData = (): FinanceDataContextValue => {
  const context = useContext(FinanceDataContext);
  if (context === undefined) {
    throw new Error('useFinanceData must be used within a FinanceDataProvider');
  }
  return context;
};
