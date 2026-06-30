import { describe, it, expect } from 'vitest';
import {
  mulberry32,
  nextNormal,
  simulateNetWorthBands,
} from './monte-carlo-helpers';
import { forecastNetWorth } from './forecast-helpers';
import { Loan } from '../models/loan-model';
import { CompoundingFrequency, Investment } from '../models/investment-model';

const TODAY = new Date(2025, 0, 1);
const HORIZON = new Date(2055, 0, 1); // 30 years → 361 monthly points

const loan: Loan = {
  Id: 'loan-1',
  Provider: 'Bank',
  Name: 'Mortgage',
  InterestRate: 5,
  Principal: 200000,
  CurrentAmount: 180000,
  MonthlyPayment: 1100,
  StartDate: new Date(2024, 0, 1),
  EndDate: new Date(2054, 0, 1),
};

const investment: Investment = {
  Id: 'inv-1',
  Provider: 'Brokerage',
  Name: 'Index Fund',
  StartDate: new Date(2024, 0, 1),
  StartingBalance: 50000,
  AverageReturnRate: 6,
  CompoundingPeriod: CompoundingFrequency.Monthly,
  CurrentValue: 50000,
  RecurringContribution: 500,
  ContributionFrequency: CompoundingFrequency.Monthly,
};

describe('mulberry32', () => {
  it('is deterministic for a seed and varies across seeds, in [0, 1)', () => {
    const draw = (seed: number) => {
      const rng = mulberry32(seed);
      return Array.from({ length: 6 }, () => rng());
    };
    expect(draw(42)).toEqual(draw(42));
    expect(draw(43)).not.toEqual(draw(42));
    for (const value of draw(42)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe('nextNormal', () => {
  it('draws a standard normal: mean ~0, std ~1 over many samples', () => {
    const rng = mulberry32(1);
    const n = 20000;
    let sum = 0;
    let sumSq = 0;
    for (let i = 0; i < n; i++) {
      const z = nextNormal(rng);
      sum += z;
      sumSq += z * z;
    }
    const mean = sum / n;
    const std = Math.sqrt(sumSq / n - mean * mean);
    // Seeded, so these tolerances are deterministic, not flaky.
    expect(Math.abs(mean)).toBeLessThan(0.05);
    expect(Math.abs(std - 1)).toBeLessThan(0.05);
  });
});

describe('simulateNetWorthBands', () => {
  it('collapses every band to the deterministic net worth at zero volatility (#9.1)', () => {
    const det = forecastNetWorth(
      [loan],
      [investment],
      HORIZON,
      undefined,
      TODAY
    );
    const { bands } = simulateNetWorthBands(
      [loan],
      [investment],
      [],
      HORIZON,
      TODAY,
      { annualVolatilityPct: 0 }
    );
    for (const band of bands) {
      band.values.forEach((value, month) =>
        expect(value).toBe(det[month].Value)
      );
    }
  });

  it('orders the percentiles p10 ≤ p50 ≤ p90 at every month', () => {
    const { bands } = simulateNetWorthBands(
      [loan],
      [investment],
      [],
      HORIZON,
      TODAY,
      { annualVolatilityPct: 15, seed: 7 }
    );
    const [p10, p50, p90] = bands.map((b) => b.values);
    for (let month = 0; month < p10.length; month++) {
      expect(p10[month]).toBeLessThanOrEqual(p50[month]);
      expect(p50[month]).toBeLessThanOrEqual(p90[month]);
    }
  });

  it('is reproducible for a seed and differs across seeds', () => {
    const run = (seed: number) =>
      simulateNetWorthBands([loan], [investment], [], HORIZON, TODAY, {
        annualVolatilityPct: 15,
        seed,
      }).bands;
    expect(run(7)).toEqual(run(7));
    expect(run(8)).not.toEqual(run(7));
  });

  it('collapses to the deterministic line when there are no investments', () => {
    const det = forecastNetWorth([loan], [], HORIZON, undefined, TODAY);
    const { bands } = simulateNetWorthBands([loan], [], [], HORIZON, TODAY, {
      annualVolatilityPct: 15,
    });
    for (const band of bands) {
      band.values.forEach((value, month) =>
        expect(value).toBe(det[month].Value)
      );
    }
  });

  it('brackets the deterministic forecast inside the p10–p90 band', () => {
    const det = forecastNetWorth(
      [loan],
      [investment],
      HORIZON,
      undefined,
      TODAY
    );
    const { bands } = simulateNetWorthBands(
      [loan],
      [investment],
      [],
      HORIZON,
      TODAY,
      { annualVolatilityPct: 15, seed: 7 }
    );
    const [p10, , p90] = bands.map((b) => b.values);
    const last = p10.length - 1;
    expect(p10[last]).toBeLessThanOrEqual(det[last].Value);
    expect(p90[last]).toBeGreaterThanOrEqual(det[last].Value);
  });

  it('widens the band over time and is certain at today (index 0)', () => {
    const { bands } = simulateNetWorthBands(
      [loan],
      [investment],
      [],
      HORIZON,
      TODAY,
      { annualVolatilityPct: 15, seed: 7 }
    );
    const [p10, p50, p90] = bands.map((b) => b.values);
    // Today is known: all percentiles agree.
    expect(p10[0]).toBe(p50[0]);
    expect(p50[0]).toBe(p90[0]);
    // Uncertainty grows: the band is wider at the horizon than near-term.
    const early = 12;
    const late = p10.length - 1;
    expect(p90[late] - p10[late]).toBeGreaterThan(p90[early] - p10[early]);
  });

  it('uses the documented defaults when no options are given', () => {
    const { dates, bands } = simulateNetWorthBands(
      [loan],
      [investment],
      [],
      HORIZON,
      TODAY
    );
    expect(bands.map((b) => b.percentile)).toEqual([10, 50, 90]);
    expect(dates).toHaveLength(bands[0].values.length);
    expect(dates[0].getTime()).toBe(TODAY.getTime());
  });

  it('honors custom paths and percentiles', () => {
    const reference = forecastNetWorth(
      [loan],
      [investment],
      HORIZON,
      undefined,
      TODAY
    );
    const { bands } = simulateNetWorthBands(
      [loan],
      [investment],
      [],
      HORIZON,
      TODAY,
      { paths: 50, percentiles: [5, 95], seed: 2, annualVolatilityPct: 20 }
    );
    expect(bands.map((b) => b.percentile)).toEqual([5, 95]);
    expect(bands[0].values).toHaveLength(reference.length);
    bands[0].values.forEach((low, month) =>
      expect(low).toBeLessThanOrEqual(bands[1].values[month])
    );
  });
});
