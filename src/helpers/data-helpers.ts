import { Loan } from '../models/loan-model';
import { CompoundingFrequency, StepUpType } from '../models/investment-model';
import { Asset, AssetType } from '../models/asset-model';
import { Scenario } from '../models/scenario-model';
import { CURRENT_SCHEMA_VERSION, RawData, migrate } from './migrate-helpers';
import packageJson from '../../package.json';

// Schema v5 (the investment fold): inputs only — loans, named scenarios, and
// assets (cash / property / investment / custom / custom-liability). Investments
// are no longer a separate array; they live in `assets` as AssetType.Investment.
// Older files import forward via the D8 migration ladder (v2 gains scenarios, v3
// gains assets, v4 folds investments into assets); v1 and newer-than-current
// versions are rejected there.
export const EXPORT_SCHEMA_VERSION = CURRENT_SCHEMA_VERSION;

// Serialized versions with Date fields converted to strings
export interface SerializedLoan extends Omit<Loan, 'StartDate' | 'EndDate'> {
  StartDate: string;
  EndDate: string;
}

// An asset's only Date field is the investment-only StartDate; it serializes to
// an ISO string (other asset fields serialize one-to-one).
export interface SerializedAsset extends Omit<Asset, 'StartDate'> {
  StartDate?: string;
}

export interface ExportData {
  schemaVersion: number;
  loans: SerializedLoan[];
  scenarios: Scenario[];
  assets: SerializedAsset[];
  exportDate: string;
  version: string;
}

export interface MergeResult {
  added: number;
  updated: number;
}

export interface MergePreview<T> {
  // Imported items whose Id is not yet present — they will be added.
  added: T[];
  // Imported items whose Id already exists — they will overwrite (clobber) the
  // current value. This is the unrecoverable case the pre-merge preview (6.3)
  // exists to surface before the user commits.
  overwritten: T[];
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

/** Valid AssetType values derived from the enum */
const VALID_ASSET_TYPES: string[] = Object.values(AssetType);

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
    const scenario: Scenario = {
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
    // One-time lump maps (Phase 8.2) are optional: attach them only when the file
    // actually carries them, so a recurring-only scenario round-trips byte-for-
    // byte (no empty OneTime clutter) while a one-time scenario is preserved.
    if (raw.OneTimeLoanPayments != null) {
      scenario.OneTimeLoanPayments = parseNumberRecord(
        raw.OneTimeLoanPayments,
        'OneTimeLoanPayments',
        index
      );
    }
    if (raw.OneTimeContributions != null) {
      scenario.OneTimeContributions = parseNumberRecord(
        raw.OneTimeContributions,
        'OneTimeContributions',
        index
      );
    }
    return scenario;
  });
};

/**
 * Validate and normalize the assets array (schema v4, Phase 7). A missing array
 * imports as no assets; malformed entries throw, matching the strictness of
 * loan/investment validation. Picks fields explicitly so unknown properties are
 * dropped at the import boundary.
 */
