import { Loan } from '../models/loan-model';
import { Investment } from '../models/investment-model';
import packageJson from '../../package.json';

// Serialized versions with Date fields converted to strings
export interface SerializedLoan extends Omit<Loan, 'StartDate' | 'EndDate'> {
  StartDate: string;
  EndDate: string;
}

export interface SerializedInvestment extends Omit<Investment, 'StartDate'> {
  StartDate: string;
}

export interface ExportData {
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
 * Serialize loans and investments to JSON string
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
    AmortizationSchedule: loan.AmortizationSchedule || [],
  }));

  const serializedInvestments: SerializedInvestment[] = investments.map(
    (investment) => ({
      ...investment,
      StartDate: investment.StartDate.toISOString(),
      ProjectedGrowth: investment.ProjectedGrowth || [],
    })
  );

  const exportData: ExportData = {
    loans: serializedLoans,
    investments: serializedInvestments,
    exportDate: new Date().toISOString(),
    version: packageJson.version,
  };

  return JSON.stringify(exportData, null, 2);
};

/**
 * Parse JSON string and convert ISO date strings back to Date objects
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
        if (
          serializedLoan[field as keyof SerializedLoan] === undefined ||
          serializedLoan[field as keyof SerializedLoan] === null
        ) {
          throw new Error(
            `Missing required field '${field}' in loan at index ${index}.`
          );
        }
      }

      return {
        ...serializedLoan,
        StartDate: new Date(serializedLoan.StartDate),
        EndDate: new Date(serializedLoan.EndDate),
        AmortizationSchedule: serializedLoan.AmortizationSchedule || [],
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
          if (
            serializedInvestment[field as keyof SerializedInvestment] ===
              undefined ||
            serializedInvestment[field as keyof SerializedInvestment] === null
          ) {
            throw new Error(
              `Missing required field '${field}' in investment at index ${index}.`
            );
          }
        }

        return {
          ...serializedInvestment,
          StartDate: new Date(serializedInvestment.StartDate),
          ProjectedGrowth: serializedInvestment.ProjectedGrowth || [],
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

  return { items: [...emptyIdItems, ...validItems], result: { added, updated } };
};
