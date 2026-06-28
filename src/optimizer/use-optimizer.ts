import { useEffect, useRef, useState } from 'react';
import { Loan } from '../models/loan-model';
import { Investment } from '../models/investment-model';
import { Asset } from '../models/asset-model';
import { AllocationMode, PlanEvaluation } from '../helpers/optimizer-helpers';
import type { OptimizerRequest, OptimizerResponse } from './optimizer.worker';

interface UseOptimizerArgs {
  loans: Loan[];
  investments: Investment[];
  monthlyExtra: number;
  today: Date;
  horizon: Date;
  assets: Asset[];
  // Recurring monthly extra vs. one-time lump (Phase 8.2).
  mode: AllocationMode;
}

interface OptimizerResult {
  plans: PlanEvaluation[];
  loading: boolean;
  // True when the worker failed, so the UI can report it instead of showing a
  // spinner that never resolves. Cleared when a new search starts.
  error: boolean;
}

const DEBOUNCE_MS = 250;

// Drives the optimizer Web Worker (roadmap 5.2/5.3): posts the current budget,
// positions, and horizon to the worker (debounced so typing a dollar amount
// doesn't fire a search per keystroke) and returns the ranked plans. Stale
// responses are dropped by request id so a slow earlier search can't overwrite
// a newer result.
export const useOptimizer = ({
  loans,
  investments,
  monthlyExtra,
  today,
  horizon,
  assets,
  mode,
}: UseOptimizerArgs): OptimizerResult => {
  const [plans, setPlans] = useState<PlanEvaluation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);

  // One worker per mount, torn down on unmount.
  useEffect(() => {
    const worker = new Worker(
      new URL('./optimizer.worker.ts', import.meta.url),
      { type: 'module' }
    );
    worker.onmessage = (event: MessageEvent<OptimizerResponse>) => {
      // Ignore results for any request newer work has already superseded.
      if (event.data.requestId !== requestIdRef.current) return;
      if (event.data.error) {
        // The search failed for the current request; surface it, keep no plans.
        setError(true);
        setLoading(false);
        return;
      }
      setPlans(event.data.plans);
      setLoading(false);
    };
    // Last-resort net for failures that never produce a response message — a
    // worker module-load failure, or onmessageerror on an undeserializable
    // message. A suggestPlans throw is reported through the requestId-keyed
    // onmessage channel above (so it can be dropped if stale); these events carry
    // no requestId, but `loading` is only ever true while a request is in flight,
    // so clearing it and surfacing the error here is safe. (#131)
    const handleWorkerFailure = () => {
      setLoading(false);
      setError(true);
    };
    worker.onerror = handleWorkerFailure;
    worker.onmessageerror = handleWorkerFailure;
    workerRef.current = worker;
    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const hasPositions = loans.length + investments.length > 0;
    if (!(monthlyExtra > 0) || !hasPositions) {
      // Cancel any in-flight result and clear the table.
      requestIdRef.current += 1;
      setPlans([]);
      setLoading(false);
      setError(false);
      return;
    }

    const worker = workerRef.current;
    if (!worker) return;

    setLoading(true);
    setError(false);
    const requestId = (requestIdRef.current += 1);
    const handle = window.setTimeout(() => {
      const request: OptimizerRequest = {
        requestId,
        loans,
        investments,
        monthlyExtra,
        today,
        horizon,
        assets,
        mode,
      };
      try {
        worker.postMessage(request);
      } catch {
        // A non-cloneable message would throw here synchronously, outside the
        // worker's onerror handler; clear the spinner directly so it can't
        // stick. (#131)
        setLoading(false);
        setError(true);
      }
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(handle);
  }, [loans, investments, monthlyExtra, today, horizon, assets, mode]);

  return { plans, loading, error };
};
