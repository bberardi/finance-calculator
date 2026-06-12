import { Loan } from '../models/loan-model';
import {
  Investment,
  CompoundingFrequency,
  StepUpType,
} from '../models/investment-model';
import packageJson from '../../package.json';

// Schema v2: inputs only. v1 files are rejected — only schema v2 is accepted.
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
 * Check that a value is a finite number (rejects NaN, Infinity, non-number types)
 */
const isFiniteNumber = (value: unknown): value is number => {
  return typeof value === 'number' && isFinite(value);
};

/**
 * Validate a required numeric field: must be a finite number and satisfy the
 * given range predicate.  Throws a descriptive error on failure.
 */
const validateNumericField = (
  value: unknown,
  field: string,
  entityType: string,
  index: number,
  predicate: (n: number) => boolean = () => true,
  rangeDescription = 'a finite number'
): void => {
  if (!isFiniteNumber(value)) {
    throw new Error(
      `Invalid value for '${field}' in ${entityType} at index ${index}: expected ${rangeDescription}, got ${JSON.stringify(value)}.`
    );
  }
  if (!predicate(value)) {
    throw new Error(
      `Invalid value for '${field}' in ${entityType} at index ${index}: expected ${rangeDescription}, got ${value}.`
    );
  }
};

/**
 * Validate an optional numeric field when it is present (not undefined/null).
 */
const validateOptionalNumericField = (
  value: unknown,
  field: string,
  entityType: string,
  index: number,
  predicate: (n: number) => boolean = () => true,
  rangeDescription = 'a finite number'
): void => {
  if (value === undefined || value === null) return;
  validateNumericField(
    value,
    field,
    entityType,
    index,
    predicate,
    rangeDescription
  );
};

/** Valid CompoundingFrequency values derived from the enum */
const VALID_COMPOUNDING_FREQUENCIES: string[] =
  Object.values(CompoundingFrequency);

/** Valid StepUpType values derived from the enum */
const VALID_STEP_UP_TYPES: string[] = Object.values(StepUpType);

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
 * Accepts schema v2 only. Legacy v1 files (no schemaVersion or schemaVersion < 2)
 * are rejected. Throws error if JSON is invalid, missing required fields,
 * or the schema version is not exactly EXPORT_SCHEMA_VERSION.
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

    // Only schema v2 is accepted; v1 files (missing schemaVersion or < 2) are rejected
    if (data.schemaVersion === undefined) {
      throw new Error(
        'Invalid data format: missing schemaVersion. Legacy (v1) files are not supported.'
      );
    }
    if (typeof data.schemaVersion !== 'number') {
      throw new Error('Invalid data format: schemaVersion must be a number.');
    }
    if (data.schemaVersion > EXPORT_SCHEMA_VERSION) {
      throw new Error(
        `Unsupported schema version ${data.schemaVersion}: this file was exported by a newer version of the app.`
      );
    }
    if (data.schemaVersion < EXPORT_SCHEMA_VERSION) {
      throw new Error(
        `Unsupported schema version ${data.schemaVersion}: legacy files are not supported.`
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

      // Validate numeric fields: required fields must be finite numbers in sane ranges
      validateNumericField(
        serializedLoan.InterestRate,
        'InterestRate',
        'loan',
        index,
        (n) => n >= 0,
        'a non-negative finite number'
      );
      validateNumericField(
        serializedLoan.Principal,
        'Principal',
        'loan',
        index,
        (n) => n >= 0,
        'a non-negative finite number'
      );
      validateNumericField(
        serializedLoan.CurrentAmount,
        'CurrentAmount',
        'loan',
        index,
        (n) => n >= 0,
        'a non-negative finite number'
      );

      // Validate optional numeric fields when present
      validateOptionalNumericField(
        serializedLoan.MonthlyPayment,
        'MonthlyPayment',
        'loan',
        index,
        (n) => n >= 0,
        'a non-negative finite number'
      );

      // Pick fields explicitly so unknown properties are dropped at the import boundary
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

        // Validate numeric fields: required fields must be finite numbers in sane ranges
        validateNumericField(
          serializedInvestment.StartingBalance,
          'StartingBalance',
          'investment',
          index,
          (n) => n >= 0,
          'a non-negative finite number'
        );
        validateNumericField(
          serializedInvestment.AverageReturnRate,
          'AverageReturnRate',
          'investment',
          index,
          (n) => n >= 0,
          'a non-negative finite number'
        );

        // Validate optional numeric fields when present
        validateOptionalNumericField(
          serializedInvestment.RecurringContribution,
          'RecurringContribution',
          'investment',
          index,
          (n) => n >= 0,
          'a non-negative finite number'
        );
        validateOptionalNumericField(
          serializedInvestment.ContributionStepUpAmount,
          'ContributionStepUpAmount',
          'investment',
          index,
          (n) => n >= 0,
          'a non-negative finite number'
        );
        validateOptionalNumericField(
          serializedInvestment.CurrentValue,
          'CurrentValue',
          'investment',
          index,
          (n) => n >= 0,
          'a non-negative finite number'
        );

        // Validate enum fields: CompoundingPeriod must be a valid CompoundingFrequency value
        if (
          !VALID_COMPOUNDING_FREQUENCIES.includes(
            serializedInvestment.CompoundingPeriod as string
          )
        ) {
          throw new Error(
            `Invalid value for 'CompoundingPeriod' in investment at index ${index}: expected one of ${VALID_COMPOUNDING_FREQUENCIES.join(', ')}, got ${JSON.stringify(serializedInvestment.CompoundingPeriod)}.`
          );
        }

        // Validate optional enum fields when present
        if (
          serializedInvestment.ContributionFrequency !== undefined &&
          serializedInvestment.ContributionFrequency !== null &&
          !VALID_COMPOUNDING_FREQUENCIES.includes(
            serializedInvestment.ContributionFrequency as string
          )
        ) {
          throw new Error(
            `Invalid value for 'ContributionFrequency' in investment at index ${index}: expected one of ${VALID_COMPOUNDING_FREQUENCIES.join(', ')}, got ${JSON.stringify(serializedInvestment.ContributionFrequency)}.`
          );
        }

        if (
          serializedInvestment.ContributionStepUpType !== undefined &&
          serializedInvestment.ContributionStepUpType !== null &&
          !VALID_STEP_UP_TYPES.includes(
            serializedInvestment.ContributionStepUpType as string
          )
        ) {
          throw new Error(
            `Invalid value for 'ContributionStepUpType' in investment at index ${index}: expected one of ${VALID_STEP_UP_TYPES.join(', ')}, got ${JSON.stringify(serializedInvestment.ContributionStepUpType)}.`
          );
        }

        // Pick fields explicitly so unknown properties are dropped at the import boundary
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
