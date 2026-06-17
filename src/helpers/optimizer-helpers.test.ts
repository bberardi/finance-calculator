import { describe, it, expect } from 'vitest';
import dayjs from 'dayjs';
import {
  evaluatePlan,
  rebalanceAllocation,
  splitAllocations,
  suggestPlans,
} from './optimizer-helpers';
import { Loan } from '../models/loan-model';
import { CompoundingFrequency, Investment } from '../models/investment-model';

const TODAY = new Date(2025, 0, 1);

const loan: Loan = {
  Id: 'loan-1',
  Provider: 'Bank',
  Name: 'Car Loan',
  InterestRate: 9,
  Principal: 20000,
  CurrentAmount: 12000,
  MonthlyPayment: 400,
  StartDate: new Date(2023, 0, 1),
  EndDate: new Date(2028, 0, 1),
};

const loan2: Loan = {
  Id: 'loan-2',
  Provider: 'Credit Union',
  Name: 'Student Loan',
  InterestRate: 5,
  Principal: 30000,
  CurrentAmount: 18000,
  MonthlyPayment: 350,
  StartDate: new Date(2022, 0, 1),
  EndDate: new Date(2032, 0, 1),
};

const investment: Investment = {
  Id: 'inv-1',
  Provider: 'Brokerage',
  Name: 'Index Fund',
  StartDate: new Date(2024, 0, 1),
  StartingBalance: 10000,
  AverageReturnRate: 6,
  CompoundingPeriod: CompoundingFrequency.Monthly,
  CurrentValue: 10000,
};

// Sum a plan's per-target dollar allocations.
const sumAllocations = (allocations: Record<string, number>): number =>
  Object.values(allocations).reduce((sum, amount) => sum + amount, 0);

describe('evaluatePlan', () => {
  it('scores an all-to-loan plan by interest saved and earlier payoff', () => {
    const evaluation = evaluatePlan(
      [loan],
      [investment],
      { label: 'All to Car Loan', allocations: { 'loan-1': 500 } },
      TODAY
    );
    expect(evaluation.interestSaved).toBeGreaterThan(0);
    expect(evaluation.payoffMonthsEarlier).toBeGreaterThan(0);
    // Score credits the interest avoided even when the horizon net worth is flat.
    expect(evaluation.score).toBeGreaterThan(0);
  });

  it('scores an all-to-investment plan by net worth gained', () => {
    const evaluation = evaluatePlan(
      [loan],
      [investment],
      { label: 'All to Index Fund', allocations: { 'inv-1': 500 } },
      TODAY
    );
    expect(evaluation.netWorthDelta).toBeGreaterThan(0);
    expect(evaluation.interestSaved).toBe(0);
    expect(evaluation.payoffMonthsEarlier).toBe(0);
    expect(evaluation.score).toBeGreaterThan(0);
  });

  it('an empty plan has zero impact and score', () => {
    const evaluation = evaluatePlan(
      [loan],
      [investment],
      { label: 'Nothing', allocations: {} },
      TODAY
    );
    expect(evaluation.score).toBe(0);
    expect(evaluation.netWorthDelta).toBe(0);
    expect(evaluation.interestSaved).toBe(0);
    expect(evaluation.payoffMonthsEarlier).toBe(0);
  });

  it('ignores non-positive allocations', () => {
    const evaluation = evaluatePlan(
      [loan],
      [investment],
      { label: 'Zeroes', allocations: { 'loan-1': 0, 'inv-1': -100 } },
      TODAY
    );
    expect(evaluation.score).toBe(0);
  });

  it('measures net worth at the supplied horizon', () => {
    const plan = { label: 'All to Index Fund', allocations: { 'inv-1': 500 } };
    const near = evaluatePlan(
      [loan],
      [investment],
      plan,
      TODAY,
      dayjs(TODAY).add(2, 'year').toDate()
    );
    const far = evaluatePlan(
      [loan],
      [investment],
      plan,
      TODAY,
      dayjs(TODAY).add(20, 'year').toDate()
    );
    // The same contribution compounds more over a longer horizon.
    expect(far.netWorthDelta).toBeGreaterThan(near.netWorthDelta);
  });
});

describe('splitAllocations', () => {
  it('routes Ids to loan payments vs. contributions and drops non-positives', () => {
    const result = splitAllocations([loan, loan2], {
      'loan-1': 200,
      'inv-1': 150,
      'loan-2': 0,
      'unknown-id': -5,
    });
    expect(result.ExtraLoanPayments).toEqual({ 'loan-1': 200 });
    expect(result.ExtraContributions).toEqual({ 'inv-1': 150 });
  });
});

