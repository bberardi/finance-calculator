import { Loan } from '../models/loan-model';
import { Investment } from '../models/investment-model';
import { Asset } from '../models/asset-model';
import { ScenarioInput } from '../models/forecast-model';
import {
  ScenarioBaseline,
  ScenarioImpact,
  computeScenarioBaseline,
  computeScenarioImpact,
  computeScenarioImpactWithBaseline,
} from './scenario-impact-helpers';

// The "Next Dollar" optimizer engine (Phase 5). An allocation plan splits $X/mo
// across any number of loans/investments; evaluatePlan scores it against the
// baseline using the same forecast engine the chart and scenarios use. Pure and
// framework-free (D7) so the Phase 5.2 search can run in a Web Worker.
//
// A single-target plan is the degenerate 100%-to-one case. v1 does NOT redirect
// a loan's freed payment after payoff (the "snowball" mode reserved for later) —
// see the score note below for how the ranking still values debt payoff.

export const roundToCents = (value: number): number =>
  Math.round(value * 100) / 100;

export interface AllocationPlan {
  // Human-readable description, e.g. "All to Car Loan" or "50% Car Loan / 50% 401k".
  label: string;
  // Extra $/month per target Id (a loan or an investment).
  allocations: Record<string, number>;
}

export interface PlanEvaluation {
  plan: AllocationPlan;
  // Net worth at the forecast horizon vs. baseline.
  netWorthDelta: number;
  // Lifetime loan interest avoided vs. baseline.
  interestSaved: number;
  // Months the projected debt-free date moves earlier.
  payoffMonthsEarlier: number;
  // Ranking objective: net worth gained PLUS interest saved. Net worth at the
  // horizon alone undervalues paying off a loan that's already cleared by then
  // (v1 doesn't redirect the freed payment), so interest avoided — real money
  // that stayed with the user — is added so high-rate debt payoff ranks fairly
  // against investing.
  score: number;
}

// A target the extra money can go toward: a loan (extra principal) or an
// investment (extra contribution). Carries the name so the search can label
// plans without re-deriving it.
interface Target {
  id: string;
  name: string;
}

// What the budget being optimized represents: a recurring monthly extra
// ('monthly', Phase 5) or a single lump sum applied now ('oneTime', Phase 8.2 —
// "where does a $5k bonus go?"). The search, baseline, and scoring are identical
// across modes; only which scenario maps the allocations land in differs.
export type AllocationMode = 'monthly' | 'oneTime';

// Split a plan's allocations into the engine's loan/contribution maps, dropping
// non-positive amounts. An Id that matches no loan is treated as a contribution
// target (and simply does nothing if it matches no investment either). In
// 'oneTime' mode the amounts land in the OneTime* maps (a lump applied at the
// first forecast month) instead of the recurring Extra* maps. The unused pair is
// always returned empty so the result is a complete ScenarioInput. Exported so
// the UI can turn a chosen plan into a Scenario without duplicating the rule.
export const splitAllocations = (
  loans: Loan[],
  allocations: Record<string, number>,
  mode: AllocationMode = 'monthly'
): Required<ScenarioInput> => {
  const loanIds = new Set(loans.map((loan) => loan.Id));
  const ExtraLoanPayments: Record<string, number> = {};
  const ExtraContributions: Record<string, number> = {};
  const OneTimeLoanPayments: Record<string, number> = {};
  const OneTimeContributions: Record<string, number> = {};
  const loanMap = mode === 'oneTime' ? OneTimeLoanPayments : ExtraLoanPayments;
  const contributionMap =
    mode === 'oneTime' ? OneTimeContributions : ExtraContributions;
  for (const [id, amount] of Object.entries(allocations)) {
    if (!(amount > 0)) continue;
    if (loanIds.has(id)) {
      loanMap[id] = amount;
    } else {
      contributionMap[id] = amount;
    }
  }
  return {
    ExtraLoanPayments,
    ExtraContributions,
    OneTimeLoanPayments,
    OneTimeContributions,
  };
};

