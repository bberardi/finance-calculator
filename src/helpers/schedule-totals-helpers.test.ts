import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  getAmortizationTotals,
  getGrowthTotals,
} from './schedule-totals-helpers';
import { generateAmortizationSchedule } from './loan-helpers';
import { generateInvestmentGrowth } from './investment-helpers';
import { AmortizationScheduleEntry, Loan } from '../models/loan-model';
import {
  CompoundingFrequency,
  Investment,
  InvestmentGrowthEntry,
} from '../models/investment-model';

// Math Correctness Charter §4 coverage for the popout lifetime totals (6.5).
// The helpers are pure reductions, so the proof is: (1) two hand-derived
// reference points per function, (2) the additive invariants they advertise,
// and (3) a property asserting they equal the cent-rounded sum of the series.

describe('getAmortizationTotals', () => {
  // Reference (hand-derived). $1,000 at 12%/yr (1%/mo) over a 2-term schedule.
  // PMT = 1000 · 0.01·1.01² / (1.01² − 1) = 507.51 (rounded).
  //   Term 1: interest round(1000·0.01)=10.00, principal 507.51−10=497.51,
  //           balance 502.49.
  //   Term 2 (closing): interest round(502.49·0.01)=5.02, principal=502.49,
  //           balance 0.
  // Totals: principal 1000.00, interest 15.02, paid 1015.02.
  const referenceLoan: Loan = {
    Id: 'ref',
    Provider: 'Bank',
    Name: 'Reference',
    InterestRate: 12,
    Principal: 1000,
    CurrentAmount: 1000,
    MonthlyPayment: 507.51,
    StartDate: new Date(2024, 0, 1),
    EndDate: new Date(2024, 1, 1), // getTerms → 2
  };

  it('matches a hand-derived 2-term schedule to the cent', () => {
    const schedule = generateAmortizationSchedule(referenceLoan);
    expect(schedule).toHaveLength(2);
    expect(getAmortizationTotals(schedule)).toEqual({
      totalPrincipal: 1000,
      totalInterest: 15.02,
      totalPaid: 1015.02,
    });
  });

  it('sums an interest-free schedule with zero total interest', () => {
    // $12,000 over 60 equal $200 instalments, no interest.
    const zeroRate: Loan = {
      ...referenceLoan,
      InterestRate: 0,
      Principal: 12000,
      CurrentAmount: 12000,
      MonthlyPayment: 200,
      StartDate: new Date(2024, 0, 1),
      EndDate: new Date(2028, 11, 1), // 60 terms
    };
    const schedule = generateAmortizationSchedule(zeroRate);
    const totals = getAmortizationTotals(schedule);
    expect(totals.totalInterest).toBe(0);
    expect(totals.totalPrincipal).toBe(12000);
    expect(totals.totalPaid).toBe(12000);
  });

  it('total principal repaid over the life equals the original principal', () => {
    // Money conservation: a schedule that runs to payoff repays exactly the
    // principal, never more or less.
    const schedule = generateAmortizationSchedule(referenceLoan);
    expect(getAmortizationTotals(schedule).totalPrincipal).toBe(
      referenceLoan.Principal
    );
  });

  it('returns zeros for an empty schedule', () => {
    expect(getAmortizationTotals([])).toEqual({
      totalPrincipal: 0,
      totalInterest: 0,
      totalPaid: 0,
    });
  });

  it('totalPaid always equals totalPrincipal + totalInterest (property)', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            Term: fc.integer({ min: 1, max: 600 }),
            PrincipalPayment: fc.integer({ min: 0, max: 1_000_000 }),
            InterestPayment: fc.integer({ min: 0, max: 1_000_000 }),
            RemainingBalance: fc.integer({ min: 0, max: 1_000_000 }),
          }),
          { maxLength: 50 }
        ),
        (entries: AmortizationScheduleEntry[]) => {
          const t = getAmortizationTotals(entries);
          // Each field is the cent-rounded sum of its column.
          const principal =
            Math.round(
              entries.reduce((s, e) => s + e.PrincipalPayment, 0) * 100
            ) / 100;
          const interest =
            Math.round(
              entries.reduce((s, e) => s + e.InterestPayment, 0) * 100
            ) / 100;
          expect(t.totalPrincipal).toBe(principal);
          expect(t.totalInterest).toBe(interest);
          expect(t.totalPaid).toBe(
            Math.round((principal + interest) * 100) / 100
          );
        }
      )
    );
  });
});

