import { Loan } from '../models/loan-model';
import { Investment } from '../models/investment-model';

// Allocation strategy presets (ROADMAP 8.4): named, pre-built ways to divide a
// monthly extra (or one-time lump) across positions — the counterpart to the
// optimizer's search and the custom split builder. Each preset is a deterministic
// rule, so users can compare whole strategies ("pay down debt" vs "invest" vs
// "balance by rate") at a glance, each scored against the baseline by the same
// evaluatePlan machinery. Pure and framework-free (D7).

const roundToCents = (value: number): number => Math.round(value * 100) / 100;

export type StrategyKind = 'debt' | 'invest' | 'balanced';

export interface StrategyPlan {
  kind: StrategyKind;
  // Human-readable strategy name, used as the scenario name on "view as scenario".
  label: string;
  // Extra $ per target Id, summing to the budget to the cent (same shape the
  // optimizer's AllocationPlan uses, so it scores and overlays identically).
  allocations: Record<string, number>;
}

interface Weighted {
  id: string;
  weight: number;
}

// Distribute `budget` across items in proportion to their non-negative weights,
// rounded to cents, with any rounding drift parked on the largest share so the
// dollars sum to `budget` exactly. When every weight is zero (nothing to weight
// by), split the budget evenly instead. Zero-dollar shares are dropped.
const distributeByWeight = (
  items: Weighted[],
  budget: number
): Record<string, number> => {
  const totalWeight = items.reduce(
    (sum, item) => sum + Math.max(0, item.weight),
    0
  );
  const amounts = items.map((item) =>
    roundToCents(
      totalWeight > 0
        ? (Math.max(0, item.weight) / totalWeight) * budget
        : budget / items.length
    )
  );
  // Park rounding drift on the largest share so Σ == budget to the cent.
  const drift = roundToCents(budget - amounts.reduce((sum, a) => sum + a, 0));
  if (drift !== 0) {
    const largest = amounts.reduce(
      (maxIndex, amount, index) =>
        amount > amounts[maxIndex] ? index : maxIndex,
      0
    );
    amounts[largest] = roundToCents(amounts[largest] + drift);
  }
  const allocations: Record<string, number> = {};
  items.forEach((item, index) => {
    if (amounts[index] > 0) allocations[item.id] = amounts[index];
  });
  return allocations;
};

// The entity with the highest `rate`, or undefined for an empty list. Ties keep
// the first match (stable) so a strategy is deterministic.
const highestBy = <T>(items: T[], rate: (item: T) => number): T | undefined =>
  items.reduce<T | undefined>(
    (best, item) =>
      best === undefined || rate(item) > rate(best) ? item : best,
    undefined
  );

// Build the applicable allocation-strategy presets for a positive `budget`:
//
//  - debt:     the whole budget to the highest-rate loan (avalanche — the
//              interest-minimizing debt target).
//  - invest:   the whole budget to the highest expected-return investment.
//  - balanced: split across every position weighted by its rate (loan APR or
//              investment return). Only emitted with two or more positions, since
//              with one position it would just reproduce an all-to-one preset.
//
// Each emitted preset's allocations sum to `budget` to the cent. Returns [] for a
// non-positive budget or when there are no positions to fund.
export const buildStrategyPlans = (
  loans: Loan[],
  investments: Investment[],
  budget: number
): StrategyPlan[] => {
  if (!(budget > 0)) return [];

  const plans: StrategyPlan[] = [];

  const topLoan = highestBy(loans, (loan) => loan.InterestRate);
  if (topLoan) {
    plans.push({
      kind: 'debt',
      label: 'Debt-focused (highest rate)',
      allocations: { [topLoan.Id]: roundToCents(budget) },
    });
  }

  const topInvestment = highestBy(
    investments,
    (investment) => investment.AverageReturnRate
  );
  if (topInvestment) {
    plans.push({
      kind: 'invest',
      label: 'Investment-focused (highest return)',
      allocations: { [topInvestment.Id]: roundToCents(budget) },
    });
  }

  const weighted: Weighted[] = [
    ...loans.map((loan) => ({ id: loan.Id, weight: loan.InterestRate })),
    ...investments.map((investment) => ({
      id: investment.Id,
      weight: investment.AverageReturnRate,
    })),
  ];
  if (weighted.length >= 2) {
    plans.push({
      kind: 'balanced',
      label: 'Balanced by rate',
      allocations: distributeByWeight(weighted, budget),
    });
  }

  return plans;
};
