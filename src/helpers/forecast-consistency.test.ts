import { describe, it, expect } from 'vitest';
import {
  generateAmortizationSchedule,
  getMonthlyPayment,
  getTerms,
} from './loan-helpers';
import {
  generateInvestmentGrowth,
  getPeriodsPerYear,
} from './investment-helpers';
import { forecastLoan, forecastInvestment } from './forecast-helpers';
import { Loan } from '../models/loan-model';
import {
  CompoundingFrequency,
  Investment,
  StepUpType,
} from '../models/investment-model';

// Compare to the cent. The schedule helpers carry an unrounded running balance
// while the forecast engine re-rounds every step (PRECISION.md §2), so raw
// doubles can differ by float epsilon (~1e-12) while representing the same cent
// value. Integer cents is the precise statement of "agrees to the cent".
const cents = (value: number): number => Math.round(value * 100);

// Math Correctness Charter §4, layer 2 — Cross-implementation consistency.
//
// The forecast engine (date-indexed, anchored to today) and the term/period
// schedule helpers compute the same quantities two different ways. Run from the
// start with the anchor equal to the original principal/balance, they must not
// drift. Guarantees and the one documented exception are spelled out in
// PRECISION.md §4.

const makeLoan = (over: Partial<Loan>): Loan => ({
  Id: 'L',
  Provider: '',
  Name: '',
  InterestRate: 5,
  StartDate: new Date(2020, 0, 1),
  EndDate: new Date(2025, 0, 1),
  Principal: 30000,
  CurrentAmount: 30000,
  ...over,
});

const makeInvestment = (over: Partial<Investment>): Investment => ({
  Id: 'I',
  Provider: '',
  Name: '',
  StartDate: new Date(2020, 0, 1),
  StartingBalance: 5000,
  AverageReturnRate: 7,
  CompoundingPeriod: CompoundingFrequency.Monthly,
  ...over,
});

describe('Consistency: forecastLoan reproduces the amortization schedule', () => {
  // forecastLoan(loan, EndDate, 0, StartDate) with CurrentAmount = Principal must
  // equal generateAmortizationSchedule's RemainingBalance month-for-month, to the
  // cent. forecast index t (t ≥ 1) is the balance after t payments = schedule
  // term t's RemainingBalance.
  const cases: Array<{ name: string; loan: Loan }> = [
    {
      name: '30k @ 5% / 5yr',
      loan: makeLoan({}),
    },
    {
      name: '100k @ 3.5% / 30yr',
      loan: makeLoan({
        InterestRate: 3.5,
        EndDate: new Date(2050, 0, 1),
        Principal: 100000,
        CurrentAmount: 100000,
      }),
    },
    {
      name: '0% / 4yr',
      loan: makeLoan({
        InterestRate: 0,
        EndDate: new Date(2024, 0, 1),
        Principal: 12000,
        CurrentAmount: 12000,
      }),
    },
  ];

  cases.forEach(({ name, loan }) => {
    it(`matches to the cent: ${name}`, () => {
      const withPayment: Loan = {
        ...loan,
        MonthlyPayment: getMonthlyPayment(
          loan.Principal,
          loan.InterestRate,
          getTerms(loan)
        ),
      };
      const schedule = generateAmortizationSchedule(withPayment);
      const forecast = forecastLoan(
        withPayment,
        withPayment.EndDate,
        0,
        withPayment.StartDate
      );

      // Compare over the overlapping range (the schedule's term count and the
      // monthly forecast horizon differ by the StartDate/EndDate +1-term
      // convention; the overlap is what must agree).
      const overlap = Math.min(schedule.length, forecast.length - 1);
      for (let term = 1; term <= overlap; term++) {
        expect(cents(forecast[term].Value)).toBe(
          cents(schedule[term - 1].RemainingBalance)
        );
      }
    });
  });
});