// Assemble a PlanEvaluation from a plan and its computed impact, applying the
// ranking objective (see PlanEvaluation.score). Shared by the single-plan
// evaluatePlan and the many-plan suggestPlans search.
const toEvaluation = (
  plan: AllocationPlan,
  impact: ScenarioImpact
): PlanEvaluation => ({
  plan,
  netWorthDelta: impact.netWorthDelta,
  interestSaved: impact.interestSaved,
  payoffMonthsEarlier: impact.payoffMonthsEarlier,
  score: roundToCents(impact.netWorthDelta + impact.interestSaved),
});

export const evaluatePlan = (
  loans: Loan[],
  investments: Investment[],
  plan: AllocationPlan,
  today: Date = new Date(),
  horizon?: Date,
  assets: Asset[] = [],
  mode: AllocationMode = 'monthly'
): PlanEvaluation => {
  const scenario = splitAllocations(loans, plan.allocations, mode);
  const impact = computeScenarioImpact(
    loans,
    investments,
    scenario,
    today,
    horizon,
    assets
  );
  return toEvaluation(plan, impact);
};

// Knobs for the suggested-split search (engine parameters, per roadmap 5.2).
export interface SuggestOptions {
  // Granularity of the split grid, in percent (default 10 → 10% steps).
  stepPercent?: number;
  // How many top single-target plans to grid-search splits across (default 3).
  maxCandidates?: number;
}

const DEFAULT_STEP_PERCENT = 10;
const DEFAULT_MAX_CANDIDATES = 3;

// Hard upper bounds on the split search so it stays tractable regardless of the
// caller's SuggestOptions (#134). The grid enumerates integer compositions of
// (100 / stepPercent) across the split targets and runs a full multi-entity
// forecast per composition, so a fine step over several targets blows up
// combinatorially — e.g. stepPercent 1 with 5 targets is C(104, 4) ≈ 4.6M
// forecasts, which would pin the worker indefinitely. Cap the number of split
// targets and floor the step so the composition count stays within
// MAX_SPLIT_GRID_POINTS. The defaults (10% / 3 candidates → 66 compositions) sit
// far inside these bounds, so normal use is unaffected.
const MAX_SPLIT_CANDIDATES = 4;
const MAX_SPLIT_GRID_POINTS = 1000;

// The split grid only sums to a true 100% when the step evenly divides 100;
// otherwise `Math.round(100 / step) * step` lands short (e.g. step=7 → 98%),
// drifting the displayed splitLabel percentages and share ratios away from a
// real 100% split. Snap any requested step to the nearest exact divisor of 100
// so the grid, the labels, and the ratios always represent a clean 100%. (#95)
const STEP_DIVISORS = [1, 2, 4, 5, 10, 20, 25, 50, 100];
const normalizeStepPercent = (requested: number): number => {
  if (!(requested > 0)) return DEFAULT_STEP_PERCENT;
  return STEP_DIVISORS.reduce((best, divisor) =>
    Math.abs(divisor - requested) < Math.abs(best - requested) ? divisor : best
  );
};

// Number of integer compositions of `steps` over `parts` parts:
// C(steps + parts - 1, parts - 1). Computed multiplicatively (exact for the
// small, clamped inputs here) so the grid can be sized without enumerating it.
const compositionCount = (steps: number, parts: number): number => {
  let count = 1;
  for (let i = 1; i < parts; i++) {
    count = (count * (steps + i)) / i;
  }
  return count;
};

// Finest divisor of 100 whose composition grid over `parts` targets fits within
// MAX_SPLIT_GRID_POINTS. Seeded with the coarsest divisor (100 → grid size
// `parts`, which always fits), so it always returns a clean divisor of 100. (#134)
const minFittingStepPercent = (parts: number): number =>
  STEP_DIVISORS.reduce(
    (finest, divisor) =>
      compositionCount(100 / divisor, parts) <= MAX_SPLIT_GRID_POINTS
        ? Math.min(finest, divisor)
        : finest,
    100
  );

