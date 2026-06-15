import { describe, it, expect } from 'vitest';
import {
  CURRENT_SCHEMA_VERSION,
  migrate,
  VersionedData,
} from './migrate-helpers';
import { EXPORT_SCHEMA_VERSION } from './data-helpers';

describe('migrate (D8 migration ladder)', () => {
  it('exposes the current schema version, anchored to the export schema', () => {
    // The ladder and the export serializer must agree on what "current" means,
    // otherwise freshly-saved data could fail its own migration.
    expect(CURRENT_SCHEMA_VERSION).toBe(EXPORT_SCHEMA_VERSION);
  });

  it('passes data already at the current version through unchanged', () => {
    const data = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      loans: [],
      investments: [],
    };
    // Same reference back out — the single current rung is an identity step.
    expect(migrate(data)).toBe(data);
  });

  it('throws when schemaVersion is missing or non-numeric', () => {
    expect(() => migrate({} as unknown as VersionedData)).toThrow(
      'schemaVersion must be a number'
    );
    expect(() =>
      migrate({ schemaVersion: '2' } as unknown as VersionedData)
    ).toThrow('schemaVersion must be a number');
  });

  it('throws for a version newer than this app understands', () => {
    expect(() =>
      migrate({ schemaVersion: CURRENT_SCHEMA_VERSION + 1 })
    ).toThrow('written by a newer version');
  });

  it('throws for a legacy version with no migration path', () => {
    expect(() =>
      migrate({ schemaVersion: CURRENT_SCHEMA_VERSION - 1 })
    ).toThrow('no migration path is available');
  });
});
