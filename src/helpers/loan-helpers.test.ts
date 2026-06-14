import { describe, it, expect } from 'vitest';
import {
  getTerms,
  getMonthlyPayment,
  getPitCalculation,
  generateAmortizationSchedule,
} from './loan-helpers';
import { defaultPit, Loan } from '../models/loan-model';

describe('Loan Helpers', () => {
  describe('getMonthlyPayment', () => {
    it('should calculate monthly payment correctly', () => {
      const principal = 100000;
      const interestRate = 3.5;
      const terms = 360; // 30 years

      const payment = getMonthlyPayment(principal, interestRate, terms);

      // Expected monthly payment for 100k at 3.5% for 30 years
      expect(payment).toBeCloseTo(449.04, 0);
    });

    it('should return 0 for invalid inputs', () => {
      expect(getMonthlyPayment(0, 3.5, 360)).toBe(0);
      expect(getMonthlyPayment(100000, -1, 360)).toBe(0);
      expect(getMonthlyPayment(100000, 3.5, 0)).toBe(0);
    });

    // Regression tests for issue #44: 0% interest loans returned $0 due to
    // the guard `interestRate <= 0` blocking the valid zero-rate branch.

    it('should return principal/terms for a 0% interest loan (exact division)', () => {
      // Arithmetic: 12000 / 60 = 200.00  (no rounding needed)
      expect(getMonthlyPayment(12000, 0, 60)).toBe(200.0);
    });

    it('should return principal/terms rounded to cents for a 0% interest loan (non-exact division)', () => {
      // Arithmetic: 10000 / 36 = 277.7777... → rounds to 277.78
      expect(getMonthlyPayment(10000, 0, 36)).toBe(277.78);
    });

    it('should still return 0 for non-positive principal with 0% interest', () => {
      expect(getMonthlyPayment(0, 0, 60)).toBe(0);
    });

    it('should still return 0 for non-positive terms with 0% interest', () => {
      expect(getMonthlyPayment(12000, 0, 0)).toBe(0);
    });
  });

  describe('getTerms', () => {
    it('should calculate number of months between dates', () => {
      const loan: Loan = {
        Id: 'test-id-1',
        Provider: 'Test Lender',
        Name: 'Test Loan',
        StartDate: new Date('2025-01-01'),
        EndDate: new Date('2026-01-01'),
        Principal: 100000,
        CurrentAmount: 100000,
        InterestRate: 3.5,
      };

      const terms = getTerms(loan);
      expect(terms).toBe(13); // 12 months + 1
    });

    it('should calculate terms up to a specific date', () => {
      const loan: Loan = {
        Id: 'test-id-2',
        Provider: 'Test Lender',
        Name: 'Test Loan',
        StartDate: new Date('2025-01-01'),
        EndDate: new Date('2030-01-01'),
        Principal: 100000,
        CurrentAmount: 100000,
        InterestRate: 3.5,
      };

      const terms = getTerms(loan, new Date('2026-01-01'));
      expect(terms).toBe(13); // 12 months + 1
    });
  });

  describe('generateAmortizationSchedule', () => {
    it('should generate amortization schedule', () => {
      const loan: Loan = {
        Id: 'test-id-3',
        Provider: 'Test Lender',
        Name: 'Test Loan',
        StartDate: new Date('2025-01-01'),
        EndDate: new Date('2025-12-01'),
        Principal: 10000,
        CurrentAmount: 10000,
        InterestRate: 6,
        MonthlyPayment: 860.66,
      };

      const schedule = generateAmortizationSchedule(loan);

      // Should have 12 entries (12 months)
      expect(schedule.length).toBe(12);

      // First payment should pay some interest and principal
      expect(schedule[0].Term).toBe(1);
      expect(schedule[0].InterestPayment).toBeGreaterThan(0);
      expect(schedule[0].PrincipalPayment).toBeGreaterThan(0);

      // Last payment should have remaining balance of 0
      expect(schedule[11].RemainingBalance).toBe(0);
    });

    it('should return empty array for undefined monthly payment', () => {
      const loan: Loan = {
        Id: 'test-id-4',
        Provider: 'Test Lender',
        Name: 'Test Loan',
        StartDate: new Date('2025-01-01'),
        EndDate: new Date('2026-01-01'),
        Principal: 10000,
        CurrentAmount: 10000,
        InterestRate: 6,
      };

      const schedule = generateAmortizationSchedule(loan);
      expect(schedule.length).toBe(0);
    });

    it('should generate a correct amortization schedule for a 0% interest loan', () => {
      // Regression for issue #44: 0% loan schedule must have all-zero interest
      // payments and the balance must reach exactly 0 at the final term.
      // Arithmetic: 12000 / 60 = 200.00/month
      const loan: Loan = {
        Id: 'test-id-zero-rate',
        Provider: 'Test Lender',
        Name: 'Zero Rate Loan',
        StartDate: new Date('2025-01-01'),
        EndDate: new Date('2029-12-01'),
        Principal: 12000,
        CurrentAmount: 12000,
        InterestRate: 0,
        MonthlyPayment: 200.0,
      };

      const schedule = generateAmortizationSchedule(loan);

      expect(schedule.length).toBe(60);

      // Every interest payment must be $0 for a 0% loan
      schedule.forEach((entry) => {
        expect(entry.InterestPayment).toBe(0);
      });

      // Every principal payment must be $200 (except possibly the last due to
      // the "isLastTerm sets remainingBalance to 0" logic)
      for (let i = 0; i < schedule.length - 1; i++) {
        expect(schedule[i].PrincipalPayment).toBe(200.0);
      }

      // Final remaining balance must be 0
      expect(schedule[59].RemainingBalance).toBe(0);
    });

    it('should generate partial schedule when terms provided', () => {
      const loan: Loan = {
        Id: 'test-id-5',
        Provider: 'Test Lender',
        Name: 'Test Loan',
        StartDate: new Date('2025-01-01'),
        EndDate: new Date('2025-12-01'),
        Principal: 10000,
        CurrentAmount: 10000,
        InterestRate: 6,
        MonthlyPayment: 860.66,
      };

      const schedule = generateAmortizationSchedule(loan, 6);

      // Should have only 6 entries
      expect(schedule.length).toBe(6);
      expect(schedule[5].Term).toBe(6);
    });

    it('stops at payoff without emitting garbage rows when the payment exceeds the amortizing amount', () => {
      // Regression for #59: a MonthlyPayment large enough to clear the balance
      // before the full term must end the schedule at payoff — no extra rows
      // with negative interest, and no catastrophic final row.
      const loan: Loan = {
        Id: 'test-id-early-payoff',
        Provider: 'Test Lender',
        Name: 'Aggressive Payoff',
        StartDate: new Date('2024-01-01'),
        EndDate: new Date('2034-01-01'), // 121 scheduled terms
        Principal: 100000,
        CurrentAmount: 100000,
        InterestRate: 5,
        MonthlyPayment: 5000, // far above the ~1060 amortizing payment
      };

      const schedule = generateAmortizationSchedule(loan);

      // Far fewer than the 121 scheduled terms — it ends at payoff (~term 21).
      expect(schedule.length).toBeLessThan(30);
      // The balance closes to exactly 0 on the final emitted row.
      expect(schedule[schedule.length - 1].RemainingBalance).toBe(0);
      // No post-payoff garbage anywhere in the schedule.
      schedule.forEach((entry) => {
        expect(entry.InterestPayment).toBeGreaterThanOrEqual(0); // never negative
        expect(entry.RemainingBalance).toBeGreaterThanOrEqual(0);
        expect(entry.PrincipalPayment).toBeGreaterThanOrEqual(0);
        // No catastrophic payment: principal can't exceed the monthly payment.
        expect(entry.PrincipalPayment).toBeLessThanOrEqual(5000);
      });
    });

    it('returns an empty schedule for a non-positive MonthlyPayment', () => {
      // Regression for #51: a stored 0 is "no payment specified", not a real
      // $0/month payment — which would otherwise grow the balance forever.
      const loan: Loan = {
        Id: 'test-id-zero-payment',
        Provider: 'Test Lender',
        Name: 'Zero Payment Loan',
        StartDate: new Date('2024-01-01'),
        EndDate: new Date('2034-01-01'),
        Principal: 100000,
        CurrentAmount: 100000,
        InterestRate: 5,
        MonthlyPayment: 0,
      };

      expect(generateAmortizationSchedule(loan)).toEqual([]);
    });
  });

  describe('getPitCalculation', () => {
    it('should calculate point-in-time loan values', () => {
      const loan: Loan = {
        Id: 'test-id-6',
        Provider: 'Test Lender',
        Name: 'Test Loan',
        StartDate: new Date('2025-01-01'),
        EndDate: new Date('2026-01-01'),
        Principal: 10000,
        CurrentAmount: 10000,
        InterestRate: 6,
        MonthlyPayment: 860.66,
      };

      const pit = getPitCalculation(loan, new Date('2025-07-01'));

      // After 6 months, should have paid some principal and interest
      expect(pit.PaidTerms).toBe(7);
      expect(pit.PaidPrincipal).toBeGreaterThan(0);
      expect(pit.PaidInterest).toBeGreaterThan(0);
      expect(pit.RemainingPrincipal).toBeLessThan(10000);
      expect(pit.RemainingTerms).toBeGreaterThan(0);
    });

    it('should only sum interest up to paidTerms', () => {
      const loan: Loan = {
        Id: 'test-id-7',
        Provider: 'Test Lender',
        Name: 'Test Loan',
        StartDate: new Date('2025-01-01'),
        EndDate: new Date('2025-12-01'),
        Principal: 10000,
        CurrentAmount: 10000,
        InterestRate: 6,
        MonthlyPayment: 860.66,
      };

      const fullSchedule = generateAmortizationSchedule(loan);

      // Query at 6 months into a 12-month loan
      const pitPartial = getPitCalculation(loan, new Date('2025-07-01'));

      // PaidInterest should only reflect the first 7 terms, not the full 12
      const expectedInterest = fullSchedule
        .slice(0, pitPartial.PaidTerms)
        .reduce((acc, entry) => acc + entry.InterestPayment, 0);

      expect(pitPartial.PaidInterest).toBeCloseTo(expectedInterest, 2);

      // Sanity check: interest at 6 months must be less than interest for the full loan
      const fullPit = getPitCalculation(loan, loan.EndDate);
      expect(pitPartial.PaidInterest).toBeLessThan(fullPit.PaidInterest);
    });

    it('should return defaultPit when MonthlyPayment is undefined (no schedule)', () => {
      const loan: Loan = {
        Id: 'test-id-no-payment',
        Provider: 'Test Lender',
        Name: 'No Payment Loan',
        StartDate: new Date('2025-01-01'),
        EndDate: new Date('2026-01-01'),
        Principal: 10000,
        CurrentAmount: 10000,
        InterestRate: 6,
        // MonthlyPayment intentionally omitted
      };

      const pit = getPitCalculation(loan, new Date('2025-07-01'));

      expect(pit).toEqual(defaultPit);
    });

    it('does not crash and reports payoff for a date past an early payoff', () => {
      // Regression for the #66 review of #59: the early-payoff break makes the
      // schedule shorter than the requested term count, so getPitCalculation
      // must read the last EMITTED (payoff) row rather than index past the end
      // (which threw "Cannot read properties of undefined"). PitPopout defaults
      // the date to EndDate, so this fired on open for early-payoff loans.
      const loan: Loan = {
        Id: 'test-id-early-payoff-pit',
        Provider: 'Test Lender',
        Name: 'Aggressive Payoff',
        StartDate: new Date('2024-01-01'),
        EndDate: new Date('2034-01-01'), // 121 scheduled terms
        Principal: 100000,
        CurrentAmount: 100000,
        InterestRate: 5,
        MonthlyPayment: 5000, // pays off ~term 21
      };

      const payoffTerm = generateAmortizationSchedule(loan).length;

      // Querying the end date (well past payoff) must not throw.
      const pit = getPitCalculation(loan, loan.EndDate);

      expect(pit.PaidTerms).toBe(payoffTerm); // the payoff term, not 121
      expect(pit.RemainingPrincipal).toBe(0); // loan is paid off
      expect(pit.PaidPrincipal).toBe(100000); // full principal paid
    });

    it('should return defaultPit (no paid terms) when the date is before StartDate', () => {
      // Regression for #53: a date earlier than StartDate has zero paid terms,
      // not one — the loan has not made any payment yet, so the PIT view must
      // report nothing paid rather than a phantom first installment.
      const loan: Loan = {
        Id: 'test-id-pre-start',
        Provider: 'Test Lender',
        Name: 'Pre-Start Loan',
        StartDate: new Date('2025-06-01'),
        EndDate: new Date('2026-06-01'),
        Principal: 12000,
        CurrentAmount: 12000,
        InterestRate: 6,
        MonthlyPayment: 1032.92,
      };

      // getTerms for a pre-start date is 0 (no payments made yet).
      expect(getTerms(loan, new Date('2025-01-01'))).toBe(0);

      // Query a date before the loan's StartDate
      const pit = getPitCalculation(loan, new Date('2025-01-01'));

      expect(pit.PaidTerms).toBe(0);
      expect(pit).toEqual(defaultPit);
    });
  });

  describe('Edge Cases', () => {
    it('should handle negative interest rate gracefully', () => {
      const payment = getMonthlyPayment(10000, -3.5, 12);
      expect(payment).toBe(0);
    });

    it('should handle very small principal', () => {
      const payment = getMonthlyPayment(1, 3.5, 12);
      expect(payment).toBeGreaterThan(0);
      expect(payment).toBeLessThan(1);
    });

    it('should handle very large principal', () => {
      const payment = getMonthlyPayment(10000000, 3.5, 360);
      expect(payment).toBeGreaterThan(0);
    });
  });
});
