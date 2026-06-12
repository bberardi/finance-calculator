import { describe, it, expect } from 'vitest';
import {
  exportToJson,
  importFromJson,
  mergeData,
  EXPORT_SCHEMA_VERSION,
} from './data-helpers';
import { Loan } from '../models/loan-model';
import {
  Investment,
  CompoundingFrequency,
  StepUpType,
} from '../models/investment-model';

describe('exportToJson and importFromJson', () => {
  const testLoan: Loan = {
    Id: 'loan-1',
    Provider: 'Test Bank',
    Name: 'Test Loan',
    InterestRate: 5.0,
    Principal: 100000,
    CurrentAmount: 95000,
    MonthlyPayment: 500,
    StartDate: new Date('2024-01-01'),
    EndDate: new Date('2044-01-01'),
  };

  const testInvestment: Investment = {
    Id: 'investment-1',
    Provider: 'Test Fund',
    Name: 'Test Investment',
    StartDate: new Date('2024-01-01'),
    StartingBalance: 10000,
    AverageReturnRate: 7.0,
    CompoundingPeriod: CompoundingFrequency.Monthly,
  };

  it('should export loans and investments to JSON with metadata', () => {
    const json = exportToJson([testLoan], [testInvestment]);
    const data = JSON.parse(json);

    expect(json).toBeTruthy();
    expect(data.loans).toBeDefined();
    expect(data.investments).toBeDefined();
    expect(data.schemaVersion).toBe(EXPORT_SCHEMA_VERSION);
    expect(data.version).toBeDefined(); // Version should be present
    expect(typeof data.version).toBe('string'); // Version should be a string
    expect(data.exportDate).toBeDefined();
    expect(new Date(data.exportDate).getTime()).not.toBeNaN(); // Valid date
    expect(json).toContain('loan-1');
    expect(json).toContain('investment-1');
    expect(json).toContain('Test Bank');
    expect(json).toContain('Test Fund');
  });

  it('should not include derived schedules in exports', () => {
    const json = exportToJson([testLoan], [testInvestment]);
    const data = JSON.parse(json);

    expect(data.loans[0].AmortizationSchedule).toBeUndefined();
    expect(data.investments[0].ProjectedGrowth).toBeUndefined();
  });

  it('should import legacy v1 files and drop their embedded derived data', () => {
    // v1 files (no schemaVersion) embedded calculated schedules
    const v1Json = JSON.stringify({
      loans: [
        {
          ...testLoan,
          StartDate: testLoan.StartDate.toISOString(),
          EndDate: testLoan.EndDate.toISOString(),
          AmortizationSchedule: [
            {
              Term: 1,
              PrincipalPayment: 100,
              InterestPayment: 400,
              RemainingBalance: 99900,
            },
          ],
        },
      ],
      investments: [
        {
          ...testInvestment,
          StartDate: testInvestment.StartDate.toISOString(),
          ProjectedGrowth: [
            {
              Period: 0,
              ContributionAmount: 0,
              InterestEarned: 0,
              TotalValue: 10000,
            },
          ],
        },
      ],
      exportDate: new Date().toISOString(),
      version: '0.6.0',
    });

    const { loans, investments } = importFromJson(v1Json);

    expect(loans).toHaveLength(1);
    expect(loans[0].Name).toBe('Test Loan');
    expect(investments).toHaveLength(1);
    expect(
      (loans[0] as unknown as Record<string, unknown>).AmortizationSchedule
    ).toBeUndefined();
    expect(
      (investments[0] as unknown as Record<string, unknown>).ProjectedGrowth
    ).toBeUndefined();
  });

  it('should strip unknown properties at the import boundary', () => {
    const json = JSON.stringify({
      schemaVersion: EXPORT_SCHEMA_VERSION,
      loans: [
        {
          ...testLoan,
          StartDate: testLoan.StartDate.toISOString(),
          EndDate: testLoan.EndDate.toISOString(),
          SomeUnknownField: 'junk',
        },
      ],
      investments: [],
      exportDate: new Date().toISOString(),
      version: '0.7.0',
    });

    const { loans } = importFromJson(json);
    expect(
      (loans[0] as unknown as Record<string, unknown>).SomeUnknownField
    ).toBeUndefined();
  });

  it('should reject files from a newer schema version', () => {
    const json = JSON.stringify({
      schemaVersion: 99,
      loans: [],
      investments: [],
      exportDate: new Date().toISOString(),
      version: '9.9.9',
    });

    expect(() => importFromJson(json)).toThrow('Unsupported schema version');
  });

  it('should import loans and investments from JSON', () => {
    const json = exportToJson([testLoan], [testInvestment]);
    const { loans, investments } = importFromJson(json);

    expect(loans).toHaveLength(1);
    expect(investments).toHaveLength(1);

    expect(loans[0].Id).toBe('loan-1');
    expect(loans[0].Name).toBe('Test Loan');
    expect(loans[0].StartDate).toBeInstanceOf(Date);
    expect(loans[0].StartDate.toISOString()).toBe('2024-01-01T00:00:00.000Z');

    expect(investments[0].Id).toBe('investment-1');
    expect(investments[0].Name).toBe('Test Investment');
    expect(investments[0].StartDate).toBeInstanceOf(Date);
  });

  it('should handle empty arrays', () => {
    const json = exportToJson([], []);
    const { loans, investments } = importFromJson(json);

    expect(loans).toHaveLength(0);
    expect(investments).toHaveLength(0);
  });

  it('should throw error for invalid JSON', () => {
    expect(() => importFromJson('invalid json')).toThrow();
    expect(() => importFromJson('{}')).toThrow(
      'Expected an object with "loans" and "investments" arrays'
    );
    expect(() =>
      importFromJson('{"loans": "not array", "investments": []}')
    ).toThrow('must be arrays');
  });

  it('should throw error for loans with missing required fields', () => {
    const missingProvider = JSON.stringify({
      loans: [
        {
          Id: 'test-1',
          Name: 'Test',
          StartDate: new Date().toISOString(),
          EndDate: new Date().toISOString(),
        },
      ],
      investments: [],
    });
    expect(() => importFromJson(missingProvider)).toThrow(
      "Missing required field 'Provider'"
    );

    const missingName = JSON.stringify({
      loans: [
        {
          Id: 'test-1',
          Provider: 'Bank',
          StartDate: new Date().toISOString(),
          EndDate: new Date().toISOString(),
        },
      ],
      investments: [],
    });
    expect(() => importFromJson(missingName)).toThrow(
      "Missing required field 'Name'"
    );
  });

  it('should throw error for loans with empty string fields', () => {
    const emptyProvider = JSON.stringify({
      loans: [
        {
          Id: 'test-1',
          Provider: '  ',
          Name: 'Test',
          InterestRate: 5,
          Principal: 10000,
          CurrentAmount: 10000,
          StartDate: new Date().toISOString(),
          EndDate: new Date().toISOString(),
        },
      ],
      investments: [],
    });
    expect(() => importFromJson(emptyProvider)).toThrow(
      "Required field 'Provider' cannot be empty"
    );

    const emptyName = JSON.stringify({
      loans: [
        {
          Id: 'test-1',
          Provider: 'Bank',
          Name: '',
          InterestRate: 5,
          Principal: 10000,
          CurrentAmount: 10000,
          StartDate: new Date().toISOString(),
          EndDate: new Date().toISOString(),
        },
      ],
      investments: [],
    });
    expect(() => importFromJson(emptyName)).toThrow(
      "Required field 'Name' cannot be empty"
    );
  });

  it('should throw error for investments with missing required fields', () => {
    const missingProvider = JSON.stringify({
      loans: [],
      investments: [
        { Id: 'test-1', Name: 'Test', StartDate: new Date().toISOString() },
      ],
    });
    expect(() => importFromJson(missingProvider)).toThrow(
      "Missing required field 'Provider'"
    );

    const missingStartingBalance = JSON.stringify({
      loans: [],
      investments: [
        {
          Id: 'test-1',
          Provider: 'Fund',
          Name: 'Test',
          StartDate: new Date().toISOString(),
          AverageReturnRate: 5,
          CompoundingPeriod: 'annually',
        },
      ],
    });
    expect(() => importFromJson(missingStartingBalance)).toThrow(
      "Missing required field 'StartingBalance'"
    );
  });

  it('should throw error for investments with empty string fields', () => {
    const emptyProvider = JSON.stringify({
      loans: [],
      investments: [
        {
          Id: 'test-1',
          Provider: '  ',
          Name: 'Test',
          StartingBalance: 5000,
          AverageReturnRate: 5,
          CompoundingPeriod: 'annually',
          StartDate: new Date().toISOString(),
        },
      ],
    });
    expect(() => importFromJson(emptyProvider)).toThrow(
      "Required field 'Provider' cannot be empty"
    );

    const emptyName = JSON.stringify({
      loans: [],
      investments: [
        {
          Id: 'test-1',
          Provider: 'Fund',
          Name: '',
          StartingBalance: 5000,
          AverageReturnRate: 5,
          CompoundingPeriod: 'annually',
          StartDate: new Date().toISOString(),
        },
      ],
    });
    expect(() => importFromJson(emptyName)).toThrow(
      "Required field 'Name' cannot be empty"
    );
  });

  it('should throw error for invalid dates', () => {
    const invalidJson = JSON.stringify({
      loans: [{ ...testLoan, StartDate: 'invalid-date' }],
      investments: [],
    });

    expect(() => importFromJson(invalidJson)).toThrow('Invalid date');
  });

  it('should preserve all loan fields', () => {
    const json = exportToJson([testLoan], []);
    const { loans } = importFromJson(json);

    expect(loans[0].Provider).toBe(testLoan.Provider);
    expect(loans[0].InterestRate).toBe(testLoan.InterestRate);
    expect(loans[0].Principal).toBe(testLoan.Principal);
    expect(loans[0].CurrentAmount).toBe(testLoan.CurrentAmount);
    expect(loans[0].MonthlyPayment).toBe(testLoan.MonthlyPayment);
  });

  it('should preserve all investment fields', () => {
    const json = exportToJson([], [testInvestment]);
    const { investments } = importFromJson(json);

    expect(investments[0].Provider).toBe(testInvestment.Provider);
    expect(investments[0].StartingBalance).toBe(testInvestment.StartingBalance);
    expect(investments[0].AverageReturnRate).toBe(
      testInvestment.AverageReturnRate
    );
    expect(investments[0].CompoundingPeriod).toBe(
      testInvestment.CompoundingPeriod
    );
  });

  it('should throw error for loans with missing IDs', () => {
    const invalidJson = JSON.stringify({
      loans: [{ ...testLoan, Id: '' }],
      investments: [],
    });

    expect(() => importFromJson(invalidJson)).toThrow(
      'Invalid or missing ID in loan'
    );
  });

  it('should throw error for investments with missing IDs', () => {
    const invalidJson = JSON.stringify({
      loans: [],
      investments: [{ ...testInvestment, Id: '' }],
    });

    expect(() => importFromJson(invalidJson)).toThrow(
      'Invalid or missing ID in investment'
    );
  });

  it('should throw error for loans with whitespace-only IDs', () => {
    const invalidJson = JSON.stringify({
      loans: [{ ...testLoan, Id: '   ' }],
      investments: [],
    });

    expect(() => importFromJson(invalidJson)).toThrow(
      'Invalid or missing ID in loan'
    );
  });

  it('should throw error for loans without Id field', () => {
    const loanWithoutId = { ...testLoan };
    delete (loanWithoutId as { Id?: string }).Id;

    const invalidJson = JSON.stringify({
      loans: [loanWithoutId],
      investments: [],
    });

    expect(() => importFromJson(invalidJson)).toThrow(
      'Invalid or missing ID in loan'
    );
  });

  it('should round-trip optional input fields for Loan and Investment', () => {
    const loanWithOptional: Loan = {
      ...testLoan,
      MonthlyPayment: 1234.56,
    };

    const investmentWithOptional: Investment = {
      ...testInvestment,
      CurrentValue: 15000,
      RecurringContribution: 500,
      ContributionFrequency: CompoundingFrequency.Monthly,
      ContributionStepUpAmount: 50,
      ContributionStepUpType: StepUpType.Flat,
    };

    const json = exportToJson([loanWithOptional], [investmentWithOptional]);
    const { loans, investments } = importFromJson(json);

    expect(loans[0].MonthlyPayment).toBe(1234.56);
    expect(investments[0].CurrentValue).toBe(15000);
    expect(investments[0].RecurringContribution).toBe(500);
    expect(investments[0].ContributionFrequency).toBe(
      CompoundingFrequency.Monthly
    );
    expect(investments[0].ContributionStepUpAmount).toBe(50);
    expect(investments[0].ContributionStepUpType).toBe(StepUpType.Flat);
  });

  it('should successfully import a legacy v1 file with no schemaVersion', () => {
    const v1JsonNoVersion = JSON.stringify({
      loans: [
        {
          ...testLoan,
          StartDate: testLoan.StartDate.toISOString(),
          EndDate: testLoan.EndDate.toISOString(),
        },
      ],
      investments: [
        {
          ...testInvestment,
          StartDate: testInvestment.StartDate.toISOString(),
        },
      ],
      exportDate: new Date().toISOString(),
      version: '0.5.0',
    });

    const { loans, investments } = importFromJson(v1JsonNoVersion);

    expect(loans).toHaveLength(1);
    expect(loans[0].Name).toBe('Test Loan');
    expect(investments).toHaveLength(1);
    expect(investments[0].Name).toBe('Test Investment');
  });

  it('should reject a file with schemaVersion: null', () => {
    const json = JSON.stringify({
      schemaVersion: null,
      loans: [],
      investments: [],
      exportDate: new Date().toISOString(),
      version: '1.0.0',
    });

    expect(() => importFromJson(json)).toThrow(
      'schemaVersion must be a number'
    );
  });

  it('should reject a file with schemaVersion as a string', () => {
    const json = JSON.stringify({
      schemaVersion: '2',
      loans: [],
      investments: [],
      exportDate: new Date().toISOString(),
      version: '1.0.0',
    });

    expect(() => importFromJson(json)).toThrow(
      'schemaVersion must be a number'
    );
  });
});

