import { describe, it, expect } from 'vitest';
import { summarizePositions } from './summary-helpers';
import { forecastNetWorth } from './forecast-helpers';
import { Loan } from '../models/loan-model';
import { CompoundingFrequency, Investment } from '../models/investment-model';

const TODAY = new Date(2025, 0, 1);

const loan: Loan = {
  Id: 'loan-1',
  Provider: 'Bank',
  Name: 'Car Loan',
  InterestRate: 6,
  Principal: 12000,
  CurrentAmount: 6000,
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
  CurrentValue: 10500,
  RecurringContribution: 300,
  ContributionFrequency: CompoundingFrequency.Monthly,
};

describe('summarizePositions', () => {
  it('totals debt and assets from the engine today-anchor', () => {
    const summary = summarizePositions([loan], [investment], TODAY);
    expect(summary.totalDebt).toBe(6000);
    // Honors CurrentValue as the asset anchor.
    expect(summary.totalAssets).toBe(10500);
    expect(summary.netWorth).toBe(4500);
  });

  it('net worth matches the chart start (forecastNetWorth index 0)', () => {
    const summary = summarizePositions([loan], [investment], TODAY);
    const chartStart = forecastNetWorth(
      [loan],
      [investment],
      TODAY,
      undefined,
      TODAY
    )[0].Value;
    expect(summary.netWorth).toBe(chartStart);
  });

  it('sums monthly-equivalent commitments (loan payment + monthly contribution)', () => {
    const summary = summarizePositions([loan], [investment], TODAY);
    // 500 loan payment + 300 monthly contribution.
    expect(summary.monthlyCommitments).toBe(800);
  });

  it('normalizes non-monthly contribution cadences to a monthly amount', () => {
    const quarterly: Investment = {
      ...investment,
      Id: 'inv-q',
      RecurringContribution: 300,
      ContributionFrequency: CompoundingFrequency.Quarterly,
    };
    const annual: Investment = {
      ...investment,
      Id: 'inv-a',
      RecurringContribution: 1200,
      ContributionFrequency: CompoundingFrequency.Annually,
    };
    // Quarterly 300 → 100/mo; annual 1200 → 100/mo.
    expect(summarizePositions([], [quarterly], TODAY).monthlyCommitments).toBe(
      100
    );
    expect(summarizePositions([], [annual], TODAY).monthlyCommitments).toBe(
      100
    );
  });

  it('ignores contributions with no cadence and loans with no payment', () => {
    const noCadence: Investment = {
      ...investment,
      Id: 'inv-n',
      RecurringContribution: 500,
      ContributionFrequency: undefined,
    };
    const noPayment: Loan = {
      ...loan,
      Id: 'loan-n',
      MonthlyPayment: undefined,
    };
    // A cadence set but no amount also contributes nothing.
    const cadenceNoAmount: Investment = {
      ...investment,
      Id: 'inv-na',
      RecurringContribution: undefined,
      ContributionFrequency: CompoundingFrequency.Monthly,
    };
    const summary = summarizePositions(
      [noPayment],
      [noCadence, cadenceNoAmount],
      TODAY
    );
    expect(summary.monthlyCommitments).toBe(0);
  });

  it('is all zeros with no positions', () => {
    expect(summarizePositions([], [], TODAY)).toEqual({
      totalDebt: 0,
      totalAssets: 0,
      netWorth: 0,
      monthlyCommitments: 0,
    });
  });
});
