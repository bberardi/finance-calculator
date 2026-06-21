import { describe, it, expect } from 'vitest';
import { summarizePositions } from './summary-helpers';
import { currentInvestmentValue, forecastNetWorth } from './forecast-helpers';
import { getMonthlyPayment } from './loan-helpers';
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

  it('ignores contributions with no cadence or no amount', () => {
    const noCadence: Investment = {
      ...investment,
      Id: 'inv-n',
      RecurringContribution: 500,
      ContributionFrequency: undefined,
    };
    // A cadence set but no amount also contributes nothing.
    const cadenceNoAmount: Investment = {
      ...investment,
      Id: 'inv-na',
      RecurringContribution: undefined,
      ContributionFrequency: CompoundingFrequency.Monthly,
    };
    const summary = summarizePositions([], [noCadence, cadenceNoAmount], TODAY);
    expect(summary.monthlyCommitments).toBe(0);
  });

  it('counts the forecast-derived payment for a loan with no stored payment (#91)', () => {
    // A loan imported with MonthlyPayment unset (or 0) is amortized by the
    // forecast over its remaining term, so it must contribute that same derived
    // payment to "Monthly commitments" — the card and the chart use a single
    // source of truth (getEffectiveMonthlyPayment).
    const remainingTerms = 12; // 2025-01-01 → 2026-01-01
    const derived = getMonthlyPayment(6000, 6, remainingTerms); // ≈ 516.40

    const noPayment: Loan = {
      ...loan,
      Id: 'loan-n',
      MonthlyPayment: undefined,
    };
    const zeroPayment: Loan = { ...loan, Id: 'loan-z', MonthlyPayment: 0 };

    expect(
      summarizePositions([noPayment], [], TODAY).monthlyCommitments
    ).toBeCloseTo(derived, 2);
    // A stored 0 is treated identically to "unset" (not a real $0/mo payment).
    expect(
      summarizePositions([zeroPayment], [], TODAY).monthlyCommitments
    ).toBeCloseTo(derived, 2);
  });

  it('totalAssets uses the same anchor as the table column for a past-dated investment with CurrentValue unset (#125)', () => {
    // The investment table's "Current Value" column/totals and this dashboard
    // total must read one figure. Previously the table fell back to
    // StartingBalance while the dashboard projected to today, so the two
    // disagreed for any past-dated investment with CurrentValue unset.
    const pastDated: Investment = {
      Id: 'inv-past',
      Provider: 'Brokerage',
      Name: 'Old Fund',
      StartDate: new Date(2016, 5, 20),
      StartingBalance: 10000,
      AverageReturnRate: 7,
      CompoundingPeriod: CompoundingFrequency.Annually,
    };

    const anchor = currentInvestmentValue(pastDated, TODAY);
    // The projected-to-today value has grown well past the starting balance.
    expect(anchor).toBeGreaterThan(pastDated.StartingBalance);
    // The dashboard total reads exactly that same anchor.
    expect(summarizePositions([], [pastDated], TODAY).totalAssets).toBe(anchor);
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
