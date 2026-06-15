import { EXPORT_SCHEMA_VERSION } from './data-helpers';

// D8 — the single, versioned schema-migration ladder.
//
// Every persisted-data entry point runs raw parsed data through `migrate` so
// older stored schemas upgrade forward deterministically *before* validation.
// Today that entry point is localStorage hydration (D4 / Phase 1); JSON import
// (D5) keeps its own inline version gate for now and unifies here at the first
// real schema bump (scenarios, 4.5), where stored data first has to survive a
// version change.
//
// The ladder currently has a single rung: the only supported version is the
// current one. Each future `schemaVersion` bump adds exactly one step that
// upgrades data from the previous version to the next — individually tested to
// the Charter (§4) standard — at which point this gate becomes a stepwise
// upgrade loop. Until then, any version below the current one is unsupported,
// mirroring `importFromJson`'s rejection of legacy v1 files.

export const CURRENT_SCHEMA_VERSION = EXPORT_SCHEMA_VERSION;

/** Minimal shape every persisted/serialized payload shares: a numeric version. */
export interface VersionedData {
  schemaVersion: number;
}

/**
 * Bring a parsed payload up to {@link CURRENT_SCHEMA_VERSION}, or throw a
 * descriptive error if it cannot be migrated (missing/non-numeric version, a
 * version newer than this app understands, or a legacy version with no
 * migration path). Callers that hydrate untrusted storage should treat a throw
 * as "discard and start clean" rather than letting it propagate.
 */
export const migrate = <T extends VersionedData>(data: T): T => {
  const { schemaVersion } = data;

  if (typeof schemaVersion !== 'number') {
    throw new Error('Invalid data format: schemaVersion must be a number.');
  }
  if (schemaVersion > CURRENT_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported schema version ${schemaVersion}: this data was written by a newer version of the app.`
    );
  }
  if (schemaVersion < CURRENT_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported schema version ${schemaVersion}: no migration path is available (legacy data is not supported).`
    );
  }

  return data;
};
