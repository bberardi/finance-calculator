import { describe, it, expect } from 'vitest';
import { Asset, AssetType } from '../models/asset-model';
import { CompoundingFrequency, StepUpType } from '../models/investment-model';
import {
  ASSET_GROWTH_WARNING_THRESHOLD,
  isAssetValid,
  validateAsset,
} from './validation-helpers';
import { exportToJson, importFromJson } from './data-helpers';

// Charter coverage for the Phase 7 input boundary: the form validator
// (validateAsset) and the JSON import/export validator (parseAssets, reached
// through importFromJson). The two must agree — a value the form saves must
// round-trip through export/import, and vice versa.

const validAsset = (overrides: Partial<Asset> = {}): Asset => ({
  Id: 'a1',
  Provider: 'Sample Bank',
  Name: 'HYSA',
  AssetType: AssetType.Cash,
  Balance: 10000,
  GrowthRate: 4.25,
  CompoundingPeriod: CompoundingFrequency.Monthly,
  ...overrides,
});

describe('validateAsset', () => {
  it('accepts a well-formed asset', () => {
    const result = validateAsset(validAsset());
    expect(result.errors).toEqual({});
    expect(isAssetValid(validAsset())).toBe(true);
  });

  it('accepts a negative growth rate (a depreciating asset)', () => {
    const result = validateAsset(
      validAsset({ AssetType: AssetType.CustomAsset, GrowthRate: -10 })
    );
    expect(result.errors).toEqual({});
  });

  it('requires a name', () => {
    expect(validateAsset(validAsset({ Name: '   ' })).errors.Name).toBeTruthy();
  });

  it('requires a provider', () => {
    expect(
      validateAsset(validAsset({ Provider: '' })).errors.Provider
    ).toBeTruthy();
  });

  it('rejects a negative balance', () => {
    expect(
      validateAsset(validAsset({ Balance: -1 })).errors.Balance
    ).toBeTruthy();
  });

  it('rejects a non-finite growth rate', () => {
    expect(
      validateAsset(validAsset({ GrowthRate: Number.NaN })).errors.GrowthRate
    ).toBeTruthy();
    // A NaN rate is not finite, so no growth warning is added alongside the error.
    expect(
      validateAsset(validAsset({ GrowthRate: Number.NaN })).warnings.GrowthRate
    ).toBeUndefined();
  });

  it('warns on an unusually large growth rate in either direction', () => {
    expect(
      validateAsset(
        validAsset({ GrowthRate: ASSET_GROWTH_WARNING_THRESHOLD + 5 })
      ).warnings.GrowthRate
    ).toBeTruthy();
    expect(
      validateAsset(
        validAsset({
          AssetType: AssetType.CustomAsset,
          GrowthRate: -(ASSET_GROWTH_WARNING_THRESHOLD + 5),
        })
      ).warnings.GrowthRate
    ).toBeTruthy();
  });

  it('does not warn on an in-range growth rate', () => {
    expect(
      validateAsset(validAsset({ GrowthRate: 5 })).warnings.GrowthRate
    ).toBeUndefined();
  });

  it('isAssetValid is false when any error is present', () => {
    expect(isAssetValid(validAsset({ Balance: -1 }))).toBe(false);
  });
});

// Build a current-schema export payload string with the given raw assets array.
// Using the current version means no migration runs, so the raw assets reach
// parseAssets unchanged (the v4 → v5 migration would coerce a non-array assets
// field to [], masking the "must be an array" guard this exercises).
const makeJson = (assets: unknown): string =>
  JSON.stringify({
    schemaVersion: 5,
    loans: [],
    scenarios: [],
    assets,
  });