const parseAssets = (value: unknown): Asset[] => {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    throw new Error('Invalid data format: assets must be an array.');
  }
  return value.map((raw, index) => {
    if (!isPlainObject(raw)) {
      throw new Error(`Invalid asset at index ${index}: expected an object.`);
    }
    if (!isValidId(raw.Id as string | undefined)) {
      throw new Error(
        `Invalid or missing ID in asset at index ${index}. All items must have a non-empty ID.`
      );
    }
    if (typeof raw.Provider !== 'string' || raw.Provider.trim() === '') {
      throw new Error(
        `Required field 'Provider' cannot be empty in asset at index ${index}.`
      );
    }
    if (typeof raw.Name !== 'string' || raw.Name.trim() === '') {
      throw new Error(
        `Required field 'Name' cannot be empty in asset at index ${index}.`
      );
    }
    if (!VALID_ASSET_TYPES.includes(raw.AssetType as string)) {
      throw new Error(
        `Invalid value for 'AssetType' in asset at index ${index}: expected one of ${VALID_ASSET_TYPES.join(
          ', '
        )}, got ${JSON.stringify(raw.AssetType)}.`
      );
    }
    // Balance must be a non-negative finite number (a liability's debt is still
    // stored as a positive balance).
    validateNumericField(
      raw.Balance,
      'Balance',
      'asset',
      index,
      (n) => n >= 0,
      'a non-negative finite number'
    );
    // GrowthRate must be finite but MAY be negative (a depreciating asset).
    validateNumericField(
      raw.GrowthRate,
      'GrowthRate',
      'asset',
      index,
      () => true,
      'a finite number'
    );
    // Optional CompoundingPeriod, validated against the shared frequency enum.
    if (
      raw.CompoundingPeriod !== undefined &&
      raw.CompoundingPeriod !== null &&
      !VALID_COMPOUNDING_FREQUENCIES.includes(raw.CompoundingPeriod as string)
    ) {
      throw new Error(
        `Invalid value for 'CompoundingPeriod' in asset at index ${index}: expected one of ${VALID_COMPOUNDING_FREQUENCIES.join(
          ', '
        )}, got ${JSON.stringify(raw.CompoundingPeriod)}.`
      );
    }
    // Optional LinkedLoanId (7.2): a non-empty string when present.
    if (
      raw.LinkedLoanId !== undefined &&
      raw.LinkedLoanId !== null &&
      (typeof raw.LinkedLoanId !== 'string' || raw.LinkedLoanId.trim() === '')
    ) {
      throw new Error(
        `Invalid value for 'LinkedLoanId' in asset at index ${index}: expected a non-empty string.`
      );
    }

    // Investment-only fields (AssetType.Investment). All optional; validated
    // when present, mirroring the loan/investment import boundaries.
    validateOptionalNumericField(
      raw.RecurringContribution,
      'RecurringContribution',
      'asset',
      index,
      (n) => n >= 0,
      'a non-negative finite number'
    );
    validateOptionalNumericField(
      raw.ContributionStepUpAmount,
      'ContributionStepUpAmount',
      'asset',
      index,
      (n) => n >= 0,
      'a non-negative finite number'
    );
    validateOptionalNumericField(
      raw.CurrentValue,
      'CurrentValue',
      'asset',
      index,
      (n) => n >= 0,
      'a non-negative finite number'
    );
    // Employer-match inputs (ROADMAP 8.1); investment-only, optional, non-negative.
    validateOptionalNumericField(
      raw.EmployerMatchRate,
      'EmployerMatchRate',
      'asset',
      index,
      (n) => n >= 0,
      'a non-negative finite number'
    );
    validateOptionalNumericField(
      raw.EmployerMatchLimitPct,
      'EmployerMatchLimitPct',
      'asset',
      index,
      (n) => n >= 0,
      'a non-negative finite number'
    );
    validateOptionalNumericField(
      raw.AnnualSalary,
      'AnnualSalary',
      'asset',
      index,
      (n) => n >= 0,
      'a non-negative finite number'
    );
    let startDate: Date | undefined;
    if (raw.StartDate !== undefined && raw.StartDate !== null) {
      validateDateField(raw.StartDate, 'StartDate', 'asset', index);
      startDate = new Date(raw.StartDate as string);
      if (isNaN(startDate.getTime())) {
        throw new Error(
          `Invalid date for 'StartDate' in asset at index ${index}.`
        );
      }
    }
    // An investment-type asset must carry a StartDate — the standalone
    // Investment import required it, and without one `assetToInvestment` anchors
    // the forecast to the epoch (1970), producing a wildly wrong projection.
    // Other asset types legitimately omit it.
    if (raw.AssetType === AssetType.Investment && startDate === undefined) {
      throw new Error(
        `Missing required field 'StartDate' for investment asset at index ${index}.`
      );
    }
    if (
      raw.ContributionFrequency !== undefined &&
      raw.ContributionFrequency !== null &&
      !VALID_COMPOUNDING_FREQUENCIES.includes(
        raw.ContributionFrequency as string
      )
    ) {
      throw new Error(
        `Invalid value for 'ContributionFrequency' in asset at index ${index}: expected one of ${VALID_COMPOUNDING_FREQUENCIES.join(
          ', '
        )}, got ${JSON.stringify(raw.ContributionFrequency)}.`
      );
    }
    if (
      raw.ContributionStepUpType !== undefined &&
      raw.ContributionStepUpType !== null &&
      !VALID_STEP_UP_TYPES.includes(raw.ContributionStepUpType as string)
    ) {
      throw new Error(
        `Invalid value for 'ContributionStepUpType' in asset at index ${index}: expected one of ${VALID_STEP_UP_TYPES.join(
          ', '
        )}, got ${JSON.stringify(raw.ContributionStepUpType)}.`
      );
    }

    return {
      Id: raw.Id as string,
      Provider: raw.Provider,
      Name: raw.Name,
      AssetType: raw.AssetType as AssetType,
      Balance: raw.Balance as number,
      GrowthRate: raw.GrowthRate as number,
      LinkedLoanId: raw.LinkedLoanId as string | undefined,
      CompoundingPeriod: raw.CompoundingPeriod as
        | CompoundingFrequency
        | undefined,
      StartDate: startDate,
      RecurringContribution: raw.RecurringContribution as number | undefined,
      ContributionFrequency: raw.ContributionFrequency as
        | CompoundingFrequency
        | undefined,
      ContributionStepUpAmount: raw.ContributionStepUpAmount as
        | number
        | undefined,
      ContributionStepUpType: raw.ContributionStepUpType as
        | StepUpType
        | undefined,
      CurrentValue: raw.CurrentValue as number | undefined,
      EmployerMatchRate: raw.EmployerMatchRate as number | undefined,
      EmployerMatchLimitPct: raw.EmployerMatchLimitPct as number | undefined,
      AnnualSalary: raw.AnnualSalary as number | undefined,
    };
  });
};

