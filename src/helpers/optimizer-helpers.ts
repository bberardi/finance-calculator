import { Loan } from '../models/loan-model';
import { Investment } from '../models/investment-model';
import { ScenarioInput } from '../models/forecast-model';
import { computeScenarioImpact } from './scenario-impact-helpers';

// The "Next Dollar" optimizer engine (Phase 5). An allocation plan splits $X/mo
// across any number of loans/investments; evaluatePlan scores it against the
// baseline using the same forecast engine the chart and scenarios use. Pure and
// framework-free (D7) so the Phase 5.2 search can run in a Web Worker.
//
// A single-target plan is the degenerate 100%-to-one case. v1 does NOT redirect
// a loan's freed payment after payoff (the "snowball" mode reserved for later) —
// see the score note below for how the ranking still values debt payoff.

const roundToCents = (value: number): number => Math.round(value * 100) / 100;

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

// Split a plan's allocations into the engine's loan/contribution maps, dropping
// non-positive amounts. An Id that matches no loan is treated as a contribution
// target (and simply does nothing if it matches no investment either). Exported
// so the UI can turn a chosen plan into a Scenario without duplicating the rule.
export const splitAllocations = (
  loans: Loan[],
  allocations: Record<string, number>
): Required<ScenarioInput> => {
  const loanIds = new Set(loans.map((loan) => loan.Id));
  const ExtraLoanPayments: Record<string, number> = {};
  const ExtraContributions: Record<string, number> = {};
  for (const [id, amount] of Object.entries(allocations)) {
    if (!(amount > 0)) continue;
    if (loanIds.has(id)) {
      ExtraLoanPayments[id] = amount;
    } else {
      ExtraContributions[id] = amount;
    }
  }
  return { ExtraLoanPayments, ExtraContributions };
};

export const evaluatePlan = (
  loans: Loan[],
  investments: Investment[],
  plan: AllocationPlan,
  today: Date = new Date(),
  horizon?: Date
): PlanEvaluation => {
  const scenario = splitAllocations(loans, plan.allocations);
  const impact = computeScenarioImpact(
    loans,
    investments,
    scenario,
    today,
    horizon
  );
  return {
    plan,
    netWorthDelta: impact.netWorthDelta,
    interestSaved: impact.interestSaved,
    payoffMonthsEarlier: impact.payoffMonthsEarlier,
    score: roundToCents(impact.netWorthDelta + impact.interestSaved),
  };
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
  horizon?: Date
): PlanEvaluation[] => {
  if (!(monthlyExtra > 0)) return [];

  const stepPercent = options.stepPercent ?? DEFAULT_STEP_PERCENT;
  const maxCandidates = options.maxCandidates ?? DEFAULT_MAX_CANDIDATES;

  const targets: Target[] = [
    ...loans.map((loan) => ({ id: loan.Id, name: loan.Name })),
    ...investments.map((inv) => ({ id: inv.Id, name: inv.Name })),
  ];
  if (targets.length === 0) return [];

  const evaluate = (plan: AllocationPlan): PlanEvaluation =>
    evaluatePlan(loans, investments, plan, today, horizon);

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

  // Absorb rounding drift on the last other target so Σ == total exactly.
  const drift = roundToCents(
    total - Object.values(result).reduce((sum, amount) => sum + amount, 0)
  );
  if (drift !== 0) {
    const last = otherIds[otherIds.length - 1];
    result[last] = roundToCents(result[last] + drift);
  }

  return result;
};
