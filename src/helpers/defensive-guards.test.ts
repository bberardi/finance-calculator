import { describe, it, expect } from 'vitest';
import { getTerms } from './loan-helpers';
import {
  getPeriodsPerYear,
  getInvestmentPeriods,
  generateInvestmentGrowth,
  getPitInvestmentCalculation,
} from './investment-helpers';
import { forecastInvestment } from './forecast-helpers';
import { importFromJson } from './data-helpers';
import { validateLoan, validateInvestment } from './validation-helpers';
import { Loan } from '../models/loan-model';
import { CompoundingFrequency, Investment } from '../models/investment-model';

// Math Correctness Charter §4 enforcement — coverage of the defensive guards.
//
// The helpers carry guards for degenerate inputs (missing dates, unknown enum
// values, no contribution cadence) that the happy-path tests never reach. These
// pin that defensive behavior so the 100% line+branch gate on src/helpers/**
// stays honest rather than being met by deleting the guards.

describe('Defensive guards: loan-helpers.getTerms', () => {
  it('returns 0 when the loan is missing its dates', () => {
    const loan = {
      Id: 'L',
      Provider: '',
      Name: '',
      InterestRate: 5,
      StartDate: undefined,
      EndDate: undefined,
      Principal: 1000,
      CurrentAmount: 1000,
    } as unknown as Loan;
    expect(getTerms(loan)).toBe(0);
  });
});

describe('Defensive guards: investment-helpers', () => {
  it('getPeriodsPerYear falls back to 1 for an unknown frequency', () => {
    expect(getPeriodsPerYear('weekly' as CompoundingFrequency)).toBe(1);
  });

  it('getInvestmentPeriods returns 0 when StartDate is missing', () => {
    const investment = {
      Id: 'I',
      Provider: '',
      Name: '',
      StartDate: undefined,
      StartingBalance: 1000,
      AverageReturnRate: 5,
      CompoundingPeriod: CompoundingFrequency.Monthly,
    } as unknown as Investment;
    expect(getInvestmentPeriods(investment)).toBe(0);
  });
});

describe('Defensive guards: getInvestmentPeriods partial-period branches', () => {
  const inv = (
    over: Partial<Investment> & { CompoundingPeriod: CompoundingFrequency }
  ): Investment => ({
    Id: 'I',
    Provider: '',
    Name: '',
    StartDate: new Date(2020, 0, 15),
    StartingBalance: 1000,
    AverageReturnRate: 5,
    ...over,
  });

  it('defaults the end date to now when none is supplied', () => {
    // Hits the `endDate ?? new Date()` fallback; a past start always yields >= 1.
    const periods = getInvestmentPeriods(
      inv({
        StartDate: new Date(2000, 0, 1),
        CompoundingPeriod: CompoundingFrequency.Monthly,
      })
    );
    expect(periods).toBeGreaterThanOrEqual(1);
  });

  it('monthly: does not add a partial month before the start day', () => {
    expect(
      getInvestmentPeriods(
        inv({ CompoundingPeriod: CompoundingFrequency.Monthly }),
        new Date(2020, 2, 10) // day 10 < start day 15
      )
    ).toBe(2);
  });

  it('quarterly: does not add a partial quarter before the quarter start day', () => {
    expect(
      getInvestmentPeriods(
        inv({
          StartDate: new Date(2020, 0, 20),
          CompoundingPeriod: CompoundingFrequency.Quarterly,
        }),
        new Date(2020, 3, 10) // before the Apr-20 quarter start
      )
    ).toBe(1);
  });

  it('annually: does not add a partial year before the anniversary', () => {
    expect(
      getInvestmentPeriods(
        inv({
          StartDate: new Date(2020, 5, 15),
          CompoundingPeriod: CompoundingFrequency.Annually,
        }),
        new Date(2021, 2, 1) // before the June anniversary
      )
    ).toBe(1);
  });
});

