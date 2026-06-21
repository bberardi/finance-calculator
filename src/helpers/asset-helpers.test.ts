import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { Asset, AssetType } from '../models/asset-model';
import { CompoundingFrequency, Investment } from '../models/investment-model';
import { Loan } from '../models/loan-model';
import {
  assetNetWorthSign,
  forecastAsset,
  getAssetValueToday,
  isAssetLiability,
} from './asset-helpers';
import {
  forecastHomeEquity,
  forecastInvestment,
  forecastLoan,
  forecastNetWorth,
} from './forecast-helpers';
import { buildForecastChartData } from './forecast-series';
import { summarizePositions } from './summary-helpers';
import { computeMilestones } from './milestone-helpers';

// Charter (§4) coverage for Phase 7's simple-asset math. forecastAsset is a
// plain geometric series anchored to today's balance, so its oracle is a
// hand-evaluated compound-growth formula; the integration tests pin the
// net-worth roll-up (assets add, custom liabilities subtract).

const baseAsset = (overrides: Partial<Asset> = {}): Asset => ({
  Id: 'asset-1',
  Provider: 'Sample Bank',
  Name: 'HYSA',
  AssetType: AssetType.Cash,
  Balance: 10000,
  GrowthRate: 0,
  CompoundingPeriod: CompoundingFrequency.Monthly,
  ...overrides,
});

const TODAY = new Date(2025, 0, 1);

describe('isAssetLiability / assetNetWorthSign', () => {
  it('treats only the custom liability as a liability', () => {
    expect(isAssetLiability(baseAsset({ AssetType: AssetType.Cash }))).toBe(
      false
    );
    expect(isAssetLiability(baseAsset({ AssetType: AssetType.Property }))).toBe(
      false
    );
    expect(
      isAssetLiability(baseAsset({ AssetType: AssetType.CustomAsset }))
    ).toBe(false);
    expect(
      isAssetLiability(baseAsset({ AssetType: AssetType.CustomLiability }))
    ).toBe(true);
  });

  it('signs ordinary assets +1 and liabilities −1', () => {
    expect(assetNetWorthSign(baseAsset({ AssetType: AssetType.Cash }))).toBe(1);
    expect(
      assetNetWorthSign(baseAsset({ AssetType: AssetType.CustomLiability }))
    ).toBe(-1);
  });
});

describe('getAssetValueToday', () => {
  it('returns the balance rounded to cents', () => {
    expect(getAssetValueToday(baseAsset({ Balance: 1234.567 }))).toBe(1234.57);
  });
});

