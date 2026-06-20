import { CompoundingFrequency } from './investment-model';

// Phase 7 (Whole Net Worth). A single, simple holding whose value grows or
// declines at a fixed annual rate — the catch-all that finally lets the
// net-worth line hold *everything* a person owns:
//
//   - Cash (7.1): HYSA / CD / checking — a balance plus an APY.
//   - Property (7.2): a home value appreciating at a rate, optionally linked to
//     its mortgage (a Loan) so net worth reflects home *equity*.
//   - Custom asset / liability (7.3): an escape hatch for anything else (a car
//     that depreciates, a private loan, collectibles) with a simple growth or
//     decline rate.
//
// One model with an AssetType discriminator covers all three; the math is the
// same simple compound-growth curve in every case (asset-helpers). Input-only
// (D3/D7): the forecast value series is computed on demand, never stored or
// serialized.

export enum AssetType {
  Cash = 'cash',
  Property = 'property',
  CustomAsset = 'custom-asset',
  CustomLiability = 'custom-liability',
}

export interface Asset {
  Id: string;
  Provider: string;
  Name: string;
  AssetType: AssetType;
  // Today's value, always a positive balance (a liability's debt is positive
  // too). Forecasts anchor here, exactly as loans anchor on CurrentAmount and
  // investments on CurrentValue.
  Balance: number;
  // Annual percentage. May be negative (a depreciating asset). For cash this is
  // the APY; for property the appreciation rate; for custom the growth/decline.
  GrowthRate: number;
  // 7.2 entity linking: the Loan Id of the mortgage paired to a property, so the
  // app can derive home equity (property value − loan balance). Optional and
  // only meaningful for AssetType.Property.
  LinkedLoanId?: string;
  // Compounding cadence for the growth rate; defaults to monthly when unset.
  CompoundingPeriod?: CompoundingFrequency;
}

export const emptyAsset: Asset = {
  Id: '',
  Provider: '',
  Name: '',
  AssetType: AssetType.Cash,
  Balance: 0,
  GrowthRate: 0,
  CompoundingPeriod: CompoundingFrequency.Monthly,
};
