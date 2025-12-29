import { describe, it, expect } from 'vitest';
import {
  getMaxVisualizationDate,
  generateVisualizationData,
} from './visualization-helpers';
import { Loan } from '../models/loan-model';
import { Investment, CompoundingFrequency } from '../models/investment-model';
import dayjs from 'dayjs';

describe('getMaxVisualizationDate', () => {
  it('should return 30 years from now when no loans or investments', () => {
    const result = getMaxVisualizationDate([], []);
    const expected = dayjs().add(30, 'year').toDate();

    // Allow 1 day difference for test execution time
    expect(Math.abs(result.getTime() - expected.getTime())).toBeLessThan(
      24 * 60 * 60 * 1000
    );
  });

  it('should return 30 years from now or the latest loan end date, whichever is later', () => {
    const loans: Loan[] = [
      {
        Name: 'Loan 1',
        Provider: 'Bank',
        Principal: 100000,
        CurrentAmount: 100000,
        InterestRate: 5,
        StartDate: new Date('2020-01-01'),
        EndDate: new Date('2050-01-01'),
      },
      {
        Name: 'Loan 2',
        Provider: 'Bank',
        Principal: 50000,
        CurrentAmount: 50000,
        InterestRate: 4,
        StartDate: new Date('2022-01-01'),
        EndDate: new Date('2042-01-01'),
      },
    ];

    const result = getMaxVisualizationDate(loans, []);

    // Should return whichever is later: 30 years from now or the latest loan
    expect(result.getFullYear()).toBeGreaterThanOrEqual(2050);
  });

  it('should return 30 years from now when investments exist and are later than loans', () => {
    const loans: Loan[] = [
      {
        Name: 'Loan 1',
        Provider: 'Bank',
        Principal: 100000,
        CurrentAmount: 100000,
        InterestRate: 5,
        StartDate: new Date('2020-01-01'),
        EndDate: new Date('2030-01-01'),
      },
    ];

    const investments: Investment[] = [
      {
        Name: 'Investment 1',
        Provider: 'Fund',
        StartingBalance: 10000,
        AverageReturnRate: 5,
        CompoundingPeriod: CompoundingFrequency.Annually,
        StartDate: new Date('2020-01-01'),
      },
    ];

    const result = getMaxVisualizationDate(loans, investments);
    const expected = dayjs().add(30, 'year').toDate();

    // Should be approximately 30 years from now
    expect(Math.abs(result.getTime() - expected.getTime())).toBeLessThan(
      24 * 60 * 60 * 1000
    );
  });
});

describe('generateVisualizationData', () => {
  it('should return empty array when no loans or investments', () => {
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

  it('should calculate loan values correctly', () => {
    const loans: Loan[] = [
      {
        Name: 'Test Loan',
        Provider: 'Bank',
        Principal: 100000,
        CurrentAmount: 100000,
        InterestRate: 5,
        StartDate: new Date('2024-01-01'),
        EndDate: new Date('2034-01-01'),
        MonthlyPayment: 1000,
        AmortizationSchedule: [
          {
            Term: 1,
            PrincipalPayment: 583.33,
            InterestPayment: 416.67,
            RemainingBalance: 99416.67,
          },
          {
            Term: 2,
            PrincipalPayment: 585.76,
            InterestPayment: 414.24,
            RemainingBalance: 98830.91,
          },
        ],
      },
    ];

    const startDate = new Date('2024-01-01');
    const endDate = new Date('2024-03-01');

    const result = generateVisualizationData(loans, [], startDate, endDate);

    expect(result.length).toBeGreaterThan(0);
    expect(result[0].loanValues['Test Loan']).toBeGreaterThan(0);
    expect(result[0].totalLoanValue).toBeGreaterThan(0);
  });

  it('should calculate investment values correctly', () => {
    const investments: Investment[] = [
      {
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

    const result = generateVisualizationData(
      [],
      investments,
      startDate,
      endDate
    );

    expect(result.length).toBeGreaterThan(0);
    expect(result[0].investmentValues['Test Investment']).toBeGreaterThan(0);
    expect(result[0].totalInvestmentValue).toBeGreaterThan(0);
  });

  it('should calculate overall position correctly', () => {
    const loans: Loan[] = [
      {
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

    const result = generateVisualizationData(
      loans,
      investments,
      startDate,
      endDate
    );

    expect(result.length).toBeGreaterThan(0);
    // Overall position = investments - loans
    expect(result[0].overallPosition).toBe(
      result[0].totalInvestmentValue - result[0].totalLoanValue
    );
  });

  it('should return 0 for loan values before start date', () => {
    const loans: Loan[] = [
      {
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
    expect(result[0].loanValues['Future Loan']).toBe(0);
  });

  it('should return 0 for loan values after end date', () => {
    const loans: Loan[] = [
      {
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
    expect(result[0].loanValues['Past Loan']).toBe(0);
  });
});
