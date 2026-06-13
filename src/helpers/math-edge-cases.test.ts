import { describe, it, expect } from 'vitest';
import {
  generateAmortizationSchedule,
  getMonthlyPayment,
  getTerms,
} from './loan-helpers';
import {
  getAnniversaryDate,
  getInvestmentYear,
  getNextCompoundingDate,
} from './investment-helpers';
import { forecastLoan, forecastInvestment } from './forecast-helpers';
import { Loan } from '../models/loan-model';
import { CompoundingFrequency, Investment } from '../models/investment-model';

// Math Correctness Charter §4, layer 4 — Edge-case catalog.
//
// Named tests for the boundaries that quietly break naive implementations:
// leap days, month-end rollover, zero/extreme rates, one-month terms, negative
// amortization, zero/mid-month/50-year horizons, and float accumulation over
// 600+ months staying within the cents policy (PRECISION.md).

const makeLoan = (over: Partial<Loan>): Loan => ({
  Id: 'L',
  Provider: '',
  Name: '',
  InterestRate: 5,
  StartDate: new Date(2020, 0, 1),
  EndDate: new Date(2025, 0, 1),
  Principal: 10000,
  CurrentAmount: 10000,
  ...over,
});

const makeInvestment = (over: Partial<Investment>): Investment => ({
  Id: 'I',
  Provider: '',
  Name: '',
  StartDate: new Date(2020, 0, 1),
  StartingBalance: 10000,
  AverageReturnRate: 6,
  CompoundingPeriod: CompoundingFrequency.Monthly,
  ...over,
});

describe('Edge: leap-day anniversaries', () => {
  it('a Feb-29 start falls back to Feb 28 in non-leap years and keeps Feb 29 in leap years', () => {
    const leapStart = new Date(2020, 1, 29);
    expect(getAnniversaryDate(leapStart, 2021)).toEqual(new Date(2021, 1, 28));
    expect(getAnniversaryDate(leapStart, 2024)).toEqual(new Date(2024, 1, 29));
    // Century rule: 2100 is not a leap year.
    expect(getAnniversaryDate(leapStart, 2100)).toEqual(new Date(2100, 1, 28));
  });

  it('counts a Feb-29 start as having passed its anniversary on Feb 28 of a non-leap year', () => {
    expect(
      getInvestmentYear(new Date(2021, 1, 28), new Date(2020, 1, 29))
    ).toBe(2);
  });
});

describe('Edge: month-end date rollover', () => {
  it('documents the JS Date rollover for Jan 31 + 1 month (lands in March)', () => {
    // Jan 31 + 1 month overflows February and normalizes into March — a known
    // Date quirk. Pinned so a future dayjs migration (Phase 6) is a deliberate
    // behavior change, not a silent one.
    const next = getNextCompoundingDate(
      new Date(2021, 0, 31),
      CompoundingFrequency.Monthly
    );
    expect(next.getMonth()).toBe(2); // March
    expect(next).toEqual(new Date(2021, 2, 3));
  });
});

describe('Edge: zero and extreme rates', () => {
  it('a 0% loan pays equal principal instalments and reaches exactly zero', () => {
    const loan = makeLoan({
      InterestRate: 0,
      Principal: 12000,
      CurrentAmount: 12000,
      EndDate: new Date(2021, 0, 1), // 13 terms
      MonthlyPayment: getMonthlyPayment(
        12000,
        0,
        getTerms(makeLoan({ EndDate: new Date(2021, 0, 1) }))
      ),
    });
    const schedule = generateAmortizationSchedule(loan);
    expect(schedule.every((e) => e.InterestPayment === 0)).toBe(true);
    expect(schedule[schedule.length - 1].RemainingBalance).toBe(0);
  });

  it('an extreme 30% rate still produces a payment above interest-only', () => {
    const payment = getMonthlyPayment(100000, 30, 360);
    const interestOnly = (100000 * 30) / 100 / 12;
    expect(payment).toBeGreaterThan(interestOnly);
  });
});

describe('Edge: one-month term', () => {
  it('a single-term loan is repaid in full with one interest charge', () => {
    const loan = makeLoan({
      InterestRate: 6,
      Principal: 5000,
      CurrentAmount: 5000,
      EndDate: new Date(2020, 0, 1), // start == end => 1 term
      MonthlyPayment: getMonthlyPayment(5000, 6, 1),
    });
    expect(loan.MonthlyPayment).toBe(5025); // 5000 · (1 + 0.06/12)
    expect(generateAmortizationSchedule(loan)).toEqual([
      {
        Term: 1,
        PrincipalPayment: 5000,
        InterestPayment: 25,
        RemainingBalance: 0,
      },
    ]);
  });
});

describe('Edge: negative amortization (payment < interest)', () => {
  it('balance grows instead of throwing when the payment cannot cover interest', () => {
    const loan = makeLoan({
      InterestRate: 12, // 1%/mo => 1000 interest on 100k
      Principal: 100000,
      CurrentAmount: 100000,
      EndDate: new Date(2050, 0, 1),
      MonthlyPayment: 500, // below the 1000 first-month interest
    });
    const series = forecastLoan(
      loan,
      new Date(2021, 0, 1),
      0,
      new Date(2020, 0, 1)
    );
    // Strictly increasing while underwater.
    for (let m = 1; m < series.length; m++) {
      expect(series[m].Value).toBeGreaterThan(series[m - 1].Value);
    }
    expect(series[1].Value).toBe(100500);

    // The schedule records a negative principal payment in the same situation.
    expect(generateAmortizationSchedule(loan)[0].PrincipalPayment).toBe(-500);
  });
});

describe('Edge: horizon boundaries', () => {
  it('horizon = today yields a single anchor point', () => {
    const loan = makeLoan({ MonthlyPayment: 200 });
    const today = new Date(2024, 5, 10);
    const series = forecastLoan(loan, today, 0, today);
    expect(series).toHaveLength(1);
    expect(series[0].Value).toBe(loan.CurrentAmount);
  });

  it('a mid-month horizon rounds up to cover the requested end date', () => {
    const inv = makeInvestment({});
    const today = new Date(2024, 0, 15);
    const horizon = new Date(2024, 2, 20); // ~2.16 months out
    const series = forecastInvestment(inv, horizon, 0, today);
    // ceil(2.16) = 3 months beyond the anchor.
    expect(series).toHaveLength(4);
    expect(series[series.length - 1].Date.getTime()).toBeGreaterThanOrEqual(
      horizon.getTime() - 1000 * 60 * 60 * 24 * 31
    );
  });
});

describe('Edge: long horizons and float accumulation', () => {
  it('a 50-year (600+ month) forecast stays clean to the cent with no NaN', () => {
    const inv = makeInvestment({
      RecurringContribution: 500,
      ContributionFrequency: CompoundingFrequency.Monthly,
    });
    const today = new Date(2024, 0, 1);
    const horizon = new Date(2074, 0, 1); // 50 years => 600 months
    const series = forecastInvestment(inv, horizon, 0, today);
    expect(series.length).toBeGreaterThan(600);
    for (const point of series) {
      expect(Number.isFinite(point.Value)).toBe(true);
      // Every emitted value is rounded to whole cents per PRECISION.md.
      expect(
        Math.abs(point.Value * 100 - Math.round(point.Value * 100))
      ).toBeLessThan(1e-6);
    }
    // Monotonically non-decreasing: positive return + positive contributions.
    for (let m = 1; m < series.length; m++) {
      expect(series[m].Value).toBeGreaterThanOrEqual(series[m - 1].Value);
    }
  });
});