describe('Consistency: forecastInvestment matches growth at compounding boundaries', () => {
  // At each compounding boundary (month = period × 12 / periodsPerYear),
  // forecastInvestment's value equals generateInvestmentGrowth's TotalValue to
  // the cent — for the no-step-up cases (see PRECISION.md §4 for the step-up
  // exception, which is deliberately not asserted here).
  const start = new Date(2020, 0, 1);
  const end = new Date(2030, 0, 1);
  const cases: Array<{ name: string; inv: Investment }> = [
    {
      name: 'monthly compounding, monthly contributions',
      inv: makeInvestment({
        RecurringContribution: 300,
        ContributionFrequency: CompoundingFrequency.Monthly,
      }),
    },
    {
      name: 'quarterly compounding, monthly contributions',
      inv: makeInvestment({
        CompoundingPeriod: CompoundingFrequency.Quarterly,
        RecurringContribution: 300,
        ContributionFrequency: CompoundingFrequency.Monthly,
      }),
    },
    {
      name: 'annual compounding, quarterly contributions',
      inv: makeInvestment({
        CompoundingPeriod: CompoundingFrequency.Annually,
        RecurringContribution: 1000,
        ContributionFrequency: CompoundingFrequency.Quarterly,
      }),
    },
    {
      name: 'lump sum, no contributions',
      inv: makeInvestment({
        CompoundingPeriod: CompoundingFrequency.Quarterly,
      }),
    },
  ];

  cases.forEach(({ name, inv }) => {
    it(`agrees at every boundary: ${name}`, () => {
      const growth = generateInvestmentGrowth(inv, end);
      const forecast = forecastInvestment(inv, end, 0, start);
      const interval = 12 / getPeriodsPerYear(inv.CompoundingPeriod);

      // Anchor (period 0 / month 0) must match.
      expect(cents(forecast[0].Value)).toBe(cents(growth[0].TotalValue));

      for (let period = 1; period < growth.length; period++) {
        const month = period * interval;
        if (month >= forecast.length) break;
        expect(cents(forecast[month].Value)).toBe(
          cents(growth[period].TotalValue)
        );
      }
    });
  });
});

describe('Consistency: KNOWN divergence — step-up anniversary attribution', () => {
  // Charter §4 process rule: "every math bug found gets a failing regression
  // test committed before the fix." The two investment engines agree to the
  // cent WITHOUT step-ups (asserted above), but disagree once a yearly step-up
  // is configured: they attribute an on-anniversary contribution to different
  // year numbers (an off-by-one). See PRECISION.md §4 "Known divergence".
  //
  // This is encoded as `it.fails` so the suite is NOT silent about the bug: the
  // body asserts the engines AGREE, which currently throws, so `it.fails`
  // passes. The day the off-by-one is reconciled the body stops throwing and
  // this test flips red — forcing whoever fixes it to convert this into a normal
  // passing `it`, exactly the "failing test before the fix" the Charter wants.
  it.fails(
    'forecastInvestment and generateInvestmentGrowth diverge with a yearly step-up',
    () => {
      const start = new Date(2020, 0, 1);
      const end = new Date(2030, 0, 1);
      const inv: Investment = {
        Id: 'I',
        Provider: '',
        Name: '',
        StartDate: start,
        StartingBalance: 5000,
        AverageReturnRate: 7,
        CompoundingPeriod: CompoundingFrequency.Monthly,
        RecurringContribution: 500,
        ContributionFrequency: CompoundingFrequency.Monthly,
        ContributionStepUpAmount: 5,
        ContributionStepUpType: StepUpType.Percentage,
      };
      const growth = generateInvestmentGrowth(inv, end);
      const forecast = forecastInvestment(inv, end, 0, start);

      // Monthly compounding => boundary month === period index. They already
      // diverge at the first anniversary (month 12), where the step-up first
      // applies. When this assertion starts passing, delete `.fails`.
      for (let month = 1; month < growth.length; month++) {
        expect(cents(forecast[month].Value)).toBe(
          cents(growth[month].TotalValue)
        );
      }
    }
  );
});
