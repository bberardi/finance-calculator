import { Loan } from '../models/loan-model';
import { Investment } from '../models/investment-model';

export interface ExportData {
  loans: Loan[];
  investments: Investment[];
  exportDate: string;
  version: string;
}

/**
 * Generate a unique ID using timestamp and random string
 */
export const generateUniqueId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Serialize loans and investments to JSON string
 * Converts Date objects to ISO strings for JSON compatibility
 */
export const exportToJson = (
  loans: Loan[],
  investments: Investment[]
): string => {
  const exportData: ExportData = {
    loans: loans.map((loan) => ({
      ...loan,
      StartDate: loan.StartDate.toISOString(),
      EndDate: loan.EndDate.toISOString(),
      AmortizationSchedule: loan.AmortizationSchedule || [],
    })) as unknown as Loan[],
    investments: investments.map((investment) => ({
      ...investment,
      StartDate: investment.StartDate.toISOString(),
      ProjectedGrowth: investment.ProjectedGrowth || [],
    })) as unknown as Investment[],
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
    const loans: Loan[] = data.loans.map((loan) => ({
      ...loan,
      StartDate: new Date(loan.StartDate as unknown as string),
      EndDate: new Date(loan.EndDate as unknown as string),
      AmortizationSchedule: loan.AmortizationSchedule || [],
    }));

    const investments: Investment[] = data.investments.map((investment) => ({
      ...investment,
      StartDate: new Date(investment.StartDate as unknown as string),
      ProjectedGrowth: investment.ProjectedGrowth || [],
    }));

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
 */
export const mergeData = <T extends { Id: string }>(
  existing: T[],
  imported: T[]
): T[] => {
  const merged = [...existing];
  const existingIds = new Set(existing.map((item) => item.Id));

  imported.forEach((item) => {
    if (existingIds.has(item.Id)) {
      // Replace existing item with same ID
      const index = merged.findIndex((m) => m.Id === item.Id);
      if (index !== -1) {
        merged[index] = item;
      }
    } else {
      // Add new item
      merged.push(item);
    }
  });

  return merged;
};
