import { useEffect, useRef, useState } from 'react';
import { Loan } from '../models/loan-model';
import { Investment } from '../models/investment-model';
import { Asset } from '../models/asset-model';
import { PlanEvaluation } from '../helpers/optimizer-helpers';
import type { OptimizerRequest, OptimizerResponse } from './optimizer.worker';

interface UseOptimizerArgs {
  loans: Loan[];
  investments: Investment[];
  monthlyExtra: number;
  today: Date;
  horizon: Date;
  assets: Asset[];
}

interface OptimizerResult {
  plans: PlanEvaluation[];
  loading: boolean;
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
}: UseOptimizerArgs): OptimizerResult => {
  const [plans, setPlans] = useState<PlanEvaluation[]>([]);
  const [loading, setLoading] = useState(false);
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
      setPlans(event.data.plans);
      setLoading(false);
    };
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
      return;
    }

    const worker = workerRef.current;
    if (!worker) return;

    setLoading(true);
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
      };
      worker.postMessage(request);
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(handle);
  }, [loans, investments, monthlyExtra, today, horizon, assets]);

  return { plans, loading };
};
