import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  generateAmortizationSchedule,
  getMonthlyPayment,
  getTerms,
} from './loan-helpers';
import {
  employerMatchOnContribution,
  getContributionForYear,
} from './investment-helpers';
import {
  forecastLoan,
  forecastInvestment,
  forecastNetWorth,
} from './forecast-helpers';
import { Loan } from '../models/loan-model';
import {
  CompoundingFrequency,
  Investment,
  StepUpType,
} from '../models/investment-model';

// Math Correctness Charter §4, layer 3 — Property / invariant tests.
//
// fast-check drives randomized inputs through the helpers and asserts the
// invariants that must hold no matter the input: money conservation in cents,
// non-negative balances, monotonicity of extra payments/contributions, and
// pointwise net-worth additivity. Comparisons are in integer cents per
// PRECISION.md (raw doubles can differ by float epsilon while agreeing to the
// cent).

const cents = (value: number): number => Math.round(value * 100);

// Build a loan whose EndDate is `termMonths` after StartDate, with a payment
// that amortizes the principal over its term.
const loanArb = fc
  .record({
    startYear: fc.integer({ min: 2000, max: 2040 }),
    startMonth: fc.integer({ min: 0, max: 11 }),
    termMonths: fc.integer({ min: 1, max: 480 }),
    principal: fc.integer({ min: 1000, max: 2_000_000 }),
    rateBps: fc.integer({ min: 0, max: 3000 }), // 0%–30%
  })
  .map(({ startYear, startMonth, termMonths, principal, rateBps }): Loan => {
    const StartDate = new Date(startYear, startMonth, 1);
    const EndDate = new Date(startYear, startMonth + termMonths, 1);
    const InterestRate = rateBps / 100;
    const loan: Loan = {
      Id: 'L',
      Provider: '',
      Name: '',
      InterestRate,
      StartDate,
      EndDate,
      Principal: principal,
      CurrentAmount: principal,
    };
    return {
      ...loan,
      MonthlyPayment: getMonthlyPayment(
        principal,
        InterestRate,
        getTerms(loan)
      ),
    };
  });

const investmentArb = fc
  .record({
    startYear: fc.integer({ min: 2000, max: 2030 }),
    startMonth: fc.integer({ min: 0, max: 11 }),
    startingBalance: fc.integer({ min: 0, max: 1_000_000 }),
    rateBps: fc.integer({ min: 0, max: 2000 }),
    compounding: fc.constantFrom(
      CompoundingFrequency.Monthly,
      CompoundingFrequency.Quarterly,
      CompoundingFrequency.Annually
    ),
    contribution: fc.integer({ min: 0, max: 5000 }),
  })
  .map(
    ({
      startYear,
      startMonth,
      startingBalance,
      rateBps,
      compounding,
      contribution,
    }): Investment => ({
      Id: 'I',
      Provider: '',
      Name: '',
      StartDate: new Date(startYear, startMonth, 1),
      StartingBalance: startingBalance,
      AverageReturnRate: rateBps / 100,
      CompoundingPeriod: compounding,
      RecurringContribution: contribution,
      ContributionFrequency: CompoundingFrequency.Monthly,
    })
  );

describe('Property: amortization schedule invariants', () => {
  it('payment splits exactly into principal + interest (non-final terms)', () => {
    fc.assert(
      fc.property(loanArb, (loan) => {
        const schedule = generateAmortizationSchedule(loan);
        const payment = cents(loan.MonthlyPayment ?? 0);
        // The final term is set to the exact remaining balance, so it is exempt.
        for (let i = 0; i < schedule.length - 1; i++) {
          const entry = schedule[i];
          if (entry.RemainingBalance <= 0) continue; // already paid off
          expect(
            cents(entry.PrincipalPayment) + cents(entry.InterestPayment)
          ).toBe(payment);
        }
      })
    );
  });

  it('remaining balance is never negative and never increases', () => {
    fc.assert(
      fc.property(loanArb, (loan) => {
        const schedule = generateAmortizationSchedule(loan);
        let prev = loan.Principal;
        for (const entry of schedule) {
          expect(entry.RemainingBalance).toBeGreaterThanOrEqual(0);
          expect(entry.RemainingBalance).toBeLessThanOrEqual(prev + 1e-6);
          prev = entry.RemainingBalance;
        }
      })
    );
  });
});

describe('Property: forecastLoan invariants', () => {
  it('balance never goes negative', () => {
    fc.assert(
      fc.property(loanArb, (loan) => {
        const series = forecastLoan(loan, loan.EndDate, 0, loan.StartDate);
        for (const point of series) {
          expect(point.Value).toBeGreaterThanOrEqual(0);
        }
      })
    );
  });

  it('more extra payment never leaves a higher balance at any month', () => {
    fc.assert(
      fc.property(loanArb, fc.integer({ min: 1, max: 2000 }), (loan, extra) => {
        const base = forecastLoan(loan, loan.EndDate, 0, loan.StartDate);
        const more = forecastLoan(loan, loan.EndDate, extra, loan.StartDate);
        for (let m = 0; m < base.length; m++) {
          expect(cents(more[m].Value)).toBeLessThanOrEqual(
            cents(base[m].Value)
          );
        }
      })
    );
  });
});

describe('Property: forecastInvestment invariants', () => {
  it('more extra contribution never yields a lower value at any month', () => {
    fc.assert(
      fc.property(
        investmentArb,
        fc.integer({ min: 1, max: 3000 }),
        (inv, extra) => {
          const horizon = new Date(
            inv.StartDate.getFullYear() + 20,
            inv.StartDate.getMonth(),
            1
          );
          const base = forecastInvestment(inv, horizon, 0, inv.StartDate);
          const more = forecastInvestment(inv, horizon, extra, inv.StartDate);
          for (let m = 0; m < base.length; m++) {
            expect(cents(more[m].Value)).toBeGreaterThanOrEqual(
              cents(base[m].Value)
            );
          }
        }
      )
    );
  });
});

