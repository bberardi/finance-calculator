import { Loan } from '../models/loan-model';
import { Investment } from '../models/investment-model';
import packageJson from '../../package.json';

// Schema v2: inputs only. v1 files additionally embedded derived data
// (AmortizationSchedule/ProjectedGrowth), which import now ignores.
export const EXPORT_SCHEMA_VERSION = 2;

// Serialized versions with Date fields converted to strings
export interface SerializedLoan extends Omit<Loan, 'StartDate' | 'EndDate'> {
  StartDate: string;
  EndDate: string;
}

export interface SerializedInvestment extends Omit<Investment, 'StartDate'> {
  StartDate: string;
}

export interface ExportData {
  schemaVersion: number;
  loans: SerializedLoan[];
  investments: SerializedInvestment[];
  exportDate: string;
  version: string;
}

export interface MergeResult {
  added: number;
  updated: number;
}

/**
 * Check if an ID is valid (non-empty and non-whitespace)
 */
const isValidId = (id: string | undefined): boolean => {
  return !!id && id.trim() !== '';
};

/**
 * Serialize loans and investments to JSON string (schema v2, inputs only)
 * Converts Date objects to ISO strings for JSON compatibility
 */
export const exportToJson = (
  loans: Loan[],
  investments: Investment[]
): string => {
  const serializedLoans: SerializedLoan[] = loans.map((loan) => ({
    ...loan,
    StartDate: loan.StartDate.toISOString(),
    EndDate: loan.EndDate.toISOString(),
  }));

  const serializedInvestments: SerializedInvestment[] = investments.map(
    (investment) => ({
      ...investment,
      StartDate: investment.StartDate.toISOString(),
    })
  );

  const exportData: ExportData = {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    loans: serializedLoans,
    investments: serializedInvestments,
    exportDate: new Date().toISOString(),
    version: packageJson.version,
  };

  return JSON.stringify(exportData, null, 2);
};

/**
 * Parse JSON string and convert ISO date strings back to Date objects
 * Accepts schema v2 (inputs only) and legacy v1 files (whose embedded
 * derived fields are ignored — schedules are always recomputed on demand).
 * Throws error if JSON is invalid or missing required fields
 */
