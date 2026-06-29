import dayjs from 'dayjs';
import { Loan } from '../models/loan-model';
import { Investment } from '../models/investment-model';
import { Asset } from '../models/asset-model';
import { forecastInvestment, forecastLoan } from './forecast-helpers';
import { NetWorthMilestone, computeMilestones } from './milestone-helpers';
import { AllocationMode, splitAllocations } from './optimizer-helpers';

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

// One strategy's outcome in the side-by-side comparison (ROADMAP 8.5).
export interface StrategyComparison {
  // The strategy, or 'baseline' for the do-nothing reference column.
  kind: StrategyKind | 'baseline';
  label: string;
  // Net worth at +5y / +10y / +30y (absolute), straight from computeMilestones so
  // it agrees with the dashboard's milestones.
  netWorthAt: NetWorthMilestone[];
  // Projected debt-free date under the strategy, or undefined if debt isn't
  // cleared within the milestone horizon (or there are no loans).
  debtFreeDate?: Date;
  // The end-state split that actually differs by strategy: investment value vs.
  // debt remaining at the +30y horizon (passive assets are identical across
  // strategies, so they are a constant backdrop and omitted here).
  finalInvestments: number;
  finalDebt: number;
}

// Compare the baseline against every applicable strategy preset (ROADMAP 8.5):
// for each, net worth at +5/+10/+30y, the debt-free date, and the final
// investments-vs-debt split — so a user can weigh whole strategies side by side.
// Reuses computeMilestones (net worth + debt-free) and the same forecast engine
// the chart and optimizer use, so the figures match everywhere. Pure (D7).
// Returns [] for a non-positive budget.
export const compareStrategies = (
  loans: Loan[],
  investments: Investment[],
  assets: Asset[],
  budget: number,
  mode: AllocationMode,
  today: Date = new Date()
): StrategyComparison[] => {
  if (!(budget > 0)) return [];

  const horizon = dayjs(today).add(30, 'year').toDate();

  const plans: {
    kind: StrategyKind | 'baseline';
    label: string;
    allocations: Record<string, number>;
  }[] = [
    { kind: 'baseline', label: 'Baseline (no extra)', allocations: {} },
    ...buildStrategyPlans(loans, investments, budget),
  ];

  return plans.map((plan) => {
    const scenario = splitAllocations(loans, plan.allocations, mode);
    const { netWorthAt, debtFreeDate } = computeMilestones(
      loans,
      investments,
      today,
      assets,
      scenario
    );
    const finalInvestments = roundToCents(
      investments.reduce((sum, investment) => {
        const series = forecastInvestment(
          investment,
          horizon,
          scenario.ExtraContributions[investment.Id] ?? 0,
          today,
          scenario.OneTimeContributions[investment.Id] ?? 0
        );
        return sum + series[series.length - 1].Value;
      }, 0)
    );
    const finalDebt = roundToCents(
      loans.reduce((sum, loan) => {
        const series = forecastLoan(
          loan,
          horizon,
          scenario.ExtraLoanPayments[loan.Id] ?? 0,
          today,
          scenario.OneTimeLoanPayments[loan.Id] ?? 0
        );
        return sum + series[series.length - 1].Value;
      }, 0)
    );
    return {
      kind: plan.kind,
      label: plan.label,
      netWorthAt,
      debtFreeDate,
      finalInvestments,
      finalDebt,
    };
  });
};