describe('importFromJson — assets (parseAssets)', () => {
  it('round-trips a valid asset through export and import', () => {
    const asset = validAsset({
      AssetType: AssetType.Property,
      Balance: 400000,
      GrowthRate: 3,
      LinkedLoanId: 'loan-1',
    });
    const json = exportToJson([], [], [asset]);
    expect(JSON.parse(json).schemaVersion).toBe(5);
    const { assets } = importFromJson(json);
    expect(assets).toEqual([asset]);
  });

  it('treats a missing assets array as no assets', () => {
    const json = JSON.stringify({
      schemaVersion: 4,
      loans: [],
      investments: [],
    });
    expect(importFromJson(json).assets).toEqual([]);
  });

  it('imports an asset with no optional fields, dropping unknown keys', () => {
    const json = makeJson([
      {
        Id: 'a1',
        Provider: 'Bank',
        Name: 'Checking',
        AssetType: AssetType.Cash,
        Balance: 1000,
        GrowthRate: 0,
        bogus: 'dropped',
      },
    ]);
    const { assets } = importFromJson(json);
    expect(assets).toHaveLength(1);
    expect(assets[0].LinkedLoanId).toBeUndefined();
    expect(assets[0].CompoundingPeriod).toBeUndefined();
    expect(assets[0]).not.toHaveProperty('bogus');
  });

  it('rejects an assets value that is not an array', () => {
    expect(() => importFromJson(makeJson('nope'))).toThrow(
      'assets must be an array'
    );
  });

  it('rejects a non-object asset entry', () => {
    expect(() => importFromJson(makeJson([42]))).toThrow('expected an object');
  });

  it('rejects an asset with a missing/invalid Id', () => {
    expect(() => importFromJson(makeJson([{ Id: '  ' }]))).toThrow(
      'Invalid or missing ID in asset'
    );
  });

  it('rejects an asset with an empty provider', () => {
    expect(() =>
      importFromJson(makeJson([{ Id: 'a1', Provider: '' }]))
    ).toThrow("Required field 'Provider' cannot be empty");
  });

  it('rejects an asset with an empty name', () => {
    expect(() =>
      importFromJson(makeJson([{ Id: 'a1', Provider: 'Bank', Name: '' }]))
    ).toThrow("Required field 'Name' cannot be empty");
  });

  it('rejects an invalid AssetType', () => {
    expect(() =>
      importFromJson(
        makeJson([
          { Id: 'a1', Provider: 'Bank', Name: 'X', AssetType: 'gold-bars' },
        ])
      )
    ).toThrow("Invalid value for 'AssetType'");
  });

  it('rejects a non-numeric balance', () => {
    expect(() =>
      importFromJson(
        makeJson([
          {
            Id: 'a1',
            Provider: 'Bank',
            Name: 'X',
            AssetType: AssetType.Cash,
            Balance: 'lots',
            GrowthRate: 0,
          },
        ])
      )
    ).toThrow("Invalid value for 'Balance'");
  });

  it('rejects a negative balance', () => {
    expect(() =>
      importFromJson(
        makeJson([
          {
            Id: 'a1',
            Provider: 'Bank',
            Name: 'X',
            AssetType: AssetType.Cash,
            Balance: -5,
            GrowthRate: 0,
          },
        ])
      )
    ).toThrow("Invalid value for 'Balance'");
  });

  it('rejects a non-finite growth rate', () => {
    expect(() =>
      importFromJson(
        makeJson([
          {
            Id: 'a1',
            Provider: 'Bank',
            Name: 'X',
            AssetType: AssetType.Cash,
            Balance: 100,
            GrowthRate: 'fast',
          },
        ])
      )
    ).toThrow("Invalid value for 'GrowthRate'");
  });

  it('accepts a valid CompoundingPeriod and rejects an invalid one', () => {
    const base = {
      Id: 'a1',
      Provider: 'Bank',
      Name: 'X',
      AssetType: AssetType.Cash,
      Balance: 100,
      GrowthRate: 1,
    };
    expect(
      importFromJson(
        makeJson([
          { ...base, CompoundingPeriod: CompoundingFrequency.Quarterly },
        ])
      ).assets[0].CompoundingPeriod
    ).toBe(CompoundingFrequency.Quarterly);
    expect(() =>
      importFromJson(makeJson([{ ...base, CompoundingPeriod: 'hourly' }]))
    ).toThrow("Invalid value for 'CompoundingPeriod'");
  });

  it('accepts a valid LinkedLoanId and rejects a blank one', () => {
    const base = {
      Id: 'a1',
      Provider: 'Bank',
      Name: 'Home',
      AssetType: AssetType.Property,
      Balance: 100,
      GrowthRate: 1,
    };
    expect(
      importFromJson(makeJson([{ ...base, LinkedLoanId: 'loan-9' }])).assets[0]
        .LinkedLoanId
    ).toBe('loan-9');
    expect(() =>
      importFromJson(makeJson([{ ...base, LinkedLoanId: '   ' }]))
    ).toThrow("Invalid value for 'LinkedLoanId'");
  });
});