describe('Defensive guards: generateInvestmentGrowth / PIT fallbacks', () => {
  const base = (over: Partial<Investment> = {}): Investment => ({
    Id: 'I',
    Provider: '',
    Name: '',
    StartDate: new Date(2000, 0, 1),
    StartingBalance: 10000,
    AverageReturnRate: 6,
    CompoundingPeriod: CompoundingFrequency.Monthly,
    ...over,
  });

  it('generateInvestmentGrowth defaults the end date to now', () => {
    // `endDate ?? new Date()`; a 2000 start means many periods by today.
    expect(generateInvestmentGrowth(base()).length).toBeGreaterThan(1);
  });

  it('pro-rates the final partial compounding period (mid-month horizon)', () => {
    const growth = generateInvestmentGrowth(base(), new Date(2000, 2, 15));
    // Last period is partial (Mar 1 -> Mar 15 of a Mar 1 -> Apr 1 period).
    expect(growth.length).toBeGreaterThan(1);
    expect(growth[growth.length - 1].TotalValue).toBeGreaterThan(0);
  });

  it('PIT defaults the date and falls back to the starting balance before the start', () => {
    // date ?? new Date() default-date branch.
    expect(getPitInvestmentCalculation(base()).CurrentValue).toBeGreaterThan(0);

    // Empty-growth + zero-contribution branches: a future-dated, zero-balance
    // investment queried before it starts.
    const future = base({
      StartDate: new Date(2099, 0, 1),
      StartingBalance: 0,
    });
    const pit = getPitInvestmentCalculation(future, new Date(2098, 0, 1));
    expect(pit.CurrentValue).toBe(0);
    expect(pit.ProjectedAnnualReturn).toBe(0);
  });
});

describe('Defensive guards: forecastInvestment without a contribution cadence', () => {
  it('treats an absent recurring amount as zero when a frequency is set', () => {
    // Hits `RecurringContribution ?? 0` on the frequency-set branch.
    const inv: Investment = {
      Id: 'I',
      Provider: '',
      Name: '',
      StartDate: new Date(2020, 0, 1),
      StartingBalance: 10000,
      AverageReturnRate: 6,
      CompoundingPeriod: CompoundingFrequency.Monthly,
      ContributionFrequency: CompoundingFrequency.Monthly,
      // RecurringContribution intentionally omitted
    };
    const today = new Date(2024, 0, 1);
    const horizon = new Date(2026, 0, 1);
    const noAmount = forecastInvestment(inv, horizon, 0, today);
    const explicitZero = forecastInvestment(
      { ...inv, RecurringContribution: 0 },
      horizon,
      0,
      today
    );
    expect(noAmount.map((p) => p.Value)).toEqual(
      explicitZero.map((p) => p.Value)
    );
  });

  it('ignores a recurring amount when no ContributionFrequency is set', () => {
    const base: Investment = {
      Id: 'I',
      Provider: '',
      Name: '',
      StartDate: new Date(2020, 0, 1),
      StartingBalance: 10000,
      AverageReturnRate: 6,
      CompoundingPeriod: CompoundingFrequency.Monthly,
      RecurringContribution: 500, // present, but no frequency => not applied
    };
    const today = new Date(2024, 0, 1);
    const horizon = new Date(2026, 0, 1);
    const withAmountNoFreq = forecastInvestment(base, horizon, 0, today);
    const lumpSumOnly = forecastInvestment(
      { ...base, RecurringContribution: 0 },
      horizon,
      0,
      today
    );
    expect(withAmountNoFreq.map((p) => p.Value)).toEqual(
      lumpSumOnly.map((p) => p.Value)
    );
  });
});

describe('Defensive guards: import date validation', () => {
  it('rejects an investment whose StartDate is invalid even when loans are valid', () => {
    const json = JSON.stringify({
      schemaVersion: 2,
      loans: [],
      investments: [
        {
          Id: 'I',
          Provider: 'Broker',
          Name: 'Bad date',
          StartDate: 'not-a-date',
          StartingBalance: 1000,
          AverageReturnRate: 5,
          CompoundingPeriod: CompoundingFrequency.Monthly,
        },
      ],
    });
    expect(() => importFromJson(json)).toThrow(/Invalid date in investment/);
  });
});

describe('Defensive guards: validation-helpers required-date errors', () => {
  it('flags a loan missing its start and end dates', () => {
    const loan = {
      Id: 'L',
      Provider: 'Bank',
      Name: 'No dates',
      InterestRate: 5,
      StartDate: undefined,
      EndDate: undefined,
      Principal: 1000,
      CurrentAmount: 1000,
      MonthlyPayment: 100,
    } as unknown as Loan;
    const result = validateLoan(loan);
    expect(result.errors.StartDate).toBeTruthy();
    expect(result.errors.EndDate).toBeTruthy();
  });

  it('flags an investment missing its start date', () => {
    const investment = {
      Id: 'I',
      Provider: 'Broker',
      Name: 'No date',
      StartDate: undefined,
      StartingBalance: 1000,
      AverageReturnRate: 5,
      CompoundingPeriod: CompoundingFrequency.Monthly,
    } as unknown as Investment;
    const result = validateInvestment(investment);
    expect(result.errors.StartDate).toBeTruthy();
  });
});