describe('suggestPlans', () => {
  it('returns nothing for a non-positive budget', () => {
    expect(suggestPlans([loan], [investment], 0, {}, TODAY)).toEqual([]);
    expect(suggestPlans([loan], [investment], -100, {}, TODAY)).toEqual([]);
  });

  it('returns nothing when there are no positions to fund', () => {
    expect(suggestPlans([], [], 500, {}, TODAY)).toEqual([]);
  });

  it('ranks every single-target plan when there is only one target', () => {
    const plans = suggestPlans([loan], [], 500, {}, TODAY);
    // One loan → exactly one single-target plan, no splits.
    expect(plans).toHaveLength(1);
    expect(plans[0].plan.label).toBe('All to Car Loan');
    expect(plans[0].plan.allocations).toEqual({ 'loan-1': 500 });
  });

  it('ranks singles plus splits, best score first, each summing to the budget', () => {
    // Two targets with default options: 2 singles + the 10%-grid of splits.
    const plans = suggestPlans([loan, loan2], [], 300, {}, TODAY);
    expect(plans.length).toBeGreaterThan(2);
    // Sorted by score, descending.
    for (let i = 1; i < plans.length; i++) {
      expect(plans[i - 1].score).toBeGreaterThanOrEqual(plans[i].score);
    }
    // Every plan allocates the budget, to the cent.
    for (const plan of plans) {
      expect(sumAllocations(plan.plan.allocations)).toBeCloseTo(300, 2);
    }
    // At least one genuine multi-target split is present, labelled by percentage.
    const splits = plans.filter(
      (p) => Object.keys(p.plan.allocations).length >= 2
    );
    expect(splits.length).toBeGreaterThan(0);
    expect(splits[0].plan.label).toMatch(/%/);
  });

  it('searches three-way splits and preserves an uneven budget to the cent', () => {
    // Three targets with a coarse grid exercises three-way splits (including
    // zero-share legs) and the rounding-drift correction on an uneven budget.
    const plans = suggestPlans(
      [loan, loan2],
      [investment],
      100.05,
      { stepPercent: 25 },
      TODAY
    );
    for (const plan of plans) {
      expect(sumAllocations(plan.plan.allocations)).toBeCloseTo(100.05, 2);
    }
    const threeWay = plans.some(
      (p) => Object.keys(p.plan.allocations).length === 3
    );
    expect(threeWay).toBe(true);
  });
});

describe('rebalanceAllocation', () => {
  it('redistributes the remainder proportionally across the other targets', () => {
    const result = rebalanceAllocation(
      { a: 100, b: 100, c: 200 },
      'a',
      200,
      400
    );
    expect(result.a).toBe(200);
    // Remaining 200 split across b:c in their 100:200 ratio → 66.67 / 133.33.
    expect(result.b).toBeCloseTo(66.67, 2);
    expect(result.c).toBeCloseTo(133.33, 2);
    expect(result.a + result.b + result.c).toBe(400);
  });

  it('distributes evenly when the other targets are all zero', () => {
    const result = rebalanceAllocation({ a: 300, b: 0, c: 0 }, 'a', 0, 300);
    expect(result.a).toBe(0);
    expect(result.b).toBe(150);
    expect(result.c).toBe(150);
  });

  it('clamps the changed value into [0, total]', () => {
    expect(rebalanceAllocation({ a: 50, b: 50 }, 'a', 999, 100).a).toBe(100);
    expect(rebalanceAllocation({ a: 50, b: 50 }, 'a', -20, 100).a).toBe(0);
  });

  it('puts the whole budget on the only target when it stands alone', () => {
    expect(rebalanceAllocation({ a: 40 }, 'a', 25, 100)).toEqual({ a: 100 });
  });

  it('absorbs rounding drift so the split still sums to the total', () => {
    // 99.99 split evenly across two zero-weighted others rounds to 50.00 each,
    // overshooting by a cent; the drift is pulled back off the last target.
    const result = rebalanceAllocation({ a: 0, b: 1, c: 1 }, 'a', 0.01, 100);
    expect(result.a + result.b + result.c).toBeCloseTo(100, 2);
    expect(result.c).toBeCloseTo(49.99, 2);
  });
});
