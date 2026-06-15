import { describe, it, expect } from 'vitest';
import { computeScenarioImpact } from './scenario-impact-helpers';
import { Loan } from '../models/loan-model';
import { CompoundingFrequency, Investment } from '../models/investment-model';

const TODAY = new Date(2025, 0, 1);

const loan: Loan = {
  Id: 'loan-1',
  Provider: 'Bank',
  Name: 'Car Loan',
  InterestRate: 6,
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

describe('computeScenarioImpact', () => {
  it('an extra loan payment saves interest and moves up the payoff date', () => {
    const impact = computeScenarioImpact(
      [loan],
      [],
      { ExtraLoanPayments: { 'loan-1': 300 } },
      TODAY
    );
    expect(impact.interestSaved).toBeGreaterThan(0);
    expect(impact.payoffMonthsEarlier).toBeGreaterThan(0);
    // Net worth at the horizon is never worse (both loans are paid off by then,
    // and freed payments aren't redirected in v1 — so the gain shows as interest
    // saved + earlier payoff, not a horizon net-worth jump).
    expect(impact.netWorthDelta).toBeGreaterThanOrEqual(0);
  });

  it('an extra contribution raises net worth without touching loan metrics', () => {
    const impact = computeScenarioImpact(
      [loan],
      [investment],
      { ExtraContributions: { 'inv-1': 200 } },
      TODAY
    );
    expect(impact.netWorthDelta).toBeGreaterThan(0);
    expect(impact.interestSaved).toBe(0);
    expect(impact.payoffMonthsEarlier).toBe(0);
  });

  it('an empty scenario has no impact', () => {
    const impact = computeScenarioImpact([loan], [investment], {}, TODAY);
    expect(impact.netWorthDelta).toBe(0);
    expect(impact.interestSaved).toBe(0);
    expect(impact.payoffMonthsEarlier).toBe(0);
  });

  it('reports no payoff change when there are no loans', () => {
    const impact = computeScenarioImpact(
      [],
      [investment],
      { ExtraContributions: { 'inv-1': 100 } },
      TODAY
    );
    expect(impact.payoffMonthsEarlier).toBe(0);
    expect(impact.interestSaved).toBe(0);
  });
});
