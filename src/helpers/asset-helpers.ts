import dayjs from 'dayjs';
import { Asset, AssetType } from '../models/asset-model';
import { CompoundingFrequency } from '../models/investment-model';
import { ForecastPoint } from '../models/forecast-model';
import { getPeriodsPerYear } from './investment-helpers';

// Phase 7 forecast math for simple holdings (cash / property / custom). A pure,
// leaf module (D7): it computes the value series for a single Asset and never
// imports the rest of the forecast engine, so forecast-helpers can depend on it
// without a cycle. The net-worth composition (forecastNetWorth, the chart
// series, the dashboard summary) layers these on top of loans/investments.

const roundToCents = (value: number): number => Math.round(value * 100) / 100;

// Number of whole month-steps from start to end, rounded up so a series always
// spans at least to the requested end date (never negative). Identical to the
// axis forecastLoan/forecastInvestment use, so asset points line up index-for-
// index with the rest of the engine and series can be summed pointwise.
const getMonthsBetween = (start: Date, end: Date): number =>
  Math.max(0, Math.ceil(dayjs(end).diff(dayjs(start), 'month', true)));

// True for the asset types that subtract from net worth. Only the custom
// liability does; cash and property are always positive holdings.
export const isAssetLiability = (asset: Asset): boolean =>
  asset.AssetType === AssetType.CustomLiability;

// Signed contribution to net worth: ordinary assets add (+1), liabilities
// subtract (−1). The displayed/forecast Balance series stays positive in both
// cases (a liability shows its outstanding amount, like a loan balance); only
// the net-worth roll-up applies the sign.
export const assetNetWorthSign = (asset: Asset): number =>
  isAssetLiability(asset) ? -1 : 1;

// Forecast an asset's value month by month from today to the horizon. The
// series is anchored to today's Balance and compounds at GrowthRate on the
// asset's CompoundingPeriod (monthly by default), with boundaries measured from
// today (an asset has no historical StartDate cadence to honor). Index 0 is
// today. The running value is kept unrounded between months and each emitted
// point is rounded to cents (PRECISION.md, matching forecastInvestment).
//
// A negative GrowthRate (a depreciating car, a shrinking custom balance) decays
// the value geometrically toward — but never below — zero, so summed series
// stay well-defined.
export const forecastAsset = (
  asset: Asset,
  horizon: Date,
  today: Date = new Date()
): ForecastPoint[] => {
  const months = getMonthsBetween(today, horizon);
  const start = dayjs(today);
  const frequency = asset.CompoundingPeriod ?? CompoundingFrequency.Monthly;
  const periodsPerYear = getPeriodsPerYear(frequency);
  const periodRate = asset.GrowthRate / 100 / periodsPerYear;
  const compoundingInterval = 12 / periodsPerYear;

  let value = asset.Balance;
  const points: ForecastPoint[] = [
    { Date: start.toDate(), Value: roundToCents(value) },
  ];

  for (let month = 1; month <= months; month++) {
    if (month % compoundingInterval === 0) {
      value *= 1 + periodRate;
    }
    points.push({
      Date: start.add(month, 'month').toDate(),
      Value: roundToCents(value),
    });
  }

  return points;
};

// Today's value of an asset (the series' index-0 anchor), rounded to cents.
// Used by the dashboard summary so the cards and the chart agree on the anchor:
// forecastAsset(asset, today)[0].Value is exactly this value.
export const getAssetValueToday = (asset: Asset): number =>
  roundToCents(asset.Balance);
