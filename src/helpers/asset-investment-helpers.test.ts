import { describe, it, expect } from 'vitest';
import {
  assetToInvestment,
  investmentToAsset,
  isInvestmentAsset,
  investmentsFromAssets,
} from './asset-investment-helpers';
import { Asset, AssetType } from '../models/asset-model';
import {
  CompoundingFrequency,
  Investment,
  StepUpType,
} from '../models/investment-model';

const fullInvestment: Investment = {
  Id: 'inv-1',
  Provider: 'Vanguard',
  Name: 'Brokerage',
  StartDate: new Date(2020, 0, 1),
  StartingBalance: 10000,
  AverageReturnRate: 7,
  CompoundingPeriod: CompoundingFrequency.Monthly,
  RecurringContribution: 500,
  ContributionFrequency: CompoundingFrequency.Monthly,
  ContributionStepUpAmount: 3,
  ContributionStepUpType: StepUpType.Percentage,
  CurrentValue: 13100,
};

describe('investmentToAsset / assetToInvestment', () => {
  it('maps an investment to an investment-type asset', () => {
    const asset = investmentToAsset(fullInvestment);
    expect(asset).toEqual({
      Id: 'inv-1',
      Provider: 'Vanguard',
      Name: 'Brokerage',
      AssetType: AssetType.Investment,
      Balance: 10000,
      GrowthRate: 7,
      CompoundingPeriod: CompoundingFrequency.Monthly,
      StartDate: new Date(2020, 0, 1),
      RecurringContribution: 500,
      ContributionFrequency: CompoundingFrequency.Monthly,
      ContributionStepUpAmount: 3,
      ContributionStepUpType: StepUpType.Percentage,
      CurrentValue: 13100,
    });
  });

  it('round-trips an investment losslessly (investment → asset → investment)', () => {
    expect(assetToInvestment(investmentToAsset(fullInvestment))).toEqual(
      fullInvestment
    );
  });

  it('round-trips a minimal investment (no contributions / CurrentValue)', () => {
    const minimal: Investment = {
      Id: 'inv-2',
      Provider: 'Fidelity',
      Name: '401k',
      StartDate: new Date(2019, 5, 15),
      StartingBalance: 5000,
      AverageReturnRate: 6,
      CompoundingPeriod: CompoundingFrequency.Annually,
    };
    expect(assetToInvestment(investmentToAsset(minimal))).toEqual(minimal);
  });

  it('defaults StartDate and CompoundingPeriod when an investment asset omits them', () => {
    const asset: Asset = {
      Id: 'a1',
      Provider: 'Broker',
      Name: 'Acct',
      AssetType: AssetType.Investment,
      Balance: 2000,
      GrowthRate: 5,
    };
    const investment = assetToInvestment(asset);
    expect(investment.StartDate).toEqual(new Date(0));
    expect(investment.CompoundingPeriod).toBe(CompoundingFrequency.Annually);
    expect(investment.StartingBalance).toBe(2000);
    expect(investment.AverageReturnRate).toBe(5);
    expect(investment.CurrentValue).toBeUndefined();
  });

  it('identifies investment-type assets', () => {
    expect(isInvestmentAsset(investmentToAsset(fullInvestment))).toBe(true);
    expect(
      isInvestmentAsset({
        Id: 'c1',
        Provider: 'Chase',
        Name: 'Checking',
        AssetType: AssetType.Cash,
        Balance: 100,
        GrowthRate: 0,
      })
    ).toBe(false);
  });

  it('derives investments from a mixed asset list, dropping non-investments', () => {
    const cash: Asset = {
      Id: 'c1',
      Provider: 'Chase',
      Name: 'Checking',
      AssetType: AssetType.Cash,
      Balance: 100,
      GrowthRate: 0,
    };
    const investmentAsset = investmentToAsset(fullInvestment);
    const result = investmentsFromAssets([cash, investmentAsset]);
    // Only the investment-type asset survives, converted back to an Investment.
    expect(result).toEqual([fullInvestment]);
  });

  it('returns an empty list when no asset is an investment', () => {
    expect(
      investmentsFromAssets([
        {
          Id: 'p1',
          Provider: 'County',
          Name: 'Home',
          AssetType: AssetType.Property,
          Balance: 400000,
          GrowthRate: 3,
        },
      ])
    ).toEqual([]);
  });
});
