import { describe, it, expect } from 'vitest';
import { CURRENT_SCHEMA_VERSION, RawData, migrate } from './migrate-helpers';
import { EXPORT_SCHEMA_VERSION } from './data-helpers';

describe('migrate (D8 migration ladder)', () => {
  it('exposes the current schema version, matching the export schema', () => {
    expect(CURRENT_SCHEMA_VERSION).toBe(5);
    expect(CURRENT_SCHEMA_VERSION).toBe(EXPORT_SCHEMA_VERSION);
  });

  it('passes data already at the current version through unchanged', () => {
    const data: RawData = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      loans: [],
      scenarios: [],
      assets: [],
    };
    expect(migrate(data)).toBe(data);
  });

  it('migrates v2 to v3 by adding an empty scenarios list', () => {
    const migrated = migrate({ schemaVersion: 2, loans: [], investments: [] });
    // The ladder runs every step in turn, so a v2 payload climbs to the current
    // version (gaining scenarios at v3, assets at v4, and folding investments
    // into assets at v5 along the way).
    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(migrated.scenarios).toEqual([]);
  });

  it('preserves a scenarios array already present on a v2 payload', () => {
    const scenarios = [{ Id: 's1', Name: 'A' }];
    const migrated = migrate({ schemaVersion: 2, scenarios });
    expect(migrated.scenarios).toBe(scenarios);
  });

  it('climbs a v3 payload to the current version, adding an empty assets list', () => {
    const migrated = migrate({
      schemaVersion: 3,
      loans: [],
      investments: [],
      scenarios: [],
    });
    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(migrated.assets).toEqual([]);
  });

  it('preserves the contents of an assets array already present on a v3 payload', () => {
    const assets = [{ Id: 'a1', Name: 'Cash' }];
    const migrated = migrate({ schemaVersion: 3, assets });
    // The v4 → v5 fold rebuilds the assets array (appending folded investments),
    // so the contents are preserved by value rather than by reference.
    expect(migrated.assets).toEqual(assets);
  });

  it('migrates v4 to v5 by folding investments into assets as AssetType.Investment', () => {
    const migrated = migrate({
      schemaVersion: 4,
      loans: [],
      scenarios: [],
      assets: [{ Id: 'a1', Name: 'Cash', AssetType: 'cash' }],
      investments: [
        {
          Id: 'inv1',
          Provider: 'Brokerage',
          Name: 'Index Fund',
          StartingBalance: 10000,
          AverageReturnRate: 7,
          CompoundingPeriod: 'monthly',
          StartDate: '2024-01-01T00:00:00.000Z',
          RecurringContribution: 500,
          ContributionFrequency: 'monthly',
          ContributionStepUpAmount: 100,
          ContributionStepUpType: 'fixed',
          CurrentValue: 12000,
        },
      ],
    });
    expect(migrated.schemaVersion).toBe(5);
    // The standalone investments array is gone after the fold.
    expect(migrated.investments).toBeUndefined();
    const assets = migrated.assets as Record<string, unknown>[];
    // Existing assets are kept; folded investments are appended after them.
    expect(assets).toHaveLength(2);
    expect(assets[0].Id).toBe('a1');
    // StartingBalance → Balance, AverageReturnRate → GrowthRate; the rest by name.
    expect(assets[1]).toMatchObject({
      Id: 'inv1',
      AssetType: 'investment',
      Balance: 10000,
      GrowthRate: 7,
      CompoundingPeriod: 'monthly',
      StartDate: '2024-01-01T00:00:00.000Z',
      RecurringContribution: 500,
      ContributionFrequency: 'monthly',
      ContributionStepUpAmount: 100,
      ContributionStepUpType: 'fixed',
      CurrentValue: 12000,
    });
  });

  it('tolerates a v4 payload with no assets key and folds malformed investment entries defensively', () => {
    const migrated = migrate({
      schemaVersion: 4,
      loans: [],
      scenarios: [],
      // No `assets` key at all, and a null entry among the investments.
      investments: [
        null,
        { Id: 'inv2', StartingBalance: 5000, AverageReturnRate: 3 },
      ],
    });
    const assets = migrated.assets as Record<string, unknown>[];
    expect(assets).toHaveLength(2);
    // A null investment still folds into an investment-type asset (empty fields).
    expect(assets[0].AssetType).toBe('investment');
    expect(assets[0].Id).toBeUndefined();
    expect(assets[1].Id).toBe('inv2');
    expect(assets[1].Balance).toBe(5000);
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

  it('rejects a non-finite schemaVersion instead of skipping the ladder (#132)', () => {
    // `NaN`/`Infinity` are `typeof 'number'`, and both `NaN > N` and `NaN < N`
    // evaluate to false — so without an integer check a non-finite version would
    // pass every gate and be returned unmodified as if already current, bypassing
    // the ladder at the untrusted-data boundary it guards.
    expect(() => migrate({ schemaVersion: NaN })).toThrow(
      'schemaVersion must be a number'
    );
    expect(() => migrate({ schemaVersion: Infinity })).toThrow(
      'schemaVersion must be a number'
    );
  });

  it('rejects a fractional schemaVersion (#132)', () => {
    expect(() => migrate({ schemaVersion: 2.5 })).toThrow(
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
