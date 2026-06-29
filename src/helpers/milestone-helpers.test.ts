import { describe, it, expect } from 'vitest';
import { computeMilestones } from './milestone-helpers';
import { forecastNetWorth } from './forecast-helpers';
import { Loan } from '../models/loan-model';
import { CompoundingFrequency, Investment } from '../models/investment-model';

const TODAY = new Date(2025, 0, 1);

// Small loan that pays off quickly: 1000 balance, $500/mo, 0% — gone in ~2 months.
const shortLoan: Loan = {
  Id: 'loan-short',
  Provider: 'Bank',
  Name: 'Small Loan',
  InterestRate: 0,
  Principal: 1000,
  CurrentAmount: 1000,
  MonthlyPayment: 500,
  StartDate: new Date(2024, 0, 1),
  EndDate: new Date(2026, 0, 1),
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

describe('computeMilestones', () => {
  it('reports net worth at +5y / +10y / +30y from the same engine series', () => {
    const { netWorthAt } = computeMilestones([], [investment], TODAY);
    expect(netWorthAt.map((m) => m.years)).toEqual([5, 10, 30]);

    const series = forecastNetWorth(
      [],
      [investment],
      new Date(2055, 0, 1),
      undefined,
      TODAY
    );
    expect(netWorthAt[0].value).toBe(series[60].Value);
    expect(netWorthAt[2].value).toBe(series[360].Value);
    // Positive-return investment grows over 30 years.
    expect(netWorthAt[2].value).toBeGreaterThan(netWorthAt[0].value);
  });

  it('projects a debt-free date once loans pay off', () => {
    const { debtFreeDate } = computeMilestones([shortLoan], [], TODAY);
    expect(debtFreeDate).toBeInstanceOf(Date);
    // $1000 at $500/mo, 0% interest → paid off by month 2.
    expect(debtFreeDate!.getTime()).toBe(new Date(2025, 2, 1).getTime());
  });

  it('has no debt-free date when there are no loans', () => {
    const { debtFreeDate } = computeMilestones([], [investment], TODAY);
    expect(debtFreeDate).toBeUndefined();
  });

  it('has no debt-free date when a loan never pays off within the horizon', () => {
    // Payment below interest never amortizes → balance never reaches zero.
    const neverPays: Loan = {
      ...shortLoan,
      Id: 'loan-never',
      InterestRate: 20,
      CurrentAmount: 100000,
      MonthlyPayment: 1,
      EndDate: new Date(2100, 0, 1),
    };
    const { debtFreeDate } = computeMilestones([neverPays], [], TODAY);
    expect(debtFreeDate).toBeUndefined();
  });

  // A loan slow enough that a scenario visibly moves its payoff: 12000 at
  // $1000/mo, 0% → 12 months baseline.
  const midLoan: Loan = {
    ...shortLoan,
    Id: 'loan-mid',
    CurrentAmount: 12000,
    MonthlyPayment: 1000,
    EndDate: new Date(2030, 0, 1),
  };

  it('reflects an extra-payment scenario: the debt-free date arrives sooner (#8.5)', () => {
    const base = computeMilestones([midLoan], [], TODAY).debtFreeDate!;
    const scenario = computeMilestones([midLoan], [], TODAY, [], {
      ExtraLoanPayments: { 'loan-mid': 1000 },
    }).debtFreeDate!;
    expect(scenario.getTime()).toBeLessThan(base.getTime());
  });

  it('reflects a one-time lump scenario: the debt-free date arrives sooner (#8.5)', () => {
    const base = computeMilestones([midLoan], [], TODAY).debtFreeDate!;
    const scenario = computeMilestones([midLoan], [], TODAY, [], {
      OneTimeLoanPayments: { 'loan-mid': 6000 },
    }).debtFreeDate!;
    expect(scenario.getTime()).toBeLessThan(base.getTime());
  });

  it('raises net worth at the horizon under a contribution scenario (#8.5)', () => {
    const base = computeMilestones([], [investment], TODAY).netWorthAt;
    const scenario = computeMilestones([], [investment], TODAY, [], {
      ExtraContributions: { 'inv-1': 200 },
    }).netWorthAt;
    // The +30y net worth is higher with an extra monthly contribution.
    expect(scenario[2].value).toBeGreaterThan(base[2].value);
  });
});
