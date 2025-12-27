import { describe, it, expect } from 'vitest';
import {
  getTerms,
  getMonthlyPayment,
  getPitCalculation,
  generateAmortizationSchedule,
} from './loan-helpers';
import { Loan } from '../models/loan-model';

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
      expect(getMonthlyPayment(100000, 0, 360)).toBe(0);
      expect(getMonthlyPayment(100000, -1, 360)).toBe(0);
      expect(getMonthlyPayment(100000, 3.5, 0)).toBe(0);
    });
  });

  describe('getTerms', () => {
    it('should calculate number of months between dates', () => {
      const loan: Loan = {
        Lender: 'Test Lender',
        Name: 'Test Loan',
        StartDate: new Date('2025-01-01'),
        EndDate: new Date('2026-01-01'),
        Principal: 100000,
        InterestRate: 3.5,
      };

      const terms = getTerms(loan);
      expect(terms).toBe(13); // 12 months + 1
    });

    it('should calculate terms up to a specific date', () => {
      const loan: Loan = {
        Lender: 'Test Lender',
        Name: 'Test Loan',
        StartDate: new Date('2025-01-01'),
        EndDate: new Date('2030-01-01'),
        Principal: 100000,
        InterestRate: 3.5,
      };

      const terms = getTerms(loan, new Date('2026-01-01'));
      expect(terms).toBe(13); // 12 months + 1
    });

    it('should return 0 for missing dates', () => {
      const loan: Loan = {
        Lender: 'Test Lender',
        Name: 'Test Loan',
        Principal: 100000,
        InterestRate: 3.5,
      };

      expect(getTerms(loan)).toBe(0);
    });
  });

  describe('generateAmortizationSchedule', () => {
    it('should generate amortization schedule', () => {
      const loan: Loan = {
        Lender: 'Test Lender',
        Name: 'Test Loan',
        StartDate: new Date('2025-01-01'),
        EndDate: new Date('2025-12-01'),
        Principal: 10000,
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
        Lender: 'Test Lender',
        Name: 'Test Loan',
        StartDate: new Date('2025-01-01'),
        EndDate: new Date('2026-01-01'),
        Principal: 10000,
        InterestRate: 6,
      };

      const schedule = generateAmortizationSchedule(loan);
      expect(schedule.length).toBe(0);
    });

    it('should generate partial schedule when terms provided', () => {
      const loan: Loan = {
        Lender: 'Test Lender',
        Name: 'Test Loan',
        StartDate: new Date('2025-01-01'),
        EndDate: new Date('2025-12-01'),
        Principal: 10000,
        InterestRate: 6,
        MonthlyPayment: 860.66,
      };

      const schedule = generateAmortizationSchedule(loan, 6);

      // Should have only 6 entries
      expect(schedule.length).toBe(6);
      expect(schedule[5].Term).toBe(6);
    });
  });

  describe('getPitCalculation', () => {
    it('should calculate point-in-time loan values', () => {
      const loan: Loan = {
        Lender: 'Test Lender',
        Name: 'Test Loan',
        StartDate: new Date('2025-01-01'),
        EndDate: new Date('2026-01-01'),
        Principal: 10000,
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