// Every ordered list of `parts` non-negative integers that sum to `total`
// (integer compositions including zeros), e.g. total=10, parts=2 →
// [10,0],[9,1],…,[0,10]. Used to enumerate the percentage grid over candidates.
const integerCompositions = (total: number, parts: number): number[][] => {
  if (parts === 1) return [[total]];
  const result: number[][] = [];
  for (let first = 0; first <= total; first++) {
    for (const rest of integerCompositions(total - first, parts - 1)) {
      result.push([first, ...rest]);
    }
  }
  return result;
};

// Turn a percentage split over targets into a dollar allocation that sums
// exactly to `monthlyExtra`. Each share is rounded to cents and the largest
// share absorbs the rounding remainder so the total is preserved to the cent.
const sharesToAllocations = (
  targets: Target[],
  shares: number[],
  monthlyExtra: number
): Record<string, number> => {
  const amounts = shares.map((share) =>
    roundToCents((share / 100) * monthlyExtra)
  );
  // Push any rounding drift onto the largest share so Σ == monthlyExtra exactly.
  const drift = roundToCents(
    monthlyExtra - amounts.reduce((sum, amount) => sum + amount, 0)
  );
  if (drift !== 0) {
    const largest = amounts.reduce(
      (maxIndex, amount, index) =>
        amount > amounts[maxIndex] ? index : maxIndex,
      0
    );
    amounts[largest] = roundToCents(amounts[largest] + drift);
  }
  const allocations: Record<string, number> = {};
  targets.forEach((target, index) => {
    if (amounts[index] > 0) allocations[target.id] = amounts[index];
  });
  return allocations;
};

// Label a multi-target split, e.g. "60% Car Loan / 40% 401(k)".
const splitLabel = (targets: Target[], shares: number[]): string =>
  targets
    .map((target, index) => ({ target, share: shares[index] }))
    .filter(({ share }) => share > 0)
    .map(({ target, share }) => `${share}% ${target.name}`)
    .join(' / ');