describe('Property: net worth is pointwise additive', () => {
  it('forecastNetWorth = Σ investments − Σ loans at every month', () => {
    fc.assert(
      fc.property(
        fc.array(loanArb, { maxLength: 3 }),
        fc.array(investmentArb, { maxLength: 3 }),
        (loans, investments) => {
          // Give every entity a unique id so scenario keys do not collide.
          loans.forEach((l, i) => (l.Id = `loan-${i}`));
          investments.forEach((inv, i) => (inv.Id = `inv-${i}`));
          const today = new Date(2024, 0, 1);
          const horizon = new Date(2034, 0, 1);

          const netWorth = forecastNetWorth(
            loans,
            investments,
            horizon,
            undefined,
            today
          );
          const loanSeries = loans.map((l) =>
            forecastLoan(l, horizon, 0, today)
          );
          const investmentSeries = investments.map((inv) =>
            forecastInvestment(inv, horizon, 0, today)
          );

          for (let m = 0; m < netWorth.length; m++) {
            const assets = investmentSeries.reduce(
              (sum, s) => sum + s[m].Value,
              0
            );
            const debts = loanSeries.reduce((sum, s) => sum + s[m].Value, 0);
            expect(cents(netWorth[m].Value)).toBe(cents(assets - debts));
          }
        }
      )
    );
  });
});

describe('Property: contribution step-ups', () => {
  it('year 1 is always the base contribution (no step-up yet)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100000 }),
        fc.integer({ min: 0, max: 100000 }),
        fc.constantFrom(StepUpType.Flat, StepUpType.Percentage),
        (base, stepUp, type) => {
          expect(getContributionForYear(base, 1, stepUp, type)).toBe(
            Math.round(base * 100) / 100
          );
        }
      )
    );
  });

  it('a positive step-up is monotonically non-decreasing across years', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100000 }),
        fc.integer({ min: 1, max: 5000 }),
        fc.constantFrom(StepUpType.Flat, StepUpType.Percentage),
        fc.integer({ min: 1, max: 49 }),
        (base, stepUp, type, year) => {
          const thisYear = getContributionForYear(base, year, stepUp, type);
          const nextYear = getContributionForYear(base, year + 1, stepUp, type);
          expect(nextYear).toBeGreaterThanOrEqual(thisYear);
        }
      )
    );
  });
});

describe('Property: employer match invariants (ROADMAP 8.1)', () => {
  const investmentWith = (
    rate: number,
    limitPct: number,
    salary: number
  ): Investment => ({
    Id: 'p',
    Provider: '',
    Name: '',
    StartDate: new Date(2020, 0, 1),
    StartingBalance: 0,
    AverageReturnRate: 0,
    CompoundingPeriod: CompoundingFrequency.Annually,
    EmployerMatchRate: rate,
    EmployerMatchLimitPct: limitPct,
    AnnualSalary: salary,
  });

  const matchArb = fc.record({
    rate: fc.double({ min: 0, max: 200, noNaN: true }),
    limitPct: fc.double({ min: 0, max: 50, noNaN: true }),
    salary: fc.double({ min: 0, max: 500000, noNaN: true }),
    prior: fc.double({ min: 0, max: 300000, noNaN: true }),
    step: fc.double({ min: 0, max: 60000, noNaN: true }),
  });

  it('is non-negative and never exceeds rate% of the step or of the annual cap', () => {
    fc.assert(
      fc.property(matchArb, ({ rate, limitPct, salary, prior, step }) => {
        const inv = investmentWith(rate, limitPct, salary);
        const m = employerMatchOnContribution(prior, step, inv);
        const cap = (limitPct / 100) * salary;
        expect(m).toBeGreaterThanOrEqual(0);
        expect(m).toBeLessThanOrEqual((rate / 100) * step + 1e-6);
        expect(m).toBeLessThanOrEqual((rate / 100) * cap + 1e-6);
      })
    );
  });

  it('never decreases as the contribution grows (more in, never less match)', () => {
    fc.assert(
      fc.property(
        matchArb,
        fc.double({ min: 0, max: 60000, noNaN: true }),
        ({ rate, limitPct, salary, prior, step }, extra) => {
          const inv = investmentWith(rate, limitPct, salary);
          const less = employerMatchOnContribution(prior, step, inv);
          const more = employerMatchOnContribution(prior, step + extra, inv);
          expect(more).toBeGreaterThanOrEqual(less - 1e-6);
        }
      )
    );
  });

  it('telescopes: a year filled in many steps earns the same total as one step', () => {
    // The invariant that makes the monthly forecast and the period growth engine
    // agree — the match summed over arbitrary sub-steps equals the match on the
    // whole, so different contribution/compounding granularities reconcile.
    fc.assert(
      fc.property(
        fc.double({ min: 1, max: 100, noNaN: true }),
        fc.double({ min: 1, max: 20, noNaN: true }),
        fc.double({ min: 1000, max: 300000, noNaN: true }),
        fc.array(fc.double({ min: 0, max: 5000, noNaN: true }), {
          minLength: 1,
          maxLength: 24,
        }),
        (rate, limitPct, salary, steps) => {
          const inv = investmentWith(rate, limitPct, salary);
          let used = 0;
          let stepwise = 0;
          for (const s of steps) {
            stepwise += employerMatchOnContribution(used, s, inv);
            used += s;
          }
          const total = steps.reduce((a, b) => a + b, 0);
          const oneShot = employerMatchOnContribution(0, total, inv);
          expect(stepwise).toBeCloseTo(oneShot, 2);
        }
      )
    );
  });
});