describe('forecastAsset', () => {
  it('anchors index 0 at today’s balance', () => {
    const horizon = new Date(2030, 0, 1);
    const series = forecastAsset(baseAsset({ Balance: 5000 }), horizon, TODAY);
    expect(series[0].Value).toBe(5000);
    expect(series[0].Date).toEqual(TODAY);
  });

  // Reference 1: monthly compounding. 12% APY → 1% monthly. 10000·1.01^n,
  // hand-evaluated: month 1 = 10100, month 12 = 10000·1.01^12 = 11268.2503…
  it('compounds monthly against a hand-derived oracle', () => {
    const horizon = new Date(2026, 0, 1);
    const series = forecastAsset(
      baseAsset({ Balance: 10000, GrowthRate: 12 }),
      horizon,
      TODAY
    );
    expect(series[1].Value).toBe(10100);
    expect(series[12].Value).toBe(11268.25);
  });

  // Reference 2: quarterly compounding. 8%/yr → 2% per quarter, boundaries at
  // months 3,6,9,12. 10000·1.02^4 = 10824.3216 at one year; months between
  // boundaries hold flat.
  it('compounds only on quarterly boundaries', () => {
    const horizon = new Date(2026, 0, 1);
    const series = forecastAsset(
      baseAsset({
        Balance: 10000,
        GrowthRate: 8,
        CompoundingPeriod: CompoundingFrequency.Quarterly,
      }),
      horizon,
      TODAY
    );
    expect(series[1].Value).toBe(10000); // no boundary yet
    expect(series[2].Value).toBe(10000);
    expect(series[3].Value).toBe(10200); // first quarter
    expect(series[12].Value).toBe(10824.32);
  });

  // Reference 3: annual compounding holds flat for 11 months then steps once.
  it('compounds once a year for annual compounding', () => {
    const horizon = new Date(2026, 0, 1);
    const series = forecastAsset(
      baseAsset({
        Balance: 10000,
        GrowthRate: 5,
        CompoundingPeriod: CompoundingFrequency.Annually,
      }),
      horizon,
      TODAY
    );
    expect(series[11].Value).toBe(10000);
    expect(series[12].Value).toBe(10500);
  });

  it('defaults to monthly compounding when CompoundingPeriod is unset', () => {
    const horizon = new Date(2026, 0, 1);
    const asset = baseAsset({ Balance: 10000, GrowthRate: 12 });
    delete asset.CompoundingPeriod;
    const series = forecastAsset(asset, horizon, TODAY);
    expect(series[1].Value).toBe(10100);
    expect(series[12].Value).toBe(11268.25);
  });

  it('declines geometrically toward zero for a negative growth rate', () => {
    const horizon = new Date(2026, 0, 1);
    const series = forecastAsset(
      baseAsset({
        Balance: 20000,
        GrowthRate: -12,
        AssetType: AssetType.CustomAsset,
      }),
      horizon,
      TODAY
    );
    expect(series[1].Value).toBe(19800); // 20000·0.99
    expect(series[12].Value).toBeGreaterThan(0);
    expect(series[12].Value).toBeLessThan(20000);
  });

  it('returns only the anchor when the horizon is today', () => {
    const series = forecastAsset(baseAsset({ Balance: 7500 }), TODAY, TODAY);
    expect(series).toHaveLength(1);
    expect(series[0].Value).toBe(7500);
  });

  // Property: a non-negative balance can never produce a negative value, for any
  // rate above −100%/yr (the only regime where a monthly factor stays positive).
  it('never goes negative for a non-negative balance (property)', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1_000_000, noNaN: true }),
        fc.double({ min: -90, max: 90, noNaN: true }),
        (balance, rate) => {
          const series = forecastAsset(
            baseAsset({ Balance: balance, GrowthRate: rate }),
            new Date(2035, 0, 1),
            TODAY
          );
          return series.every((p) => p.Value >= 0);
        }
      )
    );
  });

  // Property: a positive growth rate is monotonically non-decreasing.
  it('is non-decreasing for a non-negative growth rate (property)', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 500_000, noNaN: true }),
        fc.double({ min: 0, max: 50, noNaN: true }),
        (balance, rate) => {
          const series = forecastAsset(
            baseAsset({ Balance: balance, GrowthRate: rate }),
            new Date(2032, 0, 1),
            TODAY
          );
          for (let i = 1; i < series.length; i++) {
            if (series[i].Value < series[i - 1].Value - 1e-6) return false;
          }
          return true;
        }
      )
    );
  });
});

describe('forecastNetWorth with assets', () => {
  const horizon = new Date(2026, 0, 1);

  it('adds ordinary assets and subtracts custom liabilities at the anchor', () => {
    const cash = baseAsset({ Id: 'cash', Balance: 10000, GrowthRate: 0 });
    const liability = baseAsset({
      Id: 'liab',
      Name: 'Loan to friend',
      AssetType: AssetType.CustomLiability,
      Balance: 4000,
      GrowthRate: 0,
    });
    const nw = forecastNetWorth([], [], horizon, undefined, TODAY, [
      cash,
      liability,
    ]);
    // 10000 (cash) − 4000 (liability) = 6000.
    expect(nw[0].Value).toBe(6000);
  });

  it('matches the component sum month for month (cross-consistency)', () => {
    const loan: Loan = {
      Id: 'l1',
      Provider: 'Bank',
      Name: 'Loan',
      InterestRate: 5,
      StartDate: new Date(2020, 0, 1),
      EndDate: new Date(2030, 0, 1),
      Principal: 20000,
      CurrentAmount: 15000,
      MonthlyPayment: 300,
    };
    const investment: Investment = {
      Id: 'i1',
      Provider: 'Brokerage',
      Name: 'Fund',
      StartDate: new Date(2020, 0, 1),
      StartingBalance: 5000,
      AverageReturnRate: 6,
      CompoundingPeriod: CompoundingFrequency.Monthly,
      CurrentValue: 8000,
    };
    const cash = baseAsset({ Id: 'cash', Balance: 12000, GrowthRate: 3 });
    const liability = baseAsset({
      Id: 'liab',
      AssetType: AssetType.CustomLiability,
      Balance: 2000,
      GrowthRate: 6,
    });

    const nw = forecastNetWorth(
      [loan],
      [investment],
      horizon,
      undefined,
      TODAY,
      [cash, liability]
    );
    const loanSeries = forecastLoan(loan, horizon, 0, TODAY);
    const investmentSeries = forecastInvestment(investment, horizon, 0, TODAY);
    const cashSeries = forecastAsset(cash, horizon, TODAY);
    const liabilitySeries = forecastAsset(liability, horizon, TODAY);

    // Net worth must equal investments + cash − loan − liability at every month,
    // reusing the same per-entity series (PRECISION.md: round the net sum once).
    for (let m = 0; m < nw.length; m++) {
      const expected =
        Math.round(
          (investmentSeries[m].Value +
            cashSeries[m].Value -
            loanSeries[m].Value -
            liabilitySeries[m].Value) *
            100
        ) / 100;
      expect(nw[m].Value).toBe(expected);
    }
    // Spot-check the anchor exactly: 8000 + 12000 − 15000 − 2000 = 3000.
    expect(nw[0].Value).toBe(3000);
  });
});

