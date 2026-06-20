import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFinanceData } from '../state/use-finance-data';
import {
  SaveStatus,
  clearData,
  isPersistenceEnabled,
  loadData,
  saveData,
  setPersistenceEnabled,
} from '../helpers/storage-helpers';

// Wait for typing to settle before writing, so a burst of edits is one save.
const AUTO_SAVE_DEBOUNCE_MS = 800;

export type PersistenceFeedback = {
  severity: 'success' | 'error';
  message: string;
};

export interface PersistenceController {
  enabled: boolean;
  toggle: () => void;
  feedback: PersistenceFeedback | null;
  clearFeedback: () => void;
}

// Owns the "save on this device" behavior (Phase 1.2, issue #20): the persisted
// on/off preference, one-time hydration on load, debounced auto-save while on,
// and clearing storage when turned off. The pure storage I/O lives in
// `storage-helpers` (D7); this hook is the thin React layer that wires it to the
// finance-data context and surfaces snackbar feedback. Render it from exactly
// one place so hydration and auto-save run once.
export const usePersistence = (): PersistenceController => {
  const { state, importMerge } = useFinanceData();
  const {
    loans,
    investments,
    assets,
    scenarios,
    sampleDataLoaded,
    stashedLoans,
    stashedInvestments,
    stashedAssets,
  } = state;

  const [enabled, setEnabled] = useState<boolean>(() => isPersistenceEnabled());
  const [feedback, setFeedback] = useState<PersistenceFeedback | null>(null);

  // Persist the user's *real* data only — never the sample data shown while the
  // onboarding banner is up (the reducer parks real data in the stash then).
  // Memoized so the auto-save effect/toggle depend on stable references and
  // re-run only when the real data actually changes.
  const realLoans = useMemo(
    () => (sampleDataLoaded ? (stashedLoans ?? []) : loans),
    [sampleDataLoaded, stashedLoans, loans]
  );
  const realInvestments = useMemo(
    () => (sampleDataLoaded ? (stashedInvestments ?? []) : investments),
    [sampleDataLoaded, stashedInvestments, investments]
  );
  const realAssets = useMemo(
    () => (sampleDataLoaded ? (stashedAssets ?? []) : assets),
    [sampleDataLoaded, stashedAssets, assets]
  );

  // Hydrate once on mount when persistence is on. Initial context state is
  // empty, so a merge is effectively a load; the ref makes it run a single time
  // (StrictMode double-invokes effects, and the merge is idempotent regardless).
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current) {
      return;
    }
    hydratedRef.current = true;
    if (isPersistenceEnabled()) {
      const loaded = loadData();
      if (loaded) {
        importMerge(
          loaded.loans,
          loaded.investments,
          loaded.scenarios,
          loaded.assets
        );
      }
    }
  }, [importMerge]);

  // Translate a non-success save outcome into user-facing feedback. A 'saved'
  // status is silent during auto-save (no snackbar on every keystroke).
  const reportSaveProblem = useCallback((status: SaveStatus) => {
    if (status === 'quota-exceeded') {
      setFeedback({
        severity: 'error',
        message:
          'This device is out of storage space — your latest changes could not be saved.',
      });
    } else if (status === 'unavailable') {
      setFeedback({
        severity: 'error',
        message: 'Saving on this device isn’t available in this browser.',
      });
    }
  }, []);

  // Debounced auto-save while enabled. Re-runs only when the real data changes
  // (stable references otherwise), so a fresh edit cancels the pending save and
  // reschedules — coalescing a burst of edits into a single write.
  useEffect(() => {
    if (!enabled) {
      return;
    }
    const handle = setTimeout(() => {
      reportSaveProblem(
        saveData(realLoans, realInvestments, scenarios, realAssets)
      );
    }, AUTO_SAVE_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [
    enabled,
    realLoans,
    realInvestments,
    scenarios,
    realAssets,
    reportSaveProblem,
  ]);

  const toggle = useCallback(() => {
    const next = !enabled;
    setEnabled(next);
    setPersistenceEnabled(next);
    if (next) {
      // Save immediately on enable so a reload right away still restores data.
      const status = saveData(
        realLoans,
        realInvestments,
        scenarios,
        realAssets
      );
      if (status === 'saved') {
        setFeedback({
          severity: 'success',
          message: 'Your data will be saved on this device.',
        });
      } else {
        reportSaveProblem(status);
      }
    } else {
      // Disabling clears the stored copy (issue #20).
      clearData();
      setFeedback({
        severity: 'success',
        message: 'Saved data cleared from this device.',
      });
    }
  }, [
    enabled,
    realLoans,
    realInvestments,
    scenarios,
    realAssets,
    reportSaveProblem,
  ]);

  const clearFeedback = useCallback(() => setFeedback(null), []);

  return { enabled, toggle, feedback, clearFeedback };
};