describe('getGrowthTotals', () => {
  // Reference (hand-derived). $1,000 at 10%/yr, annual compounding, no
  // contributions, over exactly 2 years:
  //   Period 1: 1000 → 1100 (interest 100)
  //   Period 2: 1100 → 1210 (interest 110)
  // Totals: contributions 0, interest 210, invested 1000, value 1210.
  const referenceInvestment: Investment = {
    Id: 'ref',
    Provider: 'Fund',
    Name: 'Reference',
    StartDate: new Date(2020, 0, 1),
    StartingBalance: 1000,
    AverageReturnRate: 10,
    CompoundingPeriod: CompoundingFrequency.Annually,
  };

  it('matches a hand-derived 2-year annual schedule to the cent', () => {
    const growth = generateInvestmentGrowth(
      referenceInvestment,
      new Date(2022, 0, 1)
    );
    expect(
      getGrowthTotals(growth, referenceInvestment.StartingBalance)
    ).toEqual({
      totalContributions: 0,
      totalInterest: 210,
      endingInvested: 1000,
      endingValue: 1210,
    });
  });

  it('money conservation: ending value = invested + interest earned', () => {
    const growth = generateInvestmentGrowth(
      referenceInvestment,
      new Date(2022, 0, 1)
    );
    const t = getGrowthTotals(growth, referenceInvestment.StartingBalance);
    expect(t.endingValue).toBe(t.endingInvested + t.totalInterest);
  });

  it('counts recurring contributions, excluding the starting balance', () => {
    // $100/yr contributions on a 0% investment so the value is pure principal.
    const withContributions: Investment = {
      ...referenceInvestment,
      AverageReturnRate: 0,
      RecurringContribution: 100,
      ContributionFrequency: CompoundingFrequency.Annually,
    };
    const growth = generateInvestmentGrowth(
      withContributions,
      new Date(2022, 0, 1)
    );
    const t = getGrowthTotals(growth, withContributions.StartingBalance);
    // Contributions are summed from the series, never including the $1,000 start.
    expect(t.totalContributions).toBe(
      growth.reduce((s, e) => s + e.ContributionAmount, 0)
    );
    expect(t.totalInterest).toBe(0);
    expect(t.endingInvested).toBe(1000 + t.totalContributions);
  });

  it('falls back to the starting balance for an empty schedule', () => {
    expect(getGrowthTotals([], 2500)).toEqual({
      totalContributions: 0,
      totalInterest: 0,
      endingInvested: 2500,
      endingValue: 2500,
    });
  });

  it('a Period-0-only schedule reports zero contributions and interest', () => {
    const periodZeroOnly: InvestmentGrowthEntry[] = [
      { Period: 0, ContributionAmount: 0, InterestEarned: 0, TotalValue: 5000 },
    ];
    expect(getGrowthTotals(periodZeroOnly, 5000)).toEqual({
      totalContributions: 0,
      totalInterest: 0,
      endingInvested: 5000,
      endingValue: 5000,
    });
  });

  it('totals equal the cent-rounded sums of the series (property)', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            Period: fc.integer({ min: 0, max: 600 }),
            ContributionAmount: fc.integer({ min: 0, max: 1_000_000 }),
            InterestEarned: fc.integer({ min: 0, max: 1_000_000 }),
            TotalValue: fc.integer({ min: 0, max: 100_000_000 }),
          }),
          { minLength: 1, maxLength: 50 }
        ),
        fc.integer({ min: 0, max: 1_000_000 }),
        (entries: InvestmentGrowthEntry[], startingBalance: number) => {
          const t = getGrowthTotals(entries, startingBalance);
          const contributions =
            Math.round(
              entries.reduce((s, e) => s + e.ContributionAmount, 0) * 100
            ) / 100;
          const interest =
            Math.round(
              entries.reduce((s, e) => s + e.InterestEarned, 0) * 100
            ) / 100;
          expect(t.totalContributions).toBe(contributions);
          expect(t.totalInterest).toBe(interest);
          expect(t.endingInvested).toBe(
            Math.round((startingBalance + contributions) * 100) / 100
          );
          expect(t.endingValue).toBe(entries[entries.length - 1].TotalValue);
        }
      )
    );
  });
});
