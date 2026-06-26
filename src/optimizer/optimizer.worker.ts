/// <reference lib="webworker" />
import { Loan } from '../models/loan-model';
import { Investment } from '../models/investment-model';
import { Asset } from '../models/asset-model';
import {
  PlanEvaluation,
  SuggestOptions,
  suggestPlans,
} from '../helpers/optimizer-helpers';

// Web Worker for the "Next Dollar" optimizer (roadmap 5.2). The suggested-split
// search runs a full multi-entity forecast for every candidate plan, so it must
// stay off the main thread to keep the flagship interaction from janking. The
// D7 purity boundary makes the engine worker-safe — it imports only the pure
// helpers, no React/MUI. Loan/Investment Date fields survive the structured
// clone across postMessage, so no manual revival is needed.

export interface OptimizerRequest {
  // Monotonic id so the hook can ignore results from superseded requests.
  requestId: number;
  loans: Loan[];
  investments: Investment[];
  monthlyExtra: number;
  options?: SuggestOptions;
  today: Date;
  horizon?: Date;
  // Passive holdings (Phase 7); folded into the net-worth anchor the search
  // scores against. Plain data with no Date fields, so structured-clone-safe.
  assets: Asset[];
}

export interface OptimizerResponse {
  requestId: number;
  plans: PlanEvaluation[];
  // Set when the search threw. Routing the failure through this requestId-keyed
  // channel lets the hook drop a stale failure exactly as it drops a stale
  // success, rather than reacting to an uncorrelated main-thread ErrorEvent. (#131)
  error?: boolean;
}

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = (event: MessageEvent<OptimizerRequest>) => {
  const {
    requestId,
    loans,
    investments,
    monthlyExtra,
    options,
    today,
    horizon,
    assets,
  } = event.data;
  try {
    const plans = suggestPlans(
      loans,
      investments,
      monthlyExtra,
      options,
      today,
      horizon,
      assets
    );
    const response: OptimizerResponse = { requestId, plans };
    ctx.postMessage(response);
  } catch {
    // Report a search failure on the same requestId-keyed channel as success, so
    // the hook can ignore it if the request has since been superseded, instead of
    // letting the exception escape to the main thread's onerror where it can't be
    // correlated to this request. (#131)
    const response: OptimizerResponse = { requestId, plans: [], error: true };
    ctx.postMessage(response);
  }
};
