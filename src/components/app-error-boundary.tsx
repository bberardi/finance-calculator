import { ReactNode } from 'react';
import { ErrorBoundary } from './error-boundary';
import { AppErrorFallback } from './app-error-fallback';
import { useFinanceData } from '../state/use-finance-data';
import { downloadJsonExport } from '../data-manager/export-download';

// App-level error boundary wired to the finance-data context (1.4). Lives inside
// the provider so the recovery UI's "export my data" escape hatch can serialize
// the current data. Because this wrapper is the boundary's parent (not its
// child), a crash below it leaves these props at their last good render — so the
// export reflects the data as it was just before the error.
export const AppErrorBoundary = ({ children }: { children: ReactNode }) => {
  const {
    state: {
      loans,
      assets,
      scenarios,
      sampleDataLoaded,
      stashedLoans,
      stashedAssets,
    },
  } = useFinanceData();

  // Export the user's real data, not the sample data shown over it. Investments
  // are folded into assets, so `assets` already carries them.
  const realLoans = sampleDataLoaded ? (stashedLoans ?? []) : loans;
  const realAssets = sampleDataLoaded ? (stashedAssets ?? []) : assets;
  const canExport = realLoans.length > 0 || realAssets.length > 0;

  return (
    <ErrorBoundary
      fallback={({ error }) => (
        <AppErrorFallback
          error={error}
          onReload={() => window.location.reload()}
          onExport={() => downloadJsonExport(realLoans, scenarios, realAssets)}
          canExport={canExport}
        />
      )}
    >
      {children}
    </ErrorBoundary>
  );
};
