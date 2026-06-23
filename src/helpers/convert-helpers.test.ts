import { describe, it, expect } from 'vitest';
import {
  CONVERTED_LOAN_TERM_YEARS,
  buildLoanSeedFromAsset,
} from './convert-helpers';
import { Asset, AssetType } from '../models/asset-model';
import { CompoundingFrequency } from '../models/investment-model';

const liability: Asset = {
  Id: 'monarch:mortgage',
  Provider: 'Monarch',
  Name: 'Mortgage',
  AssetType: AssetType.CustomLiability,
  Balance: 300000,
  GrowthRate: 0,
  CompoundingPeriod: CompoundingFrequency.Monthly,
};

describe('buildLoanSeedFromAsset', () => {
  it('seeds a loan from an asset, balance → principal & current amount', () => {
    const today = new Date(2024, 0, 1);
    const loan = buildLoanSeedFromAsset(liability, today);
    expect(loan).toEqual({
      Id: '',
      Provider: 'Monarch',
      Name: 'Mortgage',
      Principal: 300000,
      CurrentAmount: 300000,
      InterestRate: 0,
      StartDate: today,
      EndDate: new Date(2054, 0, 1),
      MonthlyPayment: 0,
    });
  });

  it('defaults the start date to today when omitted', () => {
    const loan = buildLoanSeedFromAsset(liability);
    expect(loan.EndDate.getFullYear() - loan.StartDate.getFullYear()).toBe(
      CONVERTED_LOAN_TERM_YEARS
    );
  });
});
