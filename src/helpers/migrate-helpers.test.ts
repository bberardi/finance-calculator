import { describe, it, expect } from 'vitest';
import { CURRENT_SCHEMA_VERSION, RawData, migrate } from './migrate-helpers';
import { EXPORT_SCHEMA_VERSION } from './data-helpers';

describe('migrate (D8 migration ladder)', () => {
  it('exposes the current schema version, matching the export schema', () => {
    expect(CURRENT_SCHEMA_VERSION).toBe(4);
    expect(CURRENT_SCHEMA_VERSION).toBe(EXPORT_SCHEMA_VERSION);
  });

  it('passes data already at the current version through unchanged', () => {
    const data: RawData = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      loans: [],
      investments: [],
      scenarios: [],
      assets: [],
    };
    expect(migrate(data)).toBe(data);
  });

  it('migrates v2 to v3 by adding an empty scenarios list', () => {
    const migrated = migrate({ schemaVersion: 2, loans: [], investments: [] });
    // The ladder runs every step in turn, so a v2 payload climbs to the current
    // version (gaining scenarios at v3 and assets at v4 along the way).
    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(migrated.scenarios).toEqual([]);
  });

  it('preserves a scenarios array already present on a v2 payload', () => {
    const scenarios = [{ Id: 's1', Name: 'A' }];
    const migrated = migrate({ schemaVersion: 2, scenarios });
    expect(migrated.scenarios).toBe(scenarios);
  });

  it('migrates v3 to v4 by adding an empty assets list', () => {
    const migrated = migrate({
      schemaVersion: 3,
      loans: [],
      investments: [],
      scenarios: [],
    });
    expect(migrated.schemaVersion).toBe(4);
    expect(migrated.assets).toEqual([]);
  });

  it('preserves an assets array already present on a v3 payload', () => {
    const assets = [{ Id: 'a1', Name: 'Cash' }];
    const migrated = migrate({ schemaVersion: 3, assets });
    expect(migrated.assets).toBe(assets);
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
