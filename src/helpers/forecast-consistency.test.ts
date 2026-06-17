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

describe('Consistency: forecastInvestment matches growth at an OFF-boundary today (#88)', () => {
  // The previous tests all anchor at StartDate (an exact compounding boundary,
  // f = 0), which masked a partial-period double-count: when `today` falls
  // inside a period, generateInvestmentGrowth pro-rates that slice into the
  // anchor, and forecastInvestment then applied a *full* periodRate at the next
  // boundary — counting the elapsed slice twice. With the fix, the forecast
  // anchored at an off-boundary `today` must still agree with the canonical
  // engine to the cent at every future compounding boundary.
  const start = new Date(2020, 0, 1);
  // 2026-09-16 is off a boundary for monthly/quarterly/annual cadences anchored
  // to a Jan-1 start (the regression date from issue #88).
  const today = new Date(2026, 8, 16);
  const end = new Date(2050, 0, 1);

  const cases: Array<{ name: string; inv: Investment }> = [
    {
      name: 'annual compounding, no contributions',
      inv: makeInvestment({
        StartDate: start,
        StartingBalance: 10000,
        AverageReturnRate: 10,
        CompoundingPeriod: CompoundingFrequency.Annually,
      }),
    },
    {
      name: 'quarterly compounding, no contributions',
      inv: makeInvestment({
        StartDate: start,
        StartingBalance: 10000,
        AverageReturnRate: 10,
        CompoundingPeriod: CompoundingFrequency.Quarterly,
      }),
    },
    {
      name: 'monthly compounding, no contributions',
      inv: makeInvestment({
        StartDate: start,
        StartingBalance: 10000,
        AverageReturnRate: 10,
        CompoundingPeriod: CompoundingFrequency.Monthly,
      }),
    },
  ];

  cases.forEach(({ name, inv }) => {
    it(`agrees at every future boundary: ${name}`, () => {
      const growth = generateInvestmentGrowth(inv, end);
      const forecast = forecastInvestment(inv, end, 0, today);
      const interval = 12 / getPeriodsPerYear(inv.CompoundingPeriod);

      // Anchor (today's value) must match the canonical pro-rated value exactly:
      // both read the same rounded generateInvestmentGrowth output.
      expect(cents(forecast[0].Value)).toBe(
        cents(generateInvestmentGrowth(inv, today).at(-1)!.TotalValue)
      );

      // generateInvestmentGrowth is indexed by period from StartDate; map each
      // canonical boundary to the forecast's today-anchored month grid and
      // compare only boundaries that fall on or after today.
      //
      // Tolerance: a few cents ("± intra-step rounding order", PRECISION.md
      // §2/§4). The forecast can only anchor on the canonical engine's
      // *reported* today-value, which is already rounded to cents; off a
      // compounding boundary that ≤½-cent rounding amplifies under up to 24
      // years of compounding and can shift the last few cents at the far
      // boundaries (measured ≤3¢ here). The pre-fix double-count was orders of
      // magnitude larger (up to ~7% / thousands of dollars — see the explicit
      // regression check below), so a 5-cent band still pins the fix tightly.
      for (let period = 1; period < growth.length; period++) {
        const monthsFromStart = period * interval;
        const monthsFromToday =
          monthsFromStart -
          (today.getFullYear() - start.getFullYear()) * 12 -
          (today.getMonth() - start.getMonth());
        if (monthsFromToday <= 0 || monthsFromToday >= forecast.length)
          continue;
        expect(
          Math.abs(
            cents(forecast[monthsFromToday].Value) -
              cents(growth[period].TotalValue)
          )
        ).toBeLessThanOrEqual(5);
      }
    });
  });

  it('eliminates the partial-period double-count from the issue report (#88)', () => {
    // The exact scenario and numbers from issue #88: $10k @ 10%/yr, annual
    // compounding, no contributions, today off a boundary, projected to 2050.
    // Canonical value: 174494.02. The pre-fix forecast overstated this as
    // 186828.15 (+$12,334.13 / +7.07%). After the fix the forecast tracks the
    // canonical engine to within intra-step rounding (a few cents).
    const inv = makeInvestment({
      StartDate: new Date(2020, 0, 1),
      StartingBalance: 10000,
      AverageReturnRate: 10,
      CompoundingPeriod: CompoundingFrequency.Annually,
    });
    const offBoundaryToday = new Date(2026, 8, 16);
    const future = new Date(2050, 0, 1);

    const canonical = generateInvestmentGrowth(inv, future).at(-1)!.TotalValue;
    const forecast = forecastInvestment(inv, future, 0, offBoundaryToday).at(
      -1
    )!.Value;

    expect(canonical).toBeCloseTo(174494.02, 2);
    // Agreement within a few cents — and nowhere near the old 186828.15
    // overstatement (~$12k). The pre-fix code would fail this assertion by
    // four orders of magnitude.
    expect(Math.abs(forecast - canonical)).toBeLessThanOrEqual(0.05);
    expect(forecast).toBeLessThan(180000);
  });
});

describe('Consistency: step-up anniversary attribution (reconciled, ROADMAP §8.1)', () => {
  // The two investment engines agree to the cent WITHOUT step-ups (asserted
  // above) and now ALSO agree WITH a yearly step-up. They previously diverged:
  // the monthly-grid forecastInvestment stepped up one contribution earlier than
  // the period-indexed generateInvestmentGrowth (an off-by-one in anniversary
  // attribution). forecastInvestment now attributes each grid-month contribution
  // to the period-opening contribution one interval earlier (the canonical
  // engine's convention), so the engines reconcile. This was the `it.fails`
  // tripwire the Charter's "failing test before the fix" rule required; it is
  // now a normal passing `it`.
  it('forecastInvestment matches generateInvestmentGrowth with a yearly step-up', () => {
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

    // Monthly compounding => boundary month === period index. They must agree at
    // every month, including across anniversaries where the step-up applies.
    for (let month = 1; month < growth.length; month++) {
      expect(cents(forecast[month].Value)).toBe(
        cents(growth[month].TotalValue)
      );
    }
  });
});