// Investment-type assets (the fold): the import boundary must validate and
// round-trip the investment-only fields (StartDate, recurring contributions,
// step-ups, current value) that ride along on an AssetType.Investment.
describe('importFromJson — investment-type assets (parseAssets)', () => {
  const investmentAsset = (overrides: Partial<Asset> = {}): Asset =>
    validAsset({
      Id: 'inv1',
      Provider: 'Brokerage',
      Name: 'Index Fund',
      AssetType: AssetType.Investment,
      Balance: 10000,
      GrowthRate: 7,
      CompoundingPeriod: CompoundingFrequency.Monthly,
      StartDate: new Date('2024-01-01T00:00:00.000Z'),
      RecurringContribution: 500,
      ContributionFrequency: CompoundingFrequency.Monthly,
      ContributionStepUpAmount: 100,
      ContributionStepUpType: StepUpType.Flat,
      CurrentValue: 12000,
      ...overrides,
    });

  // A raw (serialized) investment-type asset whose StartDate is an ISO string,
  // for the field-level rejection cases below.
  const rawInvestment = (overrides: Record<string, unknown> = {}) => ({
    Id: 'inv1',
    Provider: 'Brokerage',
    Name: 'Index Fund',
    AssetType: AssetType.Investment,
    Balance: 10000,
    GrowthRate: 7,
    CompoundingPeriod: CompoundingFrequency.Monthly,
    StartDate: '2024-01-01T00:00:00.000Z',
    RecurringContribution: 500,
    ContributionFrequency: CompoundingFrequency.Monthly,
    ContributionStepUpAmount: 100,
    ContributionStepUpType: StepUpType.Flat,
    CurrentValue: 12000,
    ...overrides,
  });

  it('round-trips a fully-populated investment asset through export and import', () => {
    const investment = investmentAsset();
    const json = exportToJson([], [], [investment]);
    expect(JSON.parse(json).schemaVersion).toBe(5);
    const { assets } = importFromJson(json);
    expect(assets).toEqual([investment]);
    // The StartDate survives as a real Date, not an ISO string.
    expect(assets[0].StartDate).toBeInstanceOf(Date);
  });

  it('imports an investment asset with only its required fields, leaving the optional contribution fields undefined', () => {
    // StartDate is the one investment essential the import requires; the
    // recurring-contribution / step-up / current-value fields are all optional.
    const json = makeJson([
      {
        Id: 'inv1',
        Provider: 'Brokerage',
        Name: 'Index Fund',
        AssetType: AssetType.Investment,
        Balance: 10000,
        GrowthRate: 7,
        StartDate: '2024-01-01T00:00:00.000Z',
      },
    ]);
    const { assets } = importFromJson(json);
    expect(assets[0].StartDate).toBeInstanceOf(Date);
    expect(assets[0].RecurringContribution).toBeUndefined();
    expect(assets[0].ContributionFrequency).toBeUndefined();
    expect(assets[0].ContributionStepUpType).toBeUndefined();
    expect(assets[0].CurrentValue).toBeUndefined();
  });

  it('rejects an investment-type asset with no StartDate', () => {
    // The standalone Investment import required a StartDate; folding into assets
    // must keep that guarantee so a forecast never anchors to the epoch.
    expect(() =>
      importFromJson(
        makeJson([
          {
            Id: 'inv1',
            Provider: 'Brokerage',
            Name: 'Index Fund',
            AssetType: AssetType.Investment,
            Balance: 10000,
            GrowthRate: 7,
          },
        ])
      )
    ).toThrow("Missing required field 'StartDate' for investment asset");
  });

  it('rejects a malformed StartDate string', () => {
    expect(() =>
      importFromJson(makeJson([rawInvestment({ StartDate: 'not-a-date' })]))
    ).toThrow("Invalid date for 'StartDate'");
  });

  it('rejects a non-string StartDate', () => {
    expect(() =>
      importFromJson(makeJson([rawInvestment({ StartDate: 1700000000000 })]))
    ).toThrow("Invalid value for 'StartDate'");
  });

  it('rejects a negative RecurringContribution', () => {
    expect(() =>
      importFromJson(makeJson([rawInvestment({ RecurringContribution: -1 })]))
    ).toThrow("Invalid value for 'RecurringContribution'");
  });

  it('rejects a non-numeric ContributionStepUpAmount', () => {
    expect(() =>
      importFromJson(
        makeJson([rawInvestment({ ContributionStepUpAmount: 'lots' })])
      )
    ).toThrow("Invalid value for 'ContributionStepUpAmount'");
  });

  it('rejects a negative CurrentValue', () => {
    expect(() =>
      importFromJson(makeJson([rawInvestment({ CurrentValue: -5 })]))
    ).toThrow("Invalid value for 'CurrentValue'");
  });

  it('rejects an invalid ContributionFrequency', () => {
    expect(() =>
      importFromJson(
        makeJson([rawInvestment({ ContributionFrequency: 'hourly' })])
      )
    ).toThrow("Invalid value for 'ContributionFrequency'");
  });

  it('rejects an invalid ContributionStepUpType', () => {
    expect(() =>
      importFromJson(
        makeJson([rawInvestment({ ContributionStepUpType: 'exponential' })])
      )
    ).toThrow("Invalid value for 'ContributionStepUpType'");
  });
});
