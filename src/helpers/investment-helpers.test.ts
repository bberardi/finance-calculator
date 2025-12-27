import { describe, it, expect } from 'vitest';
import {
  generateInvestmentGrowth,
  getPeriodsPerYear,
  getPitInvestmentCalculation,
} from './investment-helpers';
import { Investment, CompoundingFrequency } from '../models/investment-model';

describe('Investment Helpers', () => {
  describe('getPeriodsPerYear', () => {
    it('should return 12 for monthly compounding', () => {
      expect(getPeriodsPerYear(CompoundingFrequency.Monthly)).toBe(12);
    });

    it('should return 4 for quarterly compounding', () => {
      expect(getPeriodsPerYear(CompoundingFrequency.Quarterly)).toBe(4);
    });

    it('should return 1 for annually compounding', () => {
      expect(getPeriodsPerYear(CompoundingFrequency.Annually)).toBe(1);
    });
  });

  describe('Annually Compounded Investment Calculations', () => {
    // Test data from the issue:
    // Investment start date: 1/1/2025
    // Amount: 10,000
    // Rate: 4.23
    // 1/1/2026 = $10,423.00, $423.00 interest
    // 1/1/2030 = $12,301.66, $499.24 interest
    // 1/1/2055 = $34,656.30 total, $1,406.47 interest

    const startDate = new Date('2025-01-01');
    const principal = 10000;
    const annualRate = 4.23;

    describe('generateInvestmentGrowth', () => {
      const investment: Investment = {
        Provider: 'Test Provider',
        Name: 'Test Investment',
        StartDate: startDate,
        StartingBalance: principal,
        AverageReturnRate: annualRate,
        CompoundingPeriod: CompoundingFrequency.Annually,
      };

      it('should generate correct growth data for 1/1/2026', () => {
        const endDate = new Date('2026-01-01');
        const growth = generateInvestmentGrowth(investment, endDate);

        // Should have period 0 (initial) and period 1 (after 1 year)
        expect(growth.length).toBe(2);

        // Period 0 - initial state
        expect(growth[0].Period).toBe(0);
        expect(growth[0].TotalValue).toBe(10000.0);
        expect(growth[0].InterestEarned).toBe(0);

        // Period 1 - after 1 year
        expect(growth[1].Period).toBe(1);
        expect(growth[1].TotalValue).toBe(10423.0);
        // Note: InterestEarned here is for period 1 only
        expect(growth[1].InterestEarned).toBe(423.0);
      });

      it('should generate correct growth data for 1/1/2030', () => {
        const endDate = new Date('2030-01-01');
        const growth = generateInvestmentGrowth(investment, endDate);

        // Should have 6 periods (0-5, representing years 2025-2030)
        expect(growth.length).toBe(6);

        // Period 5 - after 5 years (1/1/2030)
        const lastPeriod = growth[5];
        expect(lastPeriod.Period).toBe(5);
        expect(lastPeriod.TotalValue).toBe(12301.66);
        // Note: InterestEarned here is for period 5 only, not cumulative
        expect(lastPeriod.InterestEarned).toBe(499.24);
      });

      it('should generate correct growth data for 1/1/2055', () => {
        const endDate = new Date('2055-01-01');
        const growth = generateInvestmentGrowth(investment, endDate);

        // Should have 31 periods (0-30, representing years 2025-2055)
        expect(growth.length).toBe(31);

        // Period 30 - after 30 years (1/1/2055)
        const lastPeriod = growth[30];
        expect(lastPeriod.Period).toBe(30);
        expect(lastPeriod.TotalValue).toBe(34656.3);
        // Note: InterestEarned here is for period 30 only, not cumulative
        expect(lastPeriod.InterestEarned).toBe(1406.47);
      });
    });

    describe('getPitInvestmentCalculation', () => {
      const investment: Investment = {
        Provider: 'Test Provider',
        Name: 'Test Investment',
        StartDate: startDate,
        StartingBalance: principal,
        AverageReturnRate: annualRate,
        CompoundingPeriod: CompoundingFrequency.Annually,
      };

      it('should calculate correct PIT values for 1/1/2026', () => {
        const endDate = new Date('2026-01-01');
        const pit = getPitInvestmentCalculation(investment, endDate);

        // CurrentPeriods counts inclusively (includes the period being calculated)
        expect(pit.CurrentPeriods).toBe(2);
        expect(pit.TotalContributions).toBe(10000.0);
        expect(pit.CurrentValue).toBe(10423.0);
        // Note: TotalInterestEarned is cumulative over all years
        expect(pit.TotalInterestEarned).toBe(423.0);
      });

      it('should calculate correct PIT values for 1/1/2030', () => {
        const endDate = new Date('2030-01-01');
        const pit = getPitInvestmentCalculation(investment, endDate);

        // CurrentPeriods counts inclusively (includes the period being calculated)
        expect(pit.CurrentPeriods).toBe(6);
        expect(pit.TotalContributions).toBe(10000.0);
        expect(pit.CurrentValue).toBe(12301.66);
        // Note: TotalInterestEarned is cumulative over all years
        expect(pit.TotalInterestEarned).toBe(2301.66);
      });

      it('should calculate correct PIT values for 1/1/2055', () => {
        const endDate = new Date('2055-01-01');
        const pit = getPitInvestmentCalculation(investment, endDate);

        // CurrentPeriods counts inclusively (includes the period being calculated)
        expect(pit.CurrentPeriods).toBe(31);
        expect(pit.TotalContributions).toBe(10000.0);
        expect(pit.CurrentValue).toBe(34656.3);
        // Note: TotalInterestEarned is cumulative over all years
        expect(pit.TotalInterestEarned).toBe(24656.3);
      });
    });
  });

  describe('Monthly Compounded Investment Calculations (extensibility)', () => {
    it('should generate growth data for monthly compounded investments', () => {
      const investment: Investment = {
        Provider: 'Test Provider',
        Name: 'Monthly Test',
        StartDate: new Date('2025-01-01'),
        StartingBalance: 10000,
        AverageReturnRate: 4.23,
        CompoundingPeriod: CompoundingFrequency.Monthly,
      };

      const endDate = new Date('2026-01-01');
      const growth = generateInvestmentGrowth(investment, endDate);

      // Should have 13 periods (0 initial + 12 months)
      expect(growth.length).toBe(13);
      expect(growth[0].Period).toBe(0);
      expect(growth[12].Period).toBe(12);
    });
  });

  describe('Quarterly Compounded Investment Calculations (extensibility)', () => {
    it('should generate growth data for quarterly compounded investments', () => {
      const investment: Investment = {
        Provider: 'Test Provider',
        Name: 'Quarterly Test',
        StartDate: new Date('2025-01-01'),
        StartingBalance: 10000,
        AverageReturnRate: 4.23,
        CompoundingPeriod: CompoundingFrequency.Quarterly,
      };

      const endDate = new Date('2026-01-01');
      const growth = generateInvestmentGrowth(investment, endDate);

      // Should have 5 periods (0 initial + 4 quarters)
      expect(growth.length).toBe(5);
      expect(growth[0].Period).toBe(0);
      expect(growth[4].Period).toBe(4);
    });
  });

  describe('Edge Cases', () => {
    it('should return empty growth array when end date is before start date', () => {
      const investment: Investment = {
        Provider: 'Test',
        Name: 'Test',
        StartDate: new Date('2025-01-01'),
        StartingBalance: 10000,
        AverageReturnRate: 4.23,
        CompoundingPeriod: CompoundingFrequency.Annually,
      };

      const growth = generateInvestmentGrowth(
        investment,
        new Date('2024-01-01')
      );
      expect(growth.length).toBe(0);
    });
  });

  describe('Investment with Recurring Contributions (extensibility for future)', () => {
    it('should generate growth with recurring contributions', () => {
      const investment: Investment = {
        Provider: 'Test Provider',
        Name: 'Contribution Test',
        StartDate: new Date('2025-01-01'),
        StartingBalance: 10000,
        AverageReturnRate: 4.23,
        CompoundingPeriod: CompoundingFrequency.Annually,
        RecurringContribution: 100,
        ContributionFrequency: CompoundingFrequency.Monthly,
      };

      const endDate = new Date('2026-01-01');
      const growth = generateInvestmentGrowth(investment, endDate);

      // First period should show contributions
      expect(growth[1].ContributionAmount).toBeGreaterThan(0);

      // Final value should include contributions
      const finalValue = growth[growth.length - 1].TotalValue;
      expect(finalValue).toBeGreaterThan(10423.0);
    });
  });
});
