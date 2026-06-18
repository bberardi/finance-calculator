import { Loan } from '../models/loan-model';
import {
  Investment,
  CompoundingFrequency,
  StepUpType,
} from '../models/investment-model';
import { Scenario } from '../models/scenario-model';
import { CURRENT_SCHEMA_VERSION, RawData, migrate } from './migrate-helpers';
import packageJson from '../../package.json';

// Schema v3 (Phase 4.5): inputs only — loans, investments, and named scenarios.
// v2 files (no scenarios) import forward via the D8 migration ladder; v1 and
// newer-than-current versions are rejected there.
export const EXPORT_SCHEMA_VERSION = CURRENT_SCHEMA_VERSION;

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
  scenarios: Scenario[];
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
  predicate: (n: number) => boolean,
  rangeDescription: string
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
  predicate: (n: number) => boolean,
  rangeDescription: string
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

// Date fields must be ISO date *strings*. `new Date(value)` coerces a raw epoch
// number or a boolean into a valid Date (e.g. `new Date(true)` →
// 1970-01-01T00:00:00.001Z), so a downstream `isNaN(getTime())` check never
// fires and a tampered/hand-edited file silently materializes a wrong date.
// Reject any non-string up front, consistent with the numeric type validation
// (the NaN check still catches malformed strings afterward). (#100)
const validateDateField = (
  value: unknown,
  field: string,
  entityType: string,
  index: number
): void => {
  if (typeof value !== 'string') {
    throw new Error(
      `Invalid value for '${field}' in ${entityType} at index ${index}: expected an ISO date string.`
    );
  }
};

/** Valid CompoundingFrequency values derived from the enum */
const VALID_COMPOUNDING_FREQUENCIES: string[] =
  Object.values(CompoundingFrequency);

/** Valid StepUpType values derived from the enum */
const VALID_STEP_UP_TYPES: string[] = Object.values(StepUpType);

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Validate a scenario's extra-amounts map: every value must be a finite number.
 * A missing map is treated as empty, so partial scenarios import cleanly.
 */
const parseNumberRecord = (
  value: unknown,
  field: string,
  scenarioIndex: number
): Record<string, number> => {
  if (value === undefined || value === null) return {};
  if (!isPlainObject(value)) {
    throw new Error(
      `Invalid '${field}' in scenario at index ${scenarioIndex}: expected an object of amounts.`
    );
  }
  const result: Record<string, number> = {};
  for (const [key, amount] of Object.entries(value)) {
    if (!isFiniteNumber(amount)) {
      throw new Error(
        `Invalid amount for '${key}' in '${field}' of scenario at index ${scenarioIndex}: expected a finite number, got ${JSON.stringify(amount)}.`
      );
    }
    result[key] = amount;
  }
  return result;
};

/**
 * Validate and normalize the scenarios array (schema v3). A missing array
 * imports as no scenarios; malformed entries throw, matching the strictness of
 * loan/investment validation.
 */
const parseScenarios = (value: unknown): Scenario[] => {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    throw new Error('Invalid data format: scenarios must be an array.');
  }
  return value.map((raw, index) => {
    if (!isPlainObject(raw)) {
      throw new Error(
        `Invalid scenario at index ${index}: expected an object.`
      );
    }
    if (!isValidId(raw.Id as string | undefined)) {
      throw new Error(`Invalid or missing Id in scenario at index ${index}.`);
    }
    if (typeof raw.Name !== 'string' || raw.Name.trim() === '') {
      throw new Error(`Invalid or missing Name in scenario at index ${index}.`);
    }
    return {
      Id: raw.Id as string,
      Name: raw.Name,
      ExtraLoanPayments: parseNumberRecord(
        raw.ExtraLoanPayments,
        'ExtraLoanPayments',
        index
      ),
      ExtraContributions: parseNumberRecord(
        raw.ExtraContributions,
        'ExtraContributions',
        index
      ),
    };
  });
};

/**
 * Serialize loans, investments, and scenarios to a JSON string (schema v3,
 * inputs only). Converts Date objects to ISO strings for JSON compatibility.
 */
export const exportToJson = (
  loans: Loan[],
  investments: Investment[],
  scenarios: Scenario[] = []
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
    scenarios,
    exportDate: new Date().toISOString(),
    version: packageJson.version,
  };

  return JSON.stringify(exportData, null, 2);
};

/**
 * Parse a JSON string into validated inputs (loans, investments, scenarios) with
 * Date fields restored. Routes the parsed payload through the D8 migration
 * ladder (D8/migrate), so v2 files upgrade forward and v1 / newer-than-current
 * versions are rejected with stable messages. Throws on invalid JSON, an
 * unmigratable version, or any malformed field.
 */
export const importFromJson = (
  jsonString: string
): { loans: Loan[]; investments: Investment[]; scenarios: Scenario[] } => {
  try {
    const raw = JSON.parse(jsonString) as ExportData;

    // Validate the structure
    if (!raw.loans || !raw.investments) {
      throw new Error(
        'Invalid data format: Expected an object with "loans" and "investments" arrays.'
      );
    }

    if (!Array.isArray(raw.loans) || !Array.isArray(raw.investments)) {
      throw new Error(
        'Invalid data format: loans and investments must be arrays'
      );
    }

    // D8 ladder: gate the version and upgrade older schemas (v2 → v3) before
    // validation. Throws with the stable legacy/unsupported messages.
    const data = migrate(raw as unknown as RawData) as unknown as ExportData;

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

      // Date fields must be ISO strings (the NaN check below catches malformed
      // strings; this rejects non-string types that would coerce to a wrong
      // date). (#100)
      validateDateField(serializedLoan.StartDate, 'StartDate', 'loan', index);
      validateDateField(serializedLoan.EndDate, 'EndDate', 'loan', index);

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

        // Date field must be an ISO string (the NaN check below catches malformed
        // strings; this rejects non-string types that would coerce to a wrong
        // date). (#100)
        validateDateField(
          serializedInvestment.StartDate,
          'StartDate',
          'investment',
          index
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
      // Mirror the form's validateLoan rule at the import boundary: a loan whose
      // EndDate is on or before its StartDate is rejected by the UI, so accepting
      // it on import produces a degenerate 1-term schedule and an entity the Edit
      // dialog can't save. Keep import and validateLoan in agreement. (#85)
      if (!(loan.StartDate < loan.EndDate)) {
        throw new Error(
          `Invalid dates in loan at index ${index}: end date must be after the start date.`
        );
      }
    });

    investments.forEach((investment, index) => {
      if (isNaN(investment.StartDate.getTime())) {
        throw new Error(`Invalid date in investment at index ${index}`);
      }
    });

    const scenarios = parseScenarios(data.scenarios);

    return { loans, investments, scenarios };
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
