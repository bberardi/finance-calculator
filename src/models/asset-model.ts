import { CompoundingFrequency, StepUpType } from './investment-model';

// Phase 7 (Whole Net Worth) + the investment fold. A holding whose value grows
// or declines over time — the catch-all that lets the net-worth line hold
// *everything* a person owns:
//
//   - Cash (7.1): HYSA / CD / checking — a balance plus an APY.
//   - Property (7.2): a home value appreciating at a rate, optionally linked to
//     its mortgage (a Loan) so net worth reflects home *equity*.
//   - Investment: a brokerage / retirement holding — a balance growing at a
//     return rate, optionally with recurring contributions and yearly step-ups
//     (the former standalone Investment, now folded in as an AssetType). Its
//     value series follows the investment math rather than simple growth.
//   - Custom asset / liability (7.3): an escape hatch for anything else (a car
//     that depreciates, a private loan, collectibles) with a simple growth or
//     decline rate.
//
// One model with an AssetType discriminator covers them all. Cash / property /
// custom use the simple compound-growth curve (asset-helpers); an investment is
// converted to an Investment (asset-investment-helpers) and run through the
// investment engine. Input-only (D3/D7): the forecast value series is computed
// on demand, never stored or serialized.

export enum AssetType {
  Cash = 'cash',
  Property = 'property',
  Investment = 'investment',
  CustomAsset = 'custom-asset',
  CustomLiability = 'custom-liability',
}

// Holdings & property context (ROADMAP 9.4). A user-curated reference the app
// stores but never fetches: company/fund research for an investment, or
// local-market and area links for a property. The URL is untrusted input — it is
// kept safe (http/https only) by research-helpers before it is ever rendered as
// a clickable anchor.
export interface ResearchLink {
  // Short human label, e.g. "Morningstar", "Zillow area report", "Q3 earnings".
  Label: string;
  // Destination; always an http(s) URL once validated on entry and on import.
  Url: string;
  // Optional freeform note, e.g. "watch the expense ratio", "comps look soft".
  Note?: string;
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
  // the APY; for property the appreciation rate; for an investment the average
  // return rate; for custom the growth/decline.
  GrowthRate: number;
  // 7.2 entity linking: the Loan Id of the mortgage paired to a property, so the
  // app can derive home equity (property value − loan balance). Optional and
  // only meaningful for AssetType.Property.
  LinkedLoanId?: string;
  // Compounding cadence for the growth rate; defaults to monthly when unset.
  CompoundingPeriod?: CompoundingFrequency;
  // Investment-only fields (folded from the former standalone Investment). Only
  // meaningful when AssetType is Investment; an investment's value series then
  // follows the investment math (recurring contributions + yearly step-ups)
  // instead of simple compound growth. For an investment, `Balance` is the
  // starting balance and `CurrentValue` (when set) is today's anchor — exactly
  // the old Investment's fields, so a fold round-trips losslessly.
  StartDate?: Date;
  RecurringContribution?: number;
  ContributionFrequency?: CompoundingFrequency;
  ContributionStepUpAmount?: number;
  ContributionStepUpType?: StepUpType;
  CurrentValue?: number;
  // Employer 401(k) match (ROADMAP 8.1); investment-only, mirrors Investment. The
  // employer adds EmployerMatchRate% of your contributions, up to
  // EmployerMatchLimitPct% of AnnualSalary per year.
  EmployerMatchRate?: number;
  EmployerMatchLimitPct?: number;
  AnnualSalary?: number;
  // Holdings & property context (ROADMAP 9.4): user-curated research/reference
  // links attached to this holding. On-device only, never fetched. Absent = none.
  ResearchLinks?: ResearchLink[];
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