describe('mergeData', () => {
  it('should add new items when IDs do not match', () => {
    const existing = [
      { Id: '1', name: 'Item 1' },
      { Id: '2', name: 'Item 2' },
    ];
    const imported = [{ Id: '3', name: 'Item 3' }];

    const { items: result, result: stats } = mergeData(existing, imported);

    expect(result).toHaveLength(3);
    expect(result.find((item) => item.Id === '3')).toBeTruthy();
    expect(stats.added).toBe(1);
    expect(stats.updated).toBe(0);
  });

  it('should overwrite existing items when IDs match', () => {
    const existing = [
      { Id: '1', name: 'Item 1' },
      { Id: '2', name: 'Item 2' },
    ];
    const imported = [{ Id: '2', name: 'Updated Item 2' }];

    const { items: result, result: stats } = mergeData(existing, imported);

    expect(result).toHaveLength(2);
    expect(result.find((item) => item.Id === '2')?.name).toBe('Updated Item 2');
    expect(stats.added).toBe(0);
    expect(stats.updated).toBe(1);
  });

  it('should handle both adding and updating in the same merge', () => {
    const existing = [
      { Id: '1', name: 'Item 1' },
      { Id: '2', name: 'Item 2' },
    ];
    const imported = [
      { Id: '2', name: 'Updated Item 2' },
      { Id: '3', name: 'Item 3' },
    ];

    const { items: result, result: stats } = mergeData(existing, imported);

    expect(result).toHaveLength(3);
    expect(result.find((item) => item.Id === '2')?.name).toBe('Updated Item 2');
    expect(result.find((item) => item.Id === '3')).toBeTruthy();
    expect(stats.added).toBe(1);
    expect(stats.updated).toBe(1);
  });

  it('should handle empty existing array', () => {
    const existing: Array<{ Id: string; name: string }> = [];
    const imported = [{ Id: '1', name: 'Item 1' }];

    const { items: result, result: stats } = mergeData(existing, imported);

    expect(result).toHaveLength(1);
    expect(stats.added).toBe(1);
    expect(stats.updated).toBe(0);
  });

  it('should handle empty imported array', () => {
    const existing = [{ Id: '1', name: 'Item 1' }];
    const imported: Array<{ Id: string; name: string }> = [];

    const { items: result, result: stats } = mergeData(existing, imported);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(existing[0]);
    expect(stats.added).toBe(0);
    expect(stats.updated).toBe(0);
  });

  it('should skip items with empty IDs', () => {
    const existing = [
      { Id: '1', name: 'Item 1' },
      { Id: '2', name: 'Item 2' },
    ];
    const imported = [
      { Id: '', name: 'Empty ID Item' },
      { Id: '3', name: 'Item 3' },
    ];

    const { items: result, result: stats } = mergeData(existing, imported);

    expect(result).toHaveLength(3);
    expect(
      result.find((item) => item.name === 'Empty ID Item')
    ).toBeUndefined();
    expect(result.find((item) => item.Id === '3')).toBeTruthy();
    expect(stats.added).toBe(1);
  });

  it('should not match items with empty IDs to each other', () => {
    const existing = [
      { Id: '', name: 'Empty ID 1' },
      { Id: '1', name: 'Item 1' },
    ];
    const imported = [{ Id: '', name: 'Empty ID 2' }];

    const { items: result, result: stats } = mergeData(existing, imported);

    // Should still have the original empty ID item, new one should be skipped
    expect(result).toHaveLength(2);
    expect(result.find((item) => item.name === 'Empty ID 1')).toBeTruthy();
    expect(result.find((item) => item.name === 'Empty ID 2')).toBeUndefined();
    expect(stats.added).toBe(0);
    expect(stats.updated).toBe(0);
  });
});