describe('forecastHomeEquity', () => {
  const horizon = new Date(2030, 0, 1);
  const property = baseAsset({
    Id: 'home',
    Name: 'Home',
    AssetType: AssetType.Property,
    Balance: 400000,
    GrowthRate: 0,
  });
  const mortgage: Loan = {
    Id: 'm1',
    Provider: 'Bank',
    Name: 'Mortgage',
    InterestRate: 6,
    StartDate: new Date(2020, 0, 1),
    EndDate: new Date(2050, 0, 1),
    Principal: 350000,
    CurrentAmount: 300000,
    MonthlyPayment: 2000,
  };

  it('is property value minus the linked loan balance, pointwise', () => {
    const equity = forecastHomeEquity(property, mortgage, horizon, TODAY);
    const propertySeries = forecastAsset(property, horizon, TODAY);
    const loanSeries = forecastLoan(mortgage, horizon, 0, TODAY);
    expect(equity[0].Value).toBe(100000); // 400000 − 300000
    // Equity grows as the loan amortizes (flat property value here).
    expect(equity[12].Value).toBe(
      Math.round((propertySeries[12].Value - loanSeries[12].Value) * 100) / 100
    );
    expect(equity[12].Value).toBeGreaterThan(equity[0].Value);
  });
});

describe('buildForecastChartData with assets', () => {
  const horizon = new Date(2026, 0, 1);

  it('emits an asset line and folds signed assets into net worth', () => {
    const cash = baseAsset({ Id: 'cash', Name: 'Cash', Balance: 10000 });
    const liability = baseAsset({
      Id: 'liab',
      Name: 'IOU',
      AssetType: AssetType.CustomLiability,
      Balance: 3000,
    });
    const data = buildForecastChartData([], [], horizon, undefined, TODAY, [
      cash,
      liability,
    ]);
    const cashSeries = data.series.find((s) => s.id === 'cash');
    const liabilitySeries = data.series.find((s) => s.id === 'liab');
    const netWorth = data.series.find((s) => s.kind === 'networth');

    expect(cashSeries?.kind).toBe('asset');
    expect(liabilitySeries?.kind).toBe('asset');
    expect(cashSeries?.values[0]).toBe(10000);
    expect(liabilitySeries?.values[0]).toBe(3000);
    // Net worth nets the liability out: 10000 − 3000 = 7000.
    expect(netWorth?.values[0]).toBe(7000);
  });
});

describe('summarizePositions with assets', () => {
  it('rolls ordinary assets into assets and liabilities into debt', () => {
    const cash = baseAsset({ Id: 'cash', Balance: 10000 });
    const liability = baseAsset({
      Id: 'liab',
      AssetType: AssetType.CustomLiability,
      Balance: 2500,
    });
    const summary = summarizePositions([], [], TODAY, [cash, liability]);
    expect(summary.totalAssets).toBe(10000);
    expect(summary.totalDebt).toBe(2500);
    expect(summary.netWorth).toBe(7500);
    // Passive holdings add no monthly commitment.
    expect(summary.monthlyCommitments).toBe(0);
  });
});

describe('computeMilestones with assets', () => {
  it('includes asset value in the net-worth milestones', () => {
    const cash = baseAsset({ Id: 'cash', Balance: 50000, GrowthRate: 0 });
    const withAsset = computeMilestones([], [], TODAY, [cash]);
    const withoutAsset = computeMilestones([], [], TODAY, []);
    const at5With = withAsset.netWorthAt.find((m) => m.years === 5)?.value ?? 0;
    const at5Without =
      withoutAsset.netWorthAt.find((m) => m.years === 5)?.value ?? 0;
    expect(at5With - at5Without).toBe(50000);
  });
});
