import { describe, it, expect } from 'vitest';
import { evaluatePlan } from './optimizer-helpers';
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
});
