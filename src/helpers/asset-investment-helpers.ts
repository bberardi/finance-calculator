import { Asset, AssetType } from '../models/asset-model';
import { CompoundingFrequency, Investment } from '../models/investment-model';

// The fold: an `AssetType.Investment` asset IS an investment, stored in the
// unified asset list. These pure converters are the single, canonical mapping
// between the two shapes — used at the state/engine boundary (the optimizer,
// scenarios, chart, dashboard, and forecast still operate on `Investment`), on
// import/migration, and by the UI. Keeping the mapping here (D7: pure, no
// React/MUI) means the field correspondence lives in exactly one place.
//
// Field correspondence (lossless round-trip):
//   Investment.StartingBalance ↔ Asset.Balance
//   Investment.AverageReturnRate ↔ Asset.GrowthRate
//   Investment.CurrentValue      ↔ Asset.CurrentValue (today's anchor)
//   everything else copies across by the same name.

/** Convert an investment-type Asset into the Investment the engine consumes. */
export const assetToInvestment = (asset: Asset): Investment => ({
  Id: asset.Id,
  Provider: asset.Provider,
  Name: asset.Name,
  // An investment always carries a StartDate; the fallback only guards a
  // malformed asset (validation requires it) so the result stays a valid date.
  StartDate: asset.StartDate ?? new Date(0),
  StartingBalance: asset.Balance,
  AverageReturnRate: asset.GrowthRate,
  // CompoundingPeriod is required on Investment; assets default it (like the old
  // Investment model) to annually when unset.
  CompoundingPeriod: asset.CompoundingPeriod ?? CompoundingFrequency.Annually,
  RecurringContribution: asset.RecurringContribution,
  ContributionFrequency: asset.ContributionFrequency,
  ContributionStepUpAmount: asset.ContributionStepUpAmount,
  ContributionStepUpType: asset.ContributionStepUpType,
  CurrentValue: asset.CurrentValue,
});

/** Convert an Investment into its `AssetType.Investment` Asset representation. */
export const investmentToAsset = (investment: Investment): Asset => ({
  Id: investment.Id,
  Provider: investment.Provider,
  Name: investment.Name,
  AssetType: AssetType.Investment,
  Balance: investment.StartingBalance,
  GrowthRate: investment.AverageReturnRate,
  CompoundingPeriod: investment.CompoundingPeriod,
  StartDate: investment.StartDate,
  RecurringContribution: investment.RecurringContribution,
  ContributionFrequency: investment.ContributionFrequency,
  ContributionStepUpAmount: investment.ContributionStepUpAmount,
  ContributionStepUpType: investment.ContributionStepUpType,
  CurrentValue: investment.CurrentValue,
});

/** True for assets that are investments (folded from the standalone Investment). */
export const isInvestmentAsset = (asset: Asset): boolean =>
  asset.AssetType === AssetType.Investment;

/**
 * Pull the investments out of a unified asset list: the investment-type assets,
 * each converted to the Investment the engine/UI consume. The single home for
 * this derivation, used by every consumer that still thinks in Investments (the
 * investment table, the scenario builder, and the forecast engine inputs).
 */
export const investmentsFromAssets = (assets: Asset[]): Investment[] =>
  assets.filter(isInvestmentAsset).map(assetToInvestment);
