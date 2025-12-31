import { describe, it, expect } from 'vitest';
import {
  getMaxVisualizationDate,
  generateVisualizationData,
} from './visualization-helpers';
import { Loan } from '../models/loan-model';
import { Investment, CompoundingFrequency } from '../models/investment-model';
import { generateInvestmentGrowth } from './investment-helpers';
import { generateAmortizationSchedule } from './loan-helpers';
import dayjs from 'dayjs';

describe('getMaxVisualizationDate', () => {
  it('should return 30 years from now when no loans', () => {
    const result = getMaxVisualizationDate([]);
    const expected = dayjs().add(30, 'year').toDate();

    // Allow 1 day difference for test execution time
    expect(Math.abs(result.getTime() - expected.getTime())).toBeLessThan(
      24 * 60 * 60 * 1000
    );
  });

  it('should return 30 years from now or the latest loan end date, whichever is later', () => {
    const loans: Loan[] = [
      {
        Id: 'loan-1',
        Name: 'Loan 1',
        Provider: 'Bank',
        Principal: 100000,
        CurrentAmount: 100000,
        InterestRate: 5,
        StartDate: new Date('2020-01-01'),
        EndDate: new Date('2050-01-01'),
      },
      {
        Id: 'loan-2',
        Name: 'Loan 2',
        Provider: 'Bank',
        Principal: 50000,
        CurrentAmount: 50000,
        InterestRate: 4,
        StartDate: new Date('2022-01-01'),
        EndDate: new Date('2042-01-01'),
      },
    ];

    const result = getMaxVisualizationDate(loans);

    // Should return whichever is later: 30 years from now or the latest loan
    expect(result.getFullYear()).toBeGreaterThanOrEqual(2050);
  });
});

