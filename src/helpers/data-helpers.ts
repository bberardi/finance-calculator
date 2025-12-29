import { Loan } from '../models/loan-model';
import { Investment } from '../models/investment-model';

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
 * Generate a unique ID using timestamp and random string
 * Format: {timestamp}-{random-alphanumeric}
 * Example: "1766972407476-q672d9h3f"
 *
 * Note: While collisions are theoretically possible if multiple IDs are generated
 * in rapid succession, the random component (9 characters from base-36) makes this
 * highly unlikely in practice for client-side use.
 */
export const generateUniqueId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
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
    version: '1.0',
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
        'Invalid data format: missing loans or investments arrays'
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
      if (!serializedLoan.Id || serializedLoan.Id.trim() === '') {
        throw new Error(
          `Invalid or missing ID in loan at index ${index}. All items must have a non-empty ID.`
        );
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
        if (!serializedInvestment.Id || serializedInvestment.Id.trim() === '') {
          throw new Error(
            `Invalid or missing ID in investment at index ${index}. All items must have a non-empty ID.`
          );
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
  const merged = [...existing];
  const existingIds = new Set(
    existing
      .filter((item) => item.Id && item.Id.trim() !== '')
      .map((item) => item.Id)
  );

  let added = 0;
  let updated = 0;

  imported.forEach((item) => {
    // Skip items with empty IDs
    if (!item.Id || item.Id.trim() === '') {
      return;
    }

    if (existingIds.has(item.Id)) {
      // Replace existing item with same ID
      const index = merged.findIndex((m) => m.Id === item.Id);
      if (index !== -1) {
        merged[index] = item;
        updated++;
      }
    } else {
      // Add new item
      merged.push(item);
      added++;
    }
  });

  return { items: merged, result: { added, updated } };
};
