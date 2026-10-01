import { describe, it, expect } from 'vitest';
import { Loan } from '../models/loan-model';
import { CompoundingFrequency, Investment } from '../models/investment-model';
import {
  formatCurrency,
  formatCurrencyCompact,
  formatNetWorthDelta,
} from './format-helpers';
import { simulateNetWorthBands } from './monte-carlo-helpers';
import { compareSortValues, sortBy } from './sort-helpers';
import { evaluateEnhancement } from './enhancement-helpers';
import { toRealSeries } from './inflation-helpers';
import { summarizePositions } from './summary-helpers';
import {
  generateAmortizationSchedule,
  getPitCalculation,
} from './loan-helpers';
import { forecastLoan } from './forecast-helpers';
import { generateInvestmentGrowth } from './investment-helpers';
import { getGrowthTotals } from './schedule-totals-helpers';

// Regression tests for the September 2026 bug sweep. Each block names the issue
// it pins; every test here failed before its fix.

const loan = (overrides: Partial<Loan> = {}): Loan => ({
  Id: 'l1',
  Provider: 'Bank',
  Name: 'Loan',
  InterestRate: 6,
  Principal: 100000,
  CurrentAmount: 100000,
  MonthlyPayment: 600,
  StartDate: new Date(2025, 0, 1),
  EndDate: new Date(2035, 0, 1),
  ...overrides,
});

const investment = (overrides: Partial<Investment> = {}): Investment => ({
  Id: 'i1',
  Provider: 'Broker',
  Name: 'Fund',
  StartDate: new Date(2025, 0, 1),
  StartingBalance: 10000,
  AverageReturnRate: 7,
  CompoundingPeriod: CompoundingFrequency.Monthly,
  ...overrides,
});

describe('currency formatting near zero (#182)', () => {
  it('never shows a sign on an amount that rounds to $0.00', () => {
    expect(formatCurrency(-0)).toBe('$0.00');
    expect(formatCurrency(-0.004)).toBe('$0.00');
    expect(formatCurrencyCompact(-0)).toBe('$0');
  });

  it('reads "No change" for a sub-cent delta', () => {
    expect(formatNetWorthDelta(-0.004)).toBe('No change');
    expect(formatNetWorthDelta(0.004)).toBe('No change');
    expect(formatNetWorthDelta(0.01)).toBe('+$0.01');
    expect(formatNetWorthDelta(-0.01)).toBe('-$0.01');
  });
});

describe('simulateNetWorthBands paths guard (#188)', () => {
  const run = (paths: number) =>
    simulateNetWorthBands(
      [],
      [investment()],
      [],
      new Date(2027, 0, 1),
      new Date(2025, 0, 1),
      { paths }
    );

  it.each([0, -5, NaN])('falls back to the default for paths=%s', (paths) => {
    const bands = run(paths);
    const reference = run(500);
    expect(bands.bands.length).toBe(reference.bands.length);
    for (const band of bands.bands) {
      expect(band.values.every(Number.isFinite)).toBe(true);
    }
  });
});

describe('sorting with NaN / Invalid Date keys (#213)', () => {
  it('keeps the valid keys ordered and sinks NaN to the end', () => {
    const rows = [{ v: 3 }, { v: NaN }, { v: 1 }, { v: 2 }];
    expect(sortBy(rows, (r) => r.v, 'asc').map((r) => r.v)).toEqual([
      1,
      2,
      3,
      NaN,
    ]);
    expect(sortBy(rows, (r) => r.v, 'desc').map((r) => r.v)).toEqual([
      3,
      2,
      1,
      NaN,
    ]);
  });

  it('treats an Invalid Date like NaN', () => {
    const invalid = new Date('x');
    expect(compareSortValues(invalid, new Date(2020, 0, 1))).toBe(1);
    expect(compareSortValues(new Date(2020, 0, 1), invalid)).toBe(-1);
    expect(compareSortValues(invalid, new Date('y'))).toBe(0);
  });
});

describe('evaluateEnhancement below -100%/yr (#218)', () => {
  it('decays the added value to zero instead of flipping sign', () => {
    expect(evaluateEnhancement(1000, 500, -150, 3).addedValueAtYears).toBe(0);
    expect(evaluateEnhancement(1000, 500, -150, 2).addedValueAtYears).toBe(0);
    expect(evaluateEnhancement(1000, 500, -150, 2.5).addedValueAtYears).toBe(0);
  });
});

