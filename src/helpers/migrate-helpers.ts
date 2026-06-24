// D8 — the single, versioned schema-migration ladder.
//
// Every persisted-data entry point — JSON import (D5) and localStorage
// hydration (D4) — runs raw parsed data through `migrate` so older stored
// schemas upgrade forward deterministically before validation. As of Phase 4.5
// the ladder has its first real rung (v2 → v3, adding `scenarios`); each future
// `schemaVersion` bump adds exactly one more step, individually tested to the
// Charter (§4) standard.

// The current schema version. data-helpers re-exports this as
// EXPORT_SCHEMA_VERSION; kept here so the ladder owns the "current" definition.
export const CURRENT_SCHEMA_VERSION = 5;

// A parsed payload: a numeric schemaVersion plus arbitrary other fields the
// individual migration steps and the downstream validator interpret.
export type RawData = { schemaVersion: number } & Record<string, unknown>;

// A migration step upgrades data from one version to the next.
type MigrationStep = (data: RawData) => RawData;

// Convert a serialized Investment into its serialized AssetType.Investment
// shape (the field correspondence mirrors investmentToAsset): StartingBalance →
// Balance, AverageReturnRate → GrowthRate, everything else by the same name.
const investmentToSerializedAsset = (
  investment: unknown
): Record<string, unknown> => {
  const i = (investment ?? {}) as Record<string, unknown>;
  return {
    Id: i.Id,
    Provider: i.Provider,
    Name: i.Name,
    AssetType: 'investment',
    Balance: i.StartingBalance,
    GrowthRate: i.AverageReturnRate,
    CompoundingPeriod: i.CompoundingPeriod,
    StartDate: i.StartDate,
    RecurringContribution: i.RecurringContribution,
    ContributionFrequency: i.ContributionFrequency,
    ContributionStepUpAmount: i.ContributionStepUpAmount,
    ContributionStepUpType: i.ContributionStepUpType,
    CurrentValue: i.CurrentValue,
  };
};

// Keyed by the version each step upgrades FROM. v2 → v3 introduces the
// `scenarios` array (Phase 4.5); a v2 file simply gains an empty list. v3 → v4
// introduces the `assets` array (Phase 7, Whole Net Worth); a v3 file simply
// gains an empty list. v4 → v5 folds the standalone `investments` array into
// `assets` as `AssetType.Investment` entries (the investment fold); the
// `investments` key is dropped.
const MIGRATIONS: Record<number, MigrationStep> = {
  2: (data) => ({
    ...data,
    schemaVersion: 3,
    scenarios: Array.isArray(data.scenarios) ? data.scenarios : [],
  }),
  3: (data) => ({
    ...data,
    schemaVersion: 4,
    assets: Array.isArray(data.assets) ? data.assets : [],
  }),
  4: (data) => {
    const investments = Array.isArray(data.investments) ? data.investments : [];
    const assets = Array.isArray(data.assets) ? data.assets : [];
    const rest = { ...data };
    delete rest.investments;
    return {
      ...rest,
      schemaVersion: 5,
      assets: [...assets, ...investments.map(investmentToSerializedAsset)],
    };
  },
};

/**
 * Bring a parsed payload up to {@link CURRENT_SCHEMA_VERSION}, applying each
 * migration step in turn, or throw a descriptive error if it cannot be
 * migrated. Callers hydrating untrusted storage should treat a throw as
 * "discard and start clean". Error messages are intentionally stable — the
 * import boundary relies on them.
 */
export const migrate = (data: RawData): RawData => {
  const version: unknown = data.schemaVersion;

  if (version === undefined) {
    throw new Error(
      'Invalid data format: missing schemaVersion. Legacy (v1) files are not supported.'
    );
  }
  if (typeof version !== 'number') {
    throw new Error('Invalid data format: schemaVersion must be a number.');
  }
  if (version > CURRENT_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported schema version ${version}: this data was written by a newer version of the app.`
    );
  }

  let current = data;
  while (current.schemaVersion < CURRENT_SCHEMA_VERSION) {
    const step = MIGRATIONS[current.schemaVersion];
    if (!step) {
      throw new Error(
        `Unsupported schema version ${current.schemaVersion}: legacy files are not supported.`
      );
    }
    current = step(current);
  }

  return current;
};
