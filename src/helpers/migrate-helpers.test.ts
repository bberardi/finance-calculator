import { describe, it, expect } from 'vitest';
import { CURRENT_SCHEMA_VERSION, RawData, migrate } from './migrate-helpers';
import { EXPORT_SCHEMA_VERSION } from './data-helpers';

describe('migrate (D8 migration ladder)', () => {
  it('exposes the current schema version, matching the export schema', () => {
    expect(CURRENT_SCHEMA_VERSION).toBe(3);
    expect(CURRENT_SCHEMA_VERSION).toBe(EXPORT_SCHEMA_VERSION);
  });

  it('passes data already at the current version through unchanged', () => {
    const data: RawData = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      loans: [],
      investments: [],
      scenarios: [],
    };
    expect(migrate(data)).toBe(data);
  });

  it('migrates v2 to v3 by adding an empty scenarios list', () => {
    const migrated = migrate({ schemaVersion: 2, loans: [], investments: [] });
    expect(migrated.schemaVersion).toBe(3);
    expect(migrated.scenarios).toEqual([]);
  });

  it('preserves a scenarios array already present on a v2 payload', () => {
    const scenarios = [{ Id: 's1', Name: 'A' }];
    const migrated = migrate({ schemaVersion: 2, scenarios });
    expect(migrated.scenarios).toBe(scenarios);
  });

  it('rejects a missing schemaVersion as a legacy v1 file', () => {
    expect(() => migrate({} as unknown as RawData)).toThrow(
      'Legacy (v1) files are not supported'
    );
  });

  it('rejects a non-numeric schemaVersion', () => {
    expect(() => migrate({ schemaVersion: '3' } as unknown as RawData)).toThrow(
      'schemaVersion must be a number'
    );
  });

  it('rejects a version newer than this app understands', () => {
    expect(() =>
      migrate({ schemaVersion: CURRENT_SCHEMA_VERSION + 1 })
    ).toThrow('newer version');
  });

  it('rejects a legacy version with no migration path', () => {
    expect(() => migrate({ schemaVersion: 1 })).toThrow(
      'legacy files are not supported'
    );
  });
});