export const importFromJson = (
  jsonString: string
): { loans: Loan[]; investments: Investment[] } => {
  try {
    const data = JSON.parse(jsonString) as ExportData;

    // Validate the structure
    if (!data.loans || !data.investments) {
      throw new Error(
        'Invalid data format: Expected an object with "loans" and "investments" arrays.'
      );
    }

    if (!Array.isArray(data.loans) || !Array.isArray(data.investments)) {
      throw new Error(
        'Invalid data format: loans and investments must be arrays'
      );
    }

    // v1 files have no schemaVersion; reject files from a newer app version
    if (
      data.schemaVersion !== undefined &&
      data.schemaVersion > EXPORT_SCHEMA_VERSION
    ) {
      throw new Error(
        `Unsupported schema version ${data.schemaVersion}: this file was exported by a newer version of the app.`
      );
    }

    // Convert ISO date strings back to Date objects
    const loans: Loan[] = data.loans.map((serializedLoan, index) => {
      // Validate ID is present and non-empty
      if (!isValidId(serializedLoan.Id)) {
        throw new Error(
          `Invalid or missing ID in loan at index ${index}. All items must have a non-empty ID.`
        );
      }

      // Validate required fields are present
      const requiredFields = [
        'Provider',
        'Name',
        'InterestRate',
        'Principal',
        'CurrentAmount',
        'StartDate',
        'EndDate',
      ];
      for (const field of requiredFields) {
        const value = serializedLoan[field as keyof SerializedLoan];
        if (value === undefined || value === null) {
          throw new Error(
            `Missing required field '${field}' in loan at index ${index}.`
          );
        }
        // Validate string fields are not empty
        if (
          (field === 'Provider' || field === 'Name') &&
          typeof value === 'string' &&
          value.trim() === ''
        ) {
          throw new Error(
            `Required field '${field}' cannot be empty in loan at index ${index}.`
          );
        }
      }

      // Pick fields explicitly so legacy v1 derived data (and any unknown
      // properties) never make it past the import boundary
      return {
        Id: serializedLoan.Id,
        Provider: serializedLoan.Provider,
        Name: serializedLoan.Name,
        InterestRate: serializedLoan.InterestRate,
        Principal: serializedLoan.Principal,
        CurrentAmount: serializedLoan.CurrentAmount,
        MonthlyPayment: serializedLoan.MonthlyPayment,
        StartDate: new Date(serializedLoan.StartDate),
        EndDate: new Date(serializedLoan.EndDate),
      };
    });

    const investments: Investment[] = data.investments.map(
      (serializedInvestment, index) => {
        // Validate ID is present and non-empty
        if (!isValidId(serializedInvestment.Id)) {
          throw new Error(
            `Invalid or missing ID in investment at index ${index}. All items must have a non-empty ID.`
          );
        }

        // Validate required fields are present
        const requiredFields = [
          'Provider',
          'Name',
          'StartingBalance',
          'AverageReturnRate',
          'CompoundingPeriod',
          'StartDate',
        ];
        for (const field of requiredFields) {
          const value =
            serializedInvestment[field as keyof SerializedInvestment];
          if (value === undefined || value === null) {
            throw new Error(
              `Missing required field '${field}' in investment at index ${index}.`
            );
          }
          // Validate string fields are not empty
          if (
            (field === 'Provider' ||
              field === 'Name' ||
              field === 'CompoundingPeriod') &&
            typeof value === 'string' &&
            value.trim() === ''
          ) {
            throw new Error(
              `Required field '${field}' cannot be empty in investment at index ${index}.`
            );
          }
        }

        // Pick fields explicitly so legacy v1 derived data (and any unknown
        // properties) never make it past the import boundary
        return {
          Id: serializedInvestment.Id,
          Provider: serializedInvestment.Provider,
          Name: serializedInvestment.Name,
          StartDate: new Date(serializedInvestment.StartDate),
          StartingBalance: serializedInvestment.StartingBalance,
          AverageReturnRate: serializedInvestment.AverageReturnRate,
          CompoundingPeriod: serializedInvestment.CompoundingPeriod,
          RecurringContribution: serializedInvestment.RecurringContribution,
          ContributionFrequency: serializedInvestment.ContributionFrequency,
          ContributionStepUpAmount:
            serializedInvestment.ContributionStepUpAmount,
          ContributionStepUpType: serializedInvestment.ContributionStepUpType,
          CurrentValue: serializedInvestment.CurrentValue,
        };
      }
    );

    // Validate that dates are valid
    loans.forEach((loan, index) => {
      if (isNaN(loan.StartDate.getTime()) || isNaN(loan.EndDate.getTime())) {
        throw new Error(`Invalid date in loan at index ${index}`);
      }
    });

    investments.forEach((investment, index) => {
      if (isNaN(investment.StartDate.getTime())) {
        throw new Error(`Invalid date in investment at index ${index}`);
      }
    });

    return { loans, investments };
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('Invalid JSON format: unable to parse file');
    }
    throw error;
  }
};

/**
 * Merge imported data with existing data
 * If ID matches, overwrite the existing item
 * If ID doesn't match, add as new item
 * Returns statistics about the merge operation
 */
export const mergeData = <T extends { Id: string }>(
  existing: T[],
  imported: T[]
): { items: T[]; result: MergeResult } => {
  // Build a map for O(1) lookups instead of O(n) findIndex
  const existingMap = new Map<string, T>();
  existing.forEach((item) => {
    if (isValidId(item.Id)) {
      existingMap.set(item.Id, item);
    }
  });

  let added = 0;
  let updated = 0;

  imported.forEach((item) => {
    // Skip items with empty IDs
    if (!isValidId(item.Id)) {
      return;
    }

    if (existingMap.has(item.Id)) {
      // Replace existing item with same ID
      existingMap.set(item.Id, item);
      updated++;
    } else {
      // Add new item
      existingMap.set(item.Id, item);
      added++;
    }
  });

  // Convert map back to array, maintaining items with empty IDs
  const validItems = Array.from(existingMap.values());
  const emptyIdItems = existing.filter((item) => !isValidId(item.Id));

  return {
    items: [...emptyIdItems, ...validItems],
    result: { added, updated },
  };
};
