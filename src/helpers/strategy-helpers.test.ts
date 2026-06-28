import { describe, it, expect } from 'vitest';
import { buildStrategyPlans, StrategyPlan } from './strategy-helpers';
import { Loan } from '../models/loan-model';
import { CompoundingFrequency, Investment } from '../models/investment-model';

const makeLoan = (id: string, interestRate: number): Loan => ({
  Id: id,
  Provider: 'Bank',
  Name: `Loan ${id}`,
  InterestRate: interestRate,
  StartDate: new Date(2024, 0, 1),
  EndDate: new Date(2030, 0, 1),
  Principal: 10000,
  CurrentAmount: 8000,
  MonthlyPayment: 200,
});

const makeInvestment = (id: string, returnRate: number): Investment => ({
  Id: id,
  Provider: 'Brokerage',
  Name: `Fund ${id}`,
  StartDate: new Date(2024, 0, 1),
  StartingBalance: 5000,
  AverageReturnRate: returnRate,
  CompoundingPeriod: CompoundingFrequency.Monthly,
  CurrentValue: 5000,
});

// Sum a plan's allocations.
const sum = (plan: StrategyPlan): number =>
  Object.values(plan.allocations).reduce((acc, amount) => acc + amount, 0);

const byKind = (plans: StrategyPlan[], kind: StrategyPlan['kind']) =>
  plans.find((plan) => plan.kind === kind);

describe('buildStrategyPlans', () => {
  it('returns nothing for a non-positive budget', () => {
    expect(buildStrategyPlans([makeLoan('l1', 6)], [], 0)).toEqual([]);
    expect(buildStrategyPlans([makeLoan('l1', 6)], [], -100)).toEqual([]);
  });

  it('returns nothing when there are no positions', () => {
    expect(buildStrategyPlans([], [], 500)).toEqual([]);
  });

  it('sends the whole budget to the highest-rate loan (debt-focused)', () => {
    // Highest rate is l1 (9%) even though it is first and l2 (5%) follows.
    const plans = buildStrategyPlans(
      [makeLoan('l1', 9), makeLoan('l2', 5)],
      [],
      500
    );
    const debt = byKind(plans, 'debt')!;
    expect(debt.allocations).toEqual({ l1: 500 });
    // Two loans, no investments → no separate investment preset.
    expect(byKind(plans, 'invest')).toBeUndefined();
  });

  it('sends the whole budget to the highest-return investment (investment-focused)', () => {
    // Rates ascending so the max is the *second* item (covers the comparison).
    const plans = buildStrategyPlans(
      [],
      [makeInvestment('i1', 6), makeInvestment('i2', 8)],
      500
    );
    const invest = byKind(plans, 'invest')!;
    expect(invest.allocations).toEqual({ i2: 500 });
    // No loans → no debt preset.
    expect(byKind(plans, 'debt')).toBeUndefined();
  });

  it('omits the balanced preset with a single position', () => {
    const plans = buildStrategyPlans([makeLoan('l1', 6)], [], 500);
    expect(plans.map((p) => p.kind)).toEqual(['debt']);
  });

  it('splits the balanced preset across all positions weighted by rate', () => {
    // Loan 9% + investment 6% → weights 9:6 of 500 = 300 / 200.
    const plans = buildStrategyPlans(
      [makeLoan('l1', 9)],
      [makeInvestment('i1', 6)],
      500
    );
    const balanced = byKind(plans, 'balanced')!;
    expect(balanced.allocations).toEqual({ l1: 300, i1: 200 });
    expect(sum(balanced)).toBeCloseTo(500, 2);
  });

  it('every emitted preset allocates the full budget to the cent', () => {
    const plans = buildStrategyPlans(
      [makeLoan('l1', 9), makeLoan('l2', 4)],
      [makeInvestment('i1', 7)],
      300.05
    );
    for (const plan of plans) {
      expect(sum(plan)).toBeCloseTo(300.05, 2);
    }
  });

  it('falls back to an even split when every rate is zero', () => {
    const plans = buildStrategyPlans(
      [makeLoan('l1', 0), makeLoan('l2', 0)],
      [],
      500
    );
    const balanced = byKind(plans, 'balanced')!;
    expect(balanced.allocations).toEqual({ l1: 250, l2: 250 });
  });

  it('drops a zero-rate position from a balanced split that has weighted ones', () => {
    // l1 carries all the weight (10 vs 0), so l2 rounds to $0 and is dropped.
    const plans = buildStrategyPlans(
      [makeLoan('l1', 10), makeLoan('l2', 0)],
      [],
      600
    );
    const balanced = byKind(plans, 'balanced')!;
    expect(balanced.allocations).toEqual({ l1: 600 });
  });

  it('parks rounding drift on the largest share, even when it is not first', () => {
    // Weights 1:1:4 of $100 → 16.67 / 16.67 / 66.67 = 100.01, a one-cent
    // overshoot. The drift is pulled off the largest share (l3, the last one), so
    // the reduce that finds it must keep scanning past index 0 — and the total
    // lands exactly on 100.
    const plans = buildStrategyPlans(
      [makeLoan('l1', 1), makeLoan('l2', 1), makeLoan('l3', 4)],
      [],
      100
    );
    const balanced = byKind(plans, 'balanced')!;
    expect(sum(balanced)).toBe(100);
    expect(balanced.allocations.l3).toBeCloseTo(66.66, 2);
  });
});
