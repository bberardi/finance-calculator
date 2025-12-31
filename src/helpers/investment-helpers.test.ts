import { describe, it, expect } from 'vitest';
import {
  generateInvestmentGrowth,
  getPeriodsPerYear,
  getPitInvestmentCalculation,
  getInvestmentPeriods,
  getNextCompoundingDate,
  getContributionsInPeriod,
  getContributionForYear,
  getInvestmentYear,
  getContributionsWithStepUp,
} from './investment-helpers';
import {
  Investment,
  CompoundingFrequency,
  StepUpType,
} from '../models/investment-model';

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

  describe('getInvestmentPeriods', () => {
    it('should return 0 when end date is before start date', () => {
      const investment: Investment = {
        Id: 'test-id-1',
        Provider: 'Test',
        Name: 'Test',
        StartDate: new Date(2025, 0, 1),
        StartingBalance: 10000,
        AverageReturnRate: 4.23,
        CompoundingPeriod: CompoundingFrequency.Annually,
      };

      expect(getInvestmentPeriods(investment, new Date(2024, 0, 1))).toBe(0);
    });

    it('should calculate periods correctly for annual compounding', () => {
      const investment: Investment = {
        Id: 'test-id-2',
        Provider: 'Test',
        Name: 'Test',
        StartDate: new Date(2025, 0, 1),
        StartingBalance: 10000,
        AverageReturnRate: 4.23,
        CompoundingPeriod: CompoundingFrequency.Annually,
      };

      // After 1 year
      expect(getInvestmentPeriods(investment, new Date(2026, 0, 1))).toBe(2);
      // After 5 years
      expect(getInvestmentPeriods(investment, new Date(2030, 0, 1))).toBe(6);
      // Same day should return at least 1
      expect(getInvestmentPeriods(investment, new Date(2025, 0, 1))).toBe(1);
    });

    it('should calculate periods correctly for monthly compounding', () => {
      const investment: Investment = {
        Id: 'test-id-3',
        Provider: 'Test',
        Name: 'Test',
        StartDate: new Date(2025, 0, 1),
        StartingBalance: 10000,
        AverageReturnRate: 4.23,
        CompoundingPeriod: CompoundingFrequency.Monthly,
      };

      // After 1 month
      expect(getInvestmentPeriods(investment, new Date(2025, 1, 1))).toBe(2);
      // After 12 months
      expect(getInvestmentPeriods(investment, new Date(2026, 0, 1))).toBe(13);
      // Before completing a month (partial)
      expect(getInvestmentPeriods(investment, new Date(2025, 0, 15))).toBe(1);
    });

    it('should calculate periods correctly for quarterly compounding', () => {
      const investment: Investment = {
        Id: 'test-id-4',
        Provider: 'Test',
        Name: 'Test',
        StartDate: new Date(2025, 0, 1),
        StartingBalance: 10000,
        AverageReturnRate: 4.23,
        CompoundingPeriod: CompoundingFrequency.Quarterly,
      };

      // After 1 quarter
      expect(getInvestmentPeriods(investment, new Date(2025, 3, 1))).toBe(2);
      // After 4 quarters (1 year)
      expect(getInvestmentPeriods(investment, new Date(2026, 0, 1))).toBe(5);
    });
  });

  describe('getNextCompoundingDate', () => {
    it('should return next month for monthly compounding', () => {
      const current = new Date(2025, 0, 15);
      const next = getNextCompoundingDate(
        current,
        CompoundingFrequency.Monthly
      );

      expect(next.getFullYear()).toBe(2025);
      expect(next.getMonth()).toBe(1); // February (0-indexed)
      expect(next.getDate()).toBe(15);
    });

    it('should roll over year for monthly compounding', () => {
      const current = new Date(2025, 11, 15);
      const next = getNextCompoundingDate(
        current,
        CompoundingFrequency.Monthly
      );

      expect(next.getFullYear()).toBe(2026);
      expect(next.getMonth()).toBe(0); // January (0-indexed)
      expect(next.getDate()).toBe(15);
    });

    it('should return next quarter for quarterly compounding', () => {
      const current = new Date(2025, 0, 15);
      const next = getNextCompoundingDate(
        current,
        CompoundingFrequency.Quarterly
      );

      expect(next.getFullYear()).toBe(2025);
      expect(next.getMonth()).toBe(3); // April (0-indexed)
      expect(next.getDate()).toBe(15);
    });

    it('should roll over year for quarterly compounding', () => {
      const current = new Date(2025, 10, 15);
      const next = getNextCompoundingDate(
        current,
        CompoundingFrequency.Quarterly
      );

      expect(next.getFullYear()).toBe(2026);
      expect(next.getMonth()).toBe(1); // February (0-indexed)
      expect(next.getDate()).toBe(15);
    });

    it('should return next year for annual compounding', () => {
      const current = new Date(2025, 0, 15);
      const next = getNextCompoundingDate(
        current,
        CompoundingFrequency.Annually
      );

      expect(next.getFullYear()).toBe(2026);
      expect(next.getMonth()).toBe(0); // January (0-indexed)
      expect(next.getDate()).toBe(15);
    });
  });

  describe('getContributionsInPeriod', () => {
    it('should count monthly contributions correctly', () => {
      const startDate = new Date(2025, 0, 1);
      const endDate = new Date(2025, 3, 1);

      const count = getContributionsInPeriod(
        startDate,
        endDate,
        CompoundingFrequency.Monthly
      );

      // Jan 1, Feb 1, Mar 1 (Apr 1 is exclusive)
      expect(count).toBe(3);
    });

    it('should count quarterly contributions correctly', () => {
      const startDate = new Date(2025, 0, 1);
      const endDate = new Date(2026, 0, 1);

      const count = getContributionsInPeriod(
        startDate,
        endDate,
        CompoundingFrequency.Quarterly
      );

      // Q1, Q2, Q3, Q4
      expect(count).toBe(4);
    });

    it('should count annual contributions correctly', () => {
      const startDate = new Date(2025, 0, 1);
      const endDate = new Date(2028, 0, 1);

      const count = getContributionsInPeriod(
        startDate,
        endDate,
        CompoundingFrequency.Annually
      );

      // 2025, 2026, 2027
      expect(count).toBe(3);
    });

    it('should return 0 for same start and end date', () => {
      const date = new Date(2025, 0, 1);

      const count = getContributionsInPeriod(
        date,
        date,
        CompoundingFrequency.Monthly
      );

      expect(count).toBe(0);
    });

    it('should return 1 for period with single contribution', () => {
      const startDate = new Date(2025, 0, 1);
      const endDate = new Date(2025, 0, 15);

      const count = getContributionsInPeriod(
        startDate,
        endDate,
        CompoundingFrequency.Monthly
      );

      // Only Jan 1
      expect(count).toBe(1);
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

    const startDate = new Date(2025, 0, 1);
    const principal = 10000;
    const annualRate = 4.23;

    describe('generateInvestmentGrowth', () => {
      const investment: Investment = {
        Id: 'test-id-5',
        Provider: 'Test Provider',
        Name: 'Test Investment',
        StartDate: startDate,
        StartingBalance: principal,
        AverageReturnRate: annualRate,
        CompoundingPeriod: CompoundingFrequency.Annually,
      };

      it('should generate correct growth data for 1/1/2026', () => {
        const endDate = new Date(2026, 0, 1);
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
        const endDate = new Date(2030, 0, 1);
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
        const endDate = new Date(2055, 0, 1);
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
        Id: 'test-id-6',
        Provider: 'Test Provider',
        Name: 'Test Investment',
        StartDate: startDate,
        StartingBalance: principal,
        AverageReturnRate: annualRate,
        CompoundingPeriod: CompoundingFrequency.Annually,
      };

      it('should calculate correct PIT values for 1/1/2026', () => {
        const endDate = new Date(2026, 0, 1);
        const pit = getPitInvestmentCalculation(investment, endDate);

        // CurrentPeriods counts inclusively (includes the period being calculated)
        expect(pit.CurrentPeriods).toBe(2);
        expect(pit.TotalContributions).toBe(10000.0);
        expect(pit.CurrentValue).toBe(10423.0);
        // Note: TotalInterestEarned is cumulative over all years
        expect(pit.TotalInterestEarned).toBe(423.0);
      });

      it('should calculate correct PIT values for 1/1/2030', () => {
        const endDate = new Date(2030, 0, 1);
        const pit = getPitInvestmentCalculation(investment, endDate);

        // CurrentPeriods counts inclusively (includes the period being calculated)
        expect(pit.CurrentPeriods).toBe(6);
        expect(pit.TotalContributions).toBe(10000.0);
        expect(pit.CurrentValue).toBe(12301.66);
        // Note: TotalInterestEarned is cumulative over all years
        expect(pit.TotalInterestEarned).toBe(2301.66);
      });

      it('should calculate correct PIT values for 1/1/2055', () => {
        const endDate = new Date(2055, 0, 1);
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
        Id: 'test-id-7',
        Provider: 'Test Provider',
        Name: 'Monthly Test',
        StartDate: new Date(2025, 0, 1),
        StartingBalance: 10000,
        AverageReturnRate: 4.23,
        CompoundingPeriod: CompoundingFrequency.Monthly,
      };

      const endDate = new Date(2026, 0, 1);
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
        Id: 'test-id-8',
        Provider: 'Test Provider',
        Name: 'Quarterly Test',
        StartDate: new Date(2025, 0, 1),
        StartingBalance: 10000,
        AverageReturnRate: 4.23,
        CompoundingPeriod: CompoundingFrequency.Quarterly,
      };

      const endDate = new Date(2026, 0, 1);
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
        Id: 'test-id-9',
        Provider: 'Test',
        Name: 'Test',
        StartDate: new Date(2025, 0, 1),
        StartingBalance: 10000,
        AverageReturnRate: 4.23,
        CompoundingPeriod: CompoundingFrequency.Annually,
      };

      const growth = generateInvestmentGrowth(investment, new Date(2024, 0, 1));
      expect(growth.length).toBe(0);
    });
  });

  describe('Investment with Recurring Contributions (extensibility for future)', () => {
    it('should generate growth with recurring contributions', () => {
      const investment: Investment = {
        Id: 'test-id-10',
        Provider: 'Test Provider',
        Name: 'Contribution Test',
        StartDate: new Date(2025, 0, 1),
        StartingBalance: 10000,
        AverageReturnRate: 4.23,
        CompoundingPeriod: CompoundingFrequency.Annually,
        RecurringContribution: 100,
        ContributionFrequency: CompoundingFrequency.Monthly,
      };

      const endDate = new Date(2026, 0, 1);
      const growth = generateInvestmentGrowth(investment, endDate);

      // First period should show contributions
      expect(growth[1].ContributionAmount).toBeGreaterThan(0);

      // Final value should include contributions
      const finalValue = growth[growth.length - 1].TotalValue;
      expect(finalValue).toBeGreaterThan(10423.0);
    });
  });

  describe('Step-Up Contribution Helpers', () => {
    describe('getContributionForYear', () => {
      it('should return base contribution for year 1', () => {
        expect(getContributionForYear(100, 1, 10, StepUpType.Flat)).toBe(100);
        expect(getContributionForYear(100, 1, 10, StepUpType.Percentage)).toBe(
          100
        );
      });

      it('should apply flat step-up correctly', () => {
        // $100 base with $10 step-up
        expect(getContributionForYear(100, 1, 10, StepUpType.Flat)).toBe(100);
        expect(getContributionForYear(100, 2, 10, StepUpType.Flat)).toBe(110);
        expect(getContributionForYear(100, 3, 10, StepUpType.Flat)).toBe(120);
        expect(getContributionForYear(100, 5, 10, StepUpType.Flat)).toBe(140);
      });

      it('should apply percentage step-up correctly', () => {
        // $100 base with 10% step-up
        expect(
          getContributionForYear(100, 1, 10, StepUpType.Percentage)
        ).toBeCloseTo(100, 2);
        expect(
          getContributionForYear(100, 2, 10, StepUpType.Percentage)
        ).toBeCloseTo(110, 2);
        expect(
          getContributionForYear(100, 3, 10, StepUpType.Percentage)
        ).toBeCloseTo(121, 2);
        // Year 4: 100 * 1.1^3 = 133.1
        expect(
          getContributionForYear(100, 4, 10, StepUpType.Percentage)
        ).toBeCloseTo(133.1, 2);
      });

      it('should return base contribution if no step-up configured', () => {
        expect(getContributionForYear(100, 3, undefined, undefined)).toBe(100);
        expect(getContributionForYear(100, 3, 0, StepUpType.Flat)).toBe(100);
        expect(getContributionForYear(100, 3, undefined, StepUpType.Flat)).toBe(
          100
        );
      });

      it('should return base contribution for negative step-up amounts', () => {
        // Negative step-up amounts should return base contribution
        expect(getContributionForYear(100, 3, -10, StepUpType.Flat)).toBe(100);
        expect(getContributionForYear(100, 3, -10, StepUpType.Percentage)).toBe(
          100
        );
        expect(getContributionForYear(100, 5, -50, StepUpType.Flat)).toBe(100);
        expect(getContributionForYear(100, 5, -50, StepUpType.Percentage)).toBe(
          100
        );
      });

      it('should handle large percentage step-ups correctly', () => {
        // 100% step-up doubles each year
        expect(
          getContributionForYear(100, 2, 100, StepUpType.Percentage)
        ).toBeCloseTo(200, 2);
        expect(
          getContributionForYear(100, 3, 100, StepUpType.Percentage)
        ).toBeCloseTo(400, 2);
        expect(
          getContributionForYear(100, 4, 100, StepUpType.Percentage)
        ).toBeCloseTo(800, 2);

        // 200% step-up triples each year
        expect(
          getContributionForYear(100, 2, 200, StepUpType.Percentage)
        ).toBeCloseTo(300, 2);
        expect(
          getContributionForYear(100, 3, 200, StepUpType.Percentage)
        ).toBeCloseTo(900, 2);

        // Very large step-up (500%)
        expect(
          getContributionForYear(100, 2, 500, StepUpType.Percentage)
        ).toBeCloseTo(600, 2);
        expect(
          getContributionForYear(100, 3, 500, StepUpType.Percentage)
        ).toBeCloseTo(3600, 2);
      });
    });

    describe('getInvestmentYear', () => {
      it('should return 1 for dates within the first year', () => {
        const startDate = new Date(2025, 0, 1);
        expect(getInvestmentYear(new Date(2025, 0, 1), startDate)).toBe(1);
        expect(getInvestmentYear(new Date(2025, 6, 15), startDate)).toBe(1);
        expect(getInvestmentYear(new Date(2025, 11, 31), startDate)).toBe(1);
      });

      it('should return 2 for dates in the second year', () => {
        const startDate = new Date(2025, 0, 1);
        expect(getInvestmentYear(new Date(2026, 0, 1), startDate)).toBe(2);
        expect(getInvestmentYear(new Date(2026, 6, 15), startDate)).toBe(2);
      });

      it('should handle mid-year start dates correctly', () => {
        const startDate = new Date(2025, 5, 15); // June 15, 2025
        // Before anniversary in 2026
        expect(getInvestmentYear(new Date(2026, 4, 1), startDate)).toBe(1);
        // On/after anniversary in 2026
        expect(getInvestmentYear(new Date(2026, 5, 15), startDate)).toBe(2);
        expect(getInvestmentYear(new Date(2026, 6, 1), startDate)).toBe(2);
      });

      it('should return 1 when currentDate is before startDate', () => {
        const startDate = new Date(2025, 5, 15); // June 15, 2025
        // Dates before the investment start should return year 1
        expect(getInvestmentYear(new Date(2025, 0, 1), startDate)).toBe(1);
        expect(getInvestmentYear(new Date(2024, 11, 31), startDate)).toBe(1);
        expect(getInvestmentYear(new Date(2020, 0, 1), startDate)).toBe(1);
      });

      it('should handle leap year (Feb 29) start dates correctly', () => {
        // Start on Feb 29, 2024 (leap year)
        const startDate = new Date(2024, 1, 29);

        // On the start date itself
        expect(getInvestmentYear(new Date(2024, 1, 29), startDate)).toBe(1);

        // Feb 28, 2025 (non-leap year) should be year 2 since Feb 29 doesn't exist
        // The anniversary in 2025 is Feb 28
        expect(getInvestmentYear(new Date(2025, 1, 28), startDate)).toBe(2);

        // Feb 27, 2025 should still be year 1 (before anniversary)
        expect(getInvestmentYear(new Date(2025, 1, 27), startDate)).toBe(1);

        // March 1, 2025 should be year 2
        expect(getInvestmentYear(new Date(2025, 2, 1), startDate)).toBe(2);

        // Feb 29, 2028 (leap year) should be year 5
        expect(getInvestmentYear(new Date(2028, 1, 29), startDate)).toBe(5);
      });
    });

    describe('getContributionsWithStepUp', () => {
      it('should calculate contributions without step-up', () => {
        const startDate = new Date(2025, 0, 1);
        const endDate = new Date(2025, 3, 1);
        const investmentStart = new Date(2025, 0, 1);

        // 3 monthly contributions of $100 each (Jan, Feb, Mar)
        const total = getContributionsWithStepUp(
          startDate,
          endDate,
          investmentStart,
          100,
          CompoundingFrequency.Monthly
        );

        expect(total).toBe(300);
      });

      it('should apply flat step-up at year boundary', () => {
        const investmentStart = new Date(2025, 0, 1);
        // Period spanning year 1 and year 2
        // Nov 2025 to Feb 2026 = 3 contributions at $100 (Nov, Dec) + 1 at $110 (Jan 2026)
        // Actually: Nov 1 = $100, Dec 1 = $100, Jan 1 = $110 (year 2 starts)
        const startDate = new Date(2025, 10, 1); // Nov 1
        const endDate = new Date(2026, 1, 1); // Feb 1 (exclusive)

        const total = getContributionsWithStepUp(
          startDate,
          endDate,
          investmentStart,
          100,
          CompoundingFrequency.Monthly,
          10,
          StepUpType.Flat
        );

        // Nov $100 + Dec $100 + Jan $110 = $310
        expect(total).toBe(310);
      });

      it('should apply percentage step-up at year boundary', () => {
        const investmentStart = new Date(2025, 0, 1);
        const startDate = new Date(2025, 10, 1); // Nov 1
        const endDate = new Date(2026, 1, 1); // Feb 1 (exclusive)

        const total = getContributionsWithStepUp(
          startDate,
          endDate,
          investmentStart,
          100,
          CompoundingFrequency.Monthly,
          10,
          StepUpType.Percentage
        );

        // Nov $100 + Dec $100 + Jan $110 = $310
        expect(total).toBe(310);
      });
    });
  });

  describe('Investment Growth with Step-Up Contributions', () => {
    // Test data from the issue:
    // Flat example: $100/month with $10 step-up
    // Year 1: $100/month, Year 2: $110/month, Year 3: $120/month

    describe('Flat Step-Up', () => {
      it('should apply flat step-up to contributions over multiple years', () => {
        const investment: Investment = {
          Id: 'test-step-up-1',
          Provider: 'Test',
          Name: 'Flat Step-Up Test',
          StartDate: new Date(2025, 0, 1),
          StartingBalance: 0,
          AverageReturnRate: 0, // No interest to simplify testing contributions
          CompoundingPeriod: CompoundingFrequency.Annually,
          RecurringContribution: 100,
          ContributionFrequency: CompoundingFrequency.Monthly,
          ContributionStepUpAmount: 10,
          ContributionStepUpType: StepUpType.Flat,
        };

        // After 3 years
        const endDate = new Date(2028, 0, 1);
        const growth = generateInvestmentGrowth(investment, endDate);

        // Year 1: 12 * $100 = $1,200
        // Year 2: 12 * $110 = $1,320
        // Year 3: 12 * $120 = $1,440
        // Total: $3,960

        const totalContributions = growth.reduce(
          (sum, entry) => sum + entry.ContributionAmount,
          0
        );
        expect(totalContributions).toBe(3960);
      });

      it('should calculate correct value after 1 year with flat step-up', () => {
        const investment: Investment = {
          Id: 'test-step-up-2',
          Provider: 'Test',
          Name: 'Flat Step-Up Test',
          StartDate: new Date(2025, 0, 1),
          StartingBalance: 0,
          AverageReturnRate: 0,
          CompoundingPeriod: CompoundingFrequency.Annually,
          RecurringContribution: 100,
          ContributionFrequency: CompoundingFrequency.Monthly,
          ContributionStepUpAmount: 10,
          ContributionStepUpType: StepUpType.Flat,
        };

        // After 1 year (no step-up applied yet)
        const endDate = new Date(2026, 0, 1);
        const growth = generateInvestmentGrowth(investment, endDate);

        // Year 1: 12 * $100 = $1,200
        const totalContributions = growth.reduce(
          (sum, entry) => sum + entry.ContributionAmount,
          0
        );
        expect(totalContributions).toBe(1200);
      });
    });

    describe('Percentage Step-Up', () => {
      it('should apply percentage step-up to contributions over multiple years', () => {
        const investment: Investment = {
          Id: 'test-step-up-3',
          Provider: 'Test',
          Name: 'Percentage Step-Up Test',
          StartDate: new Date(2025, 0, 1),
          StartingBalance: 0,
          AverageReturnRate: 0, // No interest to simplify testing contributions
          CompoundingPeriod: CompoundingFrequency.Annually,
          RecurringContribution: 100,
          ContributionFrequency: CompoundingFrequency.Monthly,
          ContributionStepUpAmount: 10,
          ContributionStepUpType: StepUpType.Percentage,
        };

        // After 3 years
        const endDate = new Date(2028, 0, 1);
        const growth = generateInvestmentGrowth(investment, endDate);

        // Year 1: 12 * $100 = $1,200
        // Year 2: 12 * $110 = $1,320
        // Year 3: 12 * $121 = $1,452
        // Total: $3,972

        const totalContributions = growth.reduce(
          (sum, entry) => sum + entry.ContributionAmount,
          0
        );
        expect(totalContributions).toBe(3972);
      });

      it('should compound percentage step-up over many years', () => {
        const investment: Investment = {
          Id: 'test-step-up-4',
          Provider: 'Test',
          Name: 'Percentage Step-Up Test',
          StartDate: new Date(2025, 0, 1),
          StartingBalance: 0,
          AverageReturnRate: 0,
          CompoundingPeriod: CompoundingFrequency.Annually,
          RecurringContribution: 100,
          ContributionFrequency: CompoundingFrequency.Monthly,
          ContributionStepUpAmount: 10,
          ContributionStepUpType: StepUpType.Percentage,
        };

        // After 5 years
        const endDate = new Date(2030, 0, 1);
        const growth = generateInvestmentGrowth(investment, endDate);

        // Year 1: 12 * 100 = 1,200
        // Year 2: 12 * 110 = 1,320
        // Year 3: 12 * 121 = 1,452
        // Year 4: 12 * 133.1 = 1,597.2
        // Year 5: 12 * 146.41 = 1,756.92
        // Total: 7,326.12

        const totalContributions = growth.reduce(
          (sum, entry) => sum + entry.ContributionAmount,
          0
        );
        expect(totalContributions).toBeCloseTo(7326.12, 0);
      });
    });

    describe('Step-Up with Interest', () => {
      it('should correctly compound interest with flat step-up contributions', () => {
        const investment: Investment = {
          Id: 'test-step-up-5',
          Provider: 'Test',
          Name: 'Step-Up with Interest',
          StartDate: new Date(2025, 0, 1),
          StartingBalance: 10000,
          AverageReturnRate: 5,
          CompoundingPeriod: CompoundingFrequency.Annually,
          RecurringContribution: 100,
          ContributionFrequency: CompoundingFrequency.Monthly,
          ContributionStepUpAmount: 10,
          ContributionStepUpType: StepUpType.Flat,
        };

        const endDate = new Date(2027, 0, 1);
        const growth = generateInvestmentGrowth(investment, endDate);

        // Year 1: Start $10,000 + $1,200 contributions = $11,200
        // After 5% interest = $11,760
        // Year 2: $11,760 + $1,320 contributions = $13,080
        // After 5% interest = $13,734

        const finalValue = growth[growth.length - 1].TotalValue;
        expect(finalValue).toBeCloseTo(13734, 0);
      });
    });
  });
});