describe('generateVisualizationData', () => {
  it('should return data points even when no loans or investments', () => {
    const result = generateVisualizationData([], []);
    expect(result.length).toBeGreaterThan(0); // Should have data points even with no loans/investments
  });

  it('should generate monthly data points', () => {
    const startDate = new Date('2024-01-01');
    const endDate = new Date('2024-06-01');

    const result = generateVisualizationData([], [], startDate, endDate);

    // Should have approximately 6 months of data
    expect(result.length).toBeGreaterThanOrEqual(5);
    expect(result.length).toBeLessThanOrEqual(7);
  });

  it('should calculate loan values correctly without AmortizationSchedule', () => {
    const loans: Loan[] = [
      {
        Id: 'test-loan',
        Name: 'Test Loan',
        Provider: 'Bank',
        Principal: 100000,
        CurrentAmount: 100000,
        InterestRate: 5,
        StartDate: new Date('2024-01-01'),
        EndDate: new Date('2034-01-01'),
        MonthlyPayment: 1000,
      },
    ];

    const startDate = new Date('2024-01-01');
    const endDate = new Date('2024-03-01');

    const result = generateVisualizationData(loans, [], startDate, endDate);

    expect(result.length).toBeGreaterThan(0);
    expect(result[0].loanValues['test-loan']).toBeGreaterThan(0);
    expect(result[0].totalLoanValue).toBeGreaterThan(0);
  });

  it('should calculate loan values correctly with AmortizationSchedule', () => {
    const loans: Loan[] = [
      {
        Id: 'test-loan',
        Name: 'Test Loan',
        Provider: 'Bank',
        Principal: 100000,
        CurrentAmount: 100000,
        InterestRate: 5,
        StartDate: new Date('2024-01-01'),
        EndDate: new Date('2034-01-01'),
        MonthlyPayment: 1060.66,
      },
    ];

    // Generate amortization schedule
    loans[0].AmortizationSchedule = generateAmortizationSchedule(loans[0]);

    const startDate = new Date('2024-01-01');
    const endDate = new Date('2024-03-01');

    const result = generateVisualizationData(loans, [], startDate, endDate);

    expect(result.length).toBeGreaterThan(0);
    
    // At start date (month 0), should have initial principal
    expect(result[0].loanValues['test-loan']).toBeCloseTo(100000, 0);
    
    // After 2 months, principal should be lower (2 payments made)
    if (result.length >= 3) {
      expect(result[2].loanValues['test-loan']).toBeLessThan(100000);
      expect(result[2].loanValues['test-loan']).toBeGreaterThan(98000);
    }
  });

  it('should calculate investment values correctly without ProjectedGrowth', () => {
    const investments: Investment[] = [
      {
        Id: 'test-investment',
        Name: 'Test Investment',
        Provider: 'Fund',
        StartingBalance: 10000,
        AverageReturnRate: 5,
        CompoundingPeriod: CompoundingFrequency.Annually,
        StartDate: new Date('2024-01-01'),
      },
    ];

    const startDate = new Date('2024-01-01');
    const endDate = new Date('2024-12-31');

    const result = generateVisualizationData([], investments, startDate, endDate);

    expect(result.length).toBeGreaterThan(0);
    expect(result[0].investmentValues['test-investment']).toBeGreaterThan(0);
    expect(result[0].totalInvestmentValue).toBeGreaterThan(0);
  });

  it('should calculate investment values correctly with ProjectedGrowth (monthly)', () => {
    const investments: Investment[] = [
      {
        Id: 'test-investment',
        Name: 'Test Investment',
        Provider: 'Fund',
        StartingBalance: 10000,
        AverageReturnRate: 6,
        CompoundingPeriod: CompoundingFrequency.Monthly,
        StartDate: new Date('2024-01-01'),
      },
    ];

    // Generate projected growth
    const endProjection = new Date('2025-01-01');
    investments[0].ProjectedGrowth = generateInvestmentGrowth(investments[0], endProjection);

    const startDate = new Date('2024-01-01');
    const endDate = new Date('2024-06-01');

    const result = generateVisualizationData([], investments, startDate, endDate);

    expect(result.length).toBeGreaterThan(0);
    
    // At start, should have starting balance
    expect(result[0].investmentValues['test-investment']).toBeCloseTo(10000, -1);
    
    // After some months, should have grown
    if (result.length >= 3) {
      expect(result[2].investmentValues['test-investment']).toBeGreaterThan(10000);
    }
  });

  it('should calculate investment values correctly with ProjectedGrowth (quarterly)', () => {
    const investments: Investment[] = [
      {
        Id: 'test-investment',
        Name: 'Test Investment',
        Provider: 'Fund',
        StartingBalance: 10000,
        AverageReturnRate: 8,
        CompoundingPeriod: CompoundingFrequency.Quarterly,
        StartDate: new Date('2024-01-01'),
      },
    ];

    // Generate projected growth
    const endProjection = new Date('2025-01-01');
    investments[0].ProjectedGrowth = generateInvestmentGrowth(investments[0], endProjection);

    const startDate = new Date('2024-01-01');
    const endDate = new Date('2024-12-31');

    const result = generateVisualizationData([], investments, startDate, endDate);

    expect(result.length).toBeGreaterThan(0);
    expect(result[0].investmentValues['test-investment']).toBeCloseTo(10000, -1);
  });

  it('should calculate investment values correctly with ProjectedGrowth (annually)', () => {
    const investments: Investment[] = [
      {
        Id: 'test-investment',
        Name: 'Test Investment',
        Provider: 'Fund',
        StartingBalance: 10000,
        AverageReturnRate: 5,
        CompoundingPeriod: CompoundingFrequency.Annually,
        StartDate: new Date('2024-01-01'),
      },
    ];

    // Generate projected growth for 2 years
    const endProjection = new Date('2026-01-01');
    investments[0].ProjectedGrowth = generateInvestmentGrowth(investments[0], endProjection);

    const startDate = new Date('2024-01-01');
    const endDate = new Date('2025-12-31');

    const result = generateVisualizationData([], investments, startDate, endDate);

    expect(result.length).toBeGreaterThan(0);
    expect(result[0].investmentValues['test-investment']).toBeCloseTo(10000, -1);
  });

  it('should calculate overall position correctly', () => {
    const loans: Loan[] = [
      {
        Id: 'test-loan',
        Name: 'Test Loan',
        Provider: 'Bank',
        Principal: 100000,
        CurrentAmount: 100000,
        InterestRate: 5,
        StartDate: new Date('2024-01-01'),
        EndDate: new Date('2034-01-01'),
      },
    ];

    const investments: Investment[] = [
      {
        Id: 'test-investment',
        Name: 'Test Investment',
        Provider: 'Fund',
        StartingBalance: 150000,
        AverageReturnRate: 5,
        CompoundingPeriod: CompoundingFrequency.Annually,
        StartDate: new Date('2024-01-01'),
      },
    ];

    const startDate = new Date('2024-01-01');
    const endDate = new Date('2024-03-01');

    const result = generateVisualizationData(loans, investments, startDate, endDate);

    expect(result.length).toBeGreaterThan(0);
    // Overall position = investments - loans
    expect(result[0].overallPosition).toBe(
      result[0].totalInvestmentValue - result[0].totalLoanValue
    );
  });

  it('should return 0 for loan values before start date', () => {
    const loans: Loan[] = [
      {
        Id: 'future-loan',
        Name: 'Future Loan',
        Provider: 'Bank',
        Principal: 100000,
        CurrentAmount: 100000,
        InterestRate: 5,
        StartDate: new Date('2025-01-01'),
        EndDate: new Date('2035-01-01'),
      },
    ];

    const startDate = new Date('2024-01-01');
    const endDate = new Date('2024-06-01');

    const result = generateVisualizationData(loans, [], startDate, endDate);

    expect(result.length).toBeGreaterThan(0);
    expect(result[0].loanValues['future-loan']).toBe(0);
  });

  it('should return 0 for loan values after end date', () => {
    const loans: Loan[] = [
      {
        Id: 'past-loan',
        Name: 'Past Loan',
        Provider: 'Bank',
        Principal: 100000,
        CurrentAmount: 100000,
        InterestRate: 5,
        StartDate: new Date('2020-01-01'),
        EndDate: new Date('2023-12-31'),
      },
    ];

    const startDate = new Date('2024-01-01');
    const endDate = new Date('2024-06-01');

    const result = generateVisualizationData(loans, [], startDate, endDate);

    expect(result.length).toBeGreaterThan(0);
    expect(result[0].loanValues['past-loan']).toBe(0);
  });

  it('should use unique IDs for loan and investment values', () => {
    const loans: Loan[] = [
      {
        Id: 'loan-1',
        Name: 'Duplicate Name',
        Provider: 'Bank 1',
        Principal: 100000,
        CurrentAmount: 100000,
        InterestRate: 5,
        StartDate: new Date('2024-01-01'),
        EndDate: new Date('2034-01-01'),
      },
      {
        Id: 'loan-2',
        Name: 'Duplicate Name',
        Provider: 'Bank 2',
        Principal: 50000,
        CurrentAmount: 50000,
        InterestRate: 4,
        StartDate: new Date('2024-01-01'),
        EndDate: new Date('2034-01-01'),
      },
    ];

    const startDate = new Date('2024-01-01');
    const endDate = new Date('2024-02-01');

    const result = generateVisualizationData(loans, [], startDate, endDate);

    expect(result.length).toBeGreaterThan(0);
    // Both loans should have separate entries
    expect(result[0].loanValues['loan-1']).toBeGreaterThan(0);
    expect(result[0].loanValues['loan-2']).toBeGreaterThan(0);
    expect(result[0].loanValues['loan-1']).not.toBe(result[0].loanValues['loan-2']);
  });
});