// Suggested-split search (roadmap 5.2): rank every single-target plan (all $X to
// one position), then grid-search splits at `stepPercent` granularity across the
// top `maxCandidates` single-target plans, and return everything ranked best
// score first. Keeping the grid to the top few candidates keeps the search space
// tractable while still catching the cases where a split genuinely beats all-in-
// one (e.g. kill a small high-rate loan, rest to investments). Pure (D7) so it
// runs in a Web Worker off the main thread.
export const suggestPlans = (
  loans: Loan[],
  investments: Investment[],
  monthlyExtra: number,
  options: SuggestOptions = {},
  today: Date = new Date(),
  horizon?: Date,
  assets: Asset[] = [],
  // Whether `monthlyExtra` is a recurring monthly amount or a one-time lump
  // (Phase 8.2). Only changes which scenario maps each plan targets; the search,
  // baseline, scoring, and ranking are mode-agnostic.
  mode: AllocationMode = 'monthly'
): PlanEvaluation[] => {
  if (!(monthlyExtra > 0)) return [];

  const requestedStep = normalizeStepPercent(
    options.stepPercent ?? DEFAULT_STEP_PERCENT
  );
  // Clamp candidate count to a small bound so the split grid can't explode; the
  // floor/min collapse a fractional, zero, or negative request into range. (#134)
  const maxCandidates = Math.min(
    Math.max(1, Math.floor(options.maxCandidates ?? DEFAULT_MAX_CANDIDATES)),
    MAX_SPLIT_CANDIDATES
  );

  const targets: Target[] = [
    ...loans.map((loan) => ({ id: loan.Id, name: loan.Name })),
    ...investments.map((inv) => ({ id: inv.Id, name: inv.Name })),
  ];
  if (targets.length === 0) return [];

  // The baseline is identical for every candidate (it has no extra payments),
  // so compute it once and score each plan against it instead of re-forecasting
  // the baseline ~70 times across the split grid.
  const baseline: ScenarioBaseline = computeScenarioBaseline(
    loans,
    investments,
    today,
    horizon,
    assets
  );

  const evaluate = (plan: AllocationPlan): PlanEvaluation => {
    const scenario = splitAllocations(loans, plan.allocations, mode);
    const impact = computeScenarioImpactWithBaseline(
      loans,
      investments,
      scenario,
      baseline,
      today,
      assets
    );
    return toEvaluation(plan, impact);
  };

  // 1. Single-target plans: all $X to one position.
  const singles = targets.map((target) =>
    evaluate({
      label: `All to ${target.name}`,
      allocations: { [target.id]: monthlyExtra },
    })
  );

  const evaluations: PlanEvaluation[] = [...singles];

  // 2. Grid-search splits across the strongest single-target candidates.
  const topTargets = [...singles]
    .sort((a, b) => b.score - a.score)
    .slice(0, maxCandidates)
    .map((evaluation) => {
      const id = Object.keys(evaluation.plan.allocations)[0];
      return targets.find((target) => target.id === id)!;
    });

  if (topTargets.length >= 2) {
    // Floor the requested step so the composition grid over the actual number of
    // split targets stays within budget — a fine step is coarsened, never the
    // reverse, so an explicit coarse request is still honored. (#134)
    const stepPercent = Math.max(
      requestedStep,
      minFittingStepPercent(topTargets.length)
    );
    const steps = Math.round(100 / stepPercent);
    for (const composition of integerCompositions(steps, topTargets.length)) {
      const shares = composition.map((part) => part * stepPercent);
      // Only genuine splits — at least two non-zero shares (singles already done,
      // and a single-share composition is just a single-target plan again).
      if (shares.filter((share) => share > 0).length < 2) continue;
      const allocations = sharesToAllocations(topTargets, shares, monthlyExtra);
      evaluations.push(
        evaluate({ label: splitLabel(topTargets, shares), allocations })
      );
    }
  }

  return evaluations.sort((a, b) => b.score - a.score);
};

// Rebalance a custom split so the total stays fixed at `total` after the user
// moves one target (roadmap 5.4). The changed target is clamped to [0, total]
// and the remainder is distributed across the OTHER targets — proportionally to
// their current values, or evenly when they are all zero — so the split always
// sums to `total`. Pure and tested; the slider UI is a thin shell over this.
export const rebalanceAllocation = (
  values: Record<string, number>,
  changedId: string,
  newValue: number,
  total: number
): Record<string, number> => {
  const ids = Object.keys(values);
  const clamped = Math.max(0, Math.min(roundToCents(newValue), total));
  const otherIds = ids.filter((id) => id !== changedId);

  // With no other targets to absorb the remainder, the lone target must hold
  // the entire budget so the split still sums to `total`.
  if (otherIds.length === 0) {
    return { [changedId]: total };
  }

  const result: Record<string, number> = { [changedId]: clamped };
  const remaining = roundToCents(total - clamped);

  const othersSum = otherIds.reduce((sum, id) => sum + values[id], 0);
  otherIds.forEach((id) => {
    const share =
      othersSum > 0
        ? (values[id] / othersSum) * remaining
        : remaining / otherIds.length;
    result[id] = roundToCents(share);
  });

  // Absorb rounding drift so Σ == total exactly. Park it on the LARGEST other
  // target (mirroring sharesToAllocations) and clamp at 0: dumping a negative
  // cent on the last target unconditionally could push a target whose share
  // rounded to ~0 down to a transient -0.01. The largest non-zero target can
  // always absorb a sub-cent drift without going negative. (#95)
  const drift = roundToCents(
    total - Object.values(result).reduce((sum, amount) => sum + amount, 0)
  );
  if (drift !== 0) {
    const largest = otherIds.reduce(
      (maxId, id) => (result[id] > result[maxId] ? id : maxId),
      otherIds[0]
    );
    result[largest] = Math.max(0, roundToCents(result[largest] + drift));
  }

  return result;
};