/**
 * Serialize loans, investments, scenarios, and assets to a JSON string (schema
 * v4, inputs only). Converts Date objects to ISO strings for JSON
 * compatibility; assets carry no dates and serialize one-to-one.
 */
export const exportToJson = (
  loans: Loan[],
  scenarios: Scenario[] = [],
  assets: Asset[] = []
): string => {
  const serializedLoans: SerializedLoan[] = loans.map((loan) => ({
    ...loan,
    StartDate: loan.StartDate.toISOString(),
    EndDate: loan.EndDate.toISOString(),
  }));

  // An asset's optional StartDate (investment only) becomes an ISO string; all
  // other asset fields serialize one-to-one.
  const serializedAssets: SerializedAsset[] = assets.map((asset) => ({
    ...asset,
    StartDate: asset.StartDate ? asset.StartDate.toISOString() : undefined,
  }));

  const exportData: ExportData = {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    loans: serializedLoans,
    scenarios,
    assets: serializedAssets,
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
): {
  loans: Loan[];
  scenarios: Scenario[];
  assets: Asset[];
} => {
  try {
    const raw = JSON.parse(jsonString) as ExportData;

    // Validate the structure. Investments are folded into assets (v5), so only a
    // loans array is required up front; the migration ladder supplies assets and
    // scenarios for older files.
    if (!raw.loans || !Array.isArray(raw.loans)) {
      throw new Error(
        'Invalid data format: Expected an object with a "loans" array.'
      );
    }

    // D8 ladder: gate the version and upgrade older schemas (v2 → v5) before
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

    const scenarios = parseScenarios(data.scenarios);
    const assets = parseAssets(data.assets);

    return { loans, scenarios, assets };
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('Invalid JSON format: unable to parse file', {
        cause: error,
      });
    }
    throw error;
  }
};

/**
 * Partition `imported` into the items that will be ADDED (Id not yet present)
 * vs. those that will OVERWRITE an existing item (Id already present). Mirrors
 * mergeData's Id rules exactly — invalid Ids are skipped, and a duplicate Id
 * within the imported list counts as an overwrite once its first occurrence has
 * been seen — so `added.length`/`overwritten.length` equal mergeData's
 * `added`/`updated` counts. This drives the pre-merge "what changed" preview
 * (6.3) so the user confirms precisely what the subsequent merge will do.
 */
export const previewMerge = <T extends { Id: string }>(
  existing: T[],
  imported: T[]
): MergePreview<T> => {
  const seen = new Set<string>();
  existing.forEach((item) => {
    if (isValidId(item.Id)) {
      seen.add(item.Id);
    }
  });

  const added: T[] = [];
  const overwritten: T[] = [];
  imported.forEach((item) => {
    if (!isValidId(item.Id)) {
      return;
    }
    if (seen.has(item.Id)) {
      overwritten.push(item);
    } else {
      added.push(item);
      // A later import row with this same Id is now an overwrite, matching how
      // mergeData replays the imported list in order.
      seen.add(item.Id);
    }
  });

  return { added, overwritten };
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