describe('toRealSeries length guard (#224)', () => {
  it('throws when dates and values differ in length', () => {
    expect(() =>
      toRealSeries(
        [1000, 1000, 1000],
        [new Date(2025, 0, 1)],
        new Date(2025, 0, 1),
        3
      )
    ).toThrow(/one date per value/);
  });
});

describe('monthly commitments (#173, #179)', () => {
  const today = new Date(2025, 6, 12);

  it('ignores a future-dated investment contribution (#173)', () => {
    const summary = summarizePositions(
      [],
      [
        investment({
          StartDate: new Date(2026, 0, 1),
          RecurringContribution: 500,
          ContributionFrequency: CompoundingFrequency.Monthly,
        }),
      ],
      today
    );
    expect(summary.monthlyCommitments).toBe(0);
  });

  it('still counts a started investment contribution', () => {
    const summary = summarizePositions(
      [],
      [
        investment({
          RecurringContribution: 500,
          ContributionFrequency: CompoundingFrequency.Monthly,
        }),
      ],
      today
    );
    expect(summary.monthlyCommitments).toBe(500);
  });

  it('ignores a paid-off loan (#179)', () => {
    const summary = summarizePositions(
      [loan({ CurrentAmount: 0, MonthlyPayment: 500 })],
      [],
      today
    );
    expect(summary.totalDebt).toBe(0);
    expect(summary.monthlyCommitments).toBe(0);
  });
});

describe('under-amortizing loan schedule (#166)', () => {
  it('does not report payoff via a balloon row; agrees with forecastLoan', () => {
    const l = loan();
    const schedule = generateAmortizationSchedule(l);
    const last = schedule[schedule.length - 1];
    expect(last.PrincipalPayment).toBeLessThan(l.MonthlyPayment!);
    expect(last.RemainingBalance).toBeGreaterThan(80000);

    const pit = getPitCalculation(l, l.EndDate);
    expect(pit.RemainingPrincipal).toBe(last.RemainingBalance);
    expect(pit.RemainingTerms).toBeGreaterThanOrEqual(0);

    const forecast = forecastLoan(l, l.EndDate, 0, l.StartDate);
    expect(
      Math.abs(forecast[forecast.length - 1].Value - last.RemainingBalance)
    ).toBeLessThan(1000);
  });

  it('still closes a correctly amortizing loan on its final term', () => {
    const l = loan({ MonthlyPayment: 1110.21 }); // 6%, 121 terms
    const schedule = generateAmortizationSchedule(l);
    expect(schedule[schedule.length - 1].RemainingBalance).toBe(0);
  });
});

describe('PIT RemainingTerms for an early-payoff loan (#203)', () => {
  it('counts the schedule terms left, not the calendar terms', () => {
    const l = loan({
      StartDate: new Date(2024, 0, 1),
      EndDate: new Date(2034, 0, 1),
      InterestRate: 5,
      MonthlyPayment: 5000,
    });
    const fullLength = generateAmortizationSchedule(l).length;
    const pit = getPitCalculation(l, new Date(2024, 9, 1));
    expect(pit.RemainingPrincipal).toBeGreaterThan(0);
    expect(pit.RemainingTerms).toBe(fullLength - pit.PaidTerms);
    expect(pit.RemainingTerms).toBeLessThan(20);
  });
});

describe('growth totals with an employer match (#214)', () => {
  it('keeps the match out of "Total invested"', () => {
    const inv = investment({
      StartingBalance: 0,
      AverageReturnRate: 0,
      RecurringContribution: 1000,
      ContributionFrequency: CompoundingFrequency.Monthly,
      EmployerMatchRate: 100,
      EmployerMatchLimitPct: 100,
      AnnualSalary: 12000,
    });
    const growth = generateInvestmentGrowth(inv, new Date(2026, 0, 1));
    const totals = getGrowthTotals(growth, 0);
    expect(totals.totalContributions).toBe(12000);
    expect(totals.totalEmployerMatch).toBe(12000);
    expect(totals.endingInvested).toBe(12000);
    expect(totals.endingValue).toBe(24000);
    expect(
      totals.endingInvested + totals.totalEmployerMatch + totals.totalInterest
    ).toBeCloseTo(totals.endingValue, 2);
  });
});
