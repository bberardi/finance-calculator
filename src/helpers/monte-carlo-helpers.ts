import { Loan } from '../models/loan-model';
import { Investment } from '../models/investment-model';
import { Asset } from '../models/asset-model';
import { forecastInvestment, forecastNetWorth } from './forecast-helpers';

// Monte Carlo mode (ROADMAP 9.1): the single average-return forecast states a
// long-horizon net worth with false precision. This layer replaces that one line
// with volatility-driven percentile bands (a fan chart), so the projection shows
// a range instead of a point.
//
// Approach: a geometric-Brownian-motion (GBM) overlay on the EXISTING
// deterministic forecast — no engine changes. Only investments carry market risk
// (loans amortize on a fixed rate; cash/property are deterministic here), so each
// simulated path multiplies the deterministic investment value by a lognormal
// shock and leaves the rest of net worth untouched:
//
//   netWorth_path(t) = netWorthDet(t) + investmentsDet(t) · (shock_path(t) − 1)
//
// where shock(t) = exp(σ·W(t) − ½σ²t) is driftless GBM (E[shock] = 1, so the mean
// path is exactly the deterministic forecast) driven by a Brownian motion W. With
// σ = 0 every shock is 1 and all paths collapse to the deterministic net worth, so
// the bands reduce exactly to today's forecast line (Charter consistency). The
// shock is applied uniformly to the running invested balance — a deliberate v1
// simplification (it slightly overstates the risk on very recent contributions);
// per-cashflow volatility is a future refinement.
//
// Pure and framework-free (D7) and cheap (the deterministic forecasts are
// computed once; each path is a light Brownian walk), so it runs inline, memoized,
// without a worker.

const roundToCents = (value: number): number => Math.round(value * 100) / 100;

export const DEFAULT_PATHS = 500;
export const DEFAULT_VOLATILITY_PCT = 15;
export const DEFAULT_SEED = 1;
export const DEFAULT_PERCENTILES = [10, 50, 90];

export interface MonteCarloOptions {
  // Number of simulated paths (default 500).
  paths?: number;
  // Assumed annual return volatility, as a percent (default 15).
  annualVolatilityPct?: number;
  // PRNG seed, so the same inputs always produce the same bands (default 1).
  seed?: number;
  // Percentiles to report, ascending (default 10 / 50 / 90).
  percentiles?: number[];
}

export interface PercentileBand {
  percentile: number;
  // One net-worth value per month, aligned to `dates`.
  values: number[];
}

export interface MonteCarloBands {
  dates: Date[];
  // One band per requested percentile, in the requested order.
  bands: PercentileBand[];
}

// mulberry32: a tiny, fast, well-distributed seeded PRNG returning a function that
// yields uniforms in [0, 1). Deterministic for a given seed — the basis for
// reproducible simulations.
export const mulberry32 = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// One draw from the standard normal distribution via the Box-Muller transform.
// `1 - rng()` maps the uniform into (0, 1] so the logarithm never sees 0.
export const nextNormal = (rng: () => number): number => {
  const u1 = 1 - rng();
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
};

// The `percentile`-th value of `values` by nearest-rank on the sorted sample.
const percentileOf = (sorted: number[], percentile: number): number => {
  const rank = Math.round((percentile / 100) * (sorted.length - 1));
  const index = Math.min(sorted.length - 1, Math.max(0, rank));
  return roundToCents(sorted[index]);
};

// Simulate net worth as volatility-driven percentile bands from today to the
// horizon (ROADMAP 9.1). Reuses the deterministic engine for the expected path
// and the investment exposure, then overlays a GBM shock per path. Reproducible
// for a given seed; with zero volatility every band equals the deterministic net
// worth. Index 0 is today (known with certainty, so every path agrees there).
export const simulateNetWorthBands = (
  loans: Loan[],
  investments: Investment[],
  assets: Asset[],
  horizon: Date,
  today: Date = new Date(),
  options: MonteCarloOptions = {}
): MonteCarloBands => {
  const paths = options.paths ?? DEFAULT_PATHS;
  const sigma = (options.annualVolatilityPct ?? DEFAULT_VOLATILITY_PCT) / 100;
  const seed = options.seed ?? DEFAULT_SEED;
  const percentiles = options.percentiles ?? DEFAULT_PERCENTILES;

  // The deterministic expected path and the investment-only value exposed to
  // market risk, both on the shared monthly axis.
  const netWorthDet = forecastNetWorth(
    loans,
    investments,
    horizon,
    undefined,
    today,
    assets
  );
  const months = netWorthDet.length;
  const dates = netWorthDet.map((point) => point.Date);

  const investmentsDet = new Array<number>(months).fill(0);
  for (const investment of investments) {
    const series = forecastInvestment(investment, horizon, 0, today);
    for (let month = 0; month < months; month++) {
      investmentsDet[month] += series[month].Value;
    }
  }

  // Each path is a Brownian walk; the shock multiplies the invested balance.
  const rng = mulberry32(seed);
  const dt = 1 / 12;
  const pathValues: number[][] = Array.from(
    { length: months },
    () => new Array<number>(paths)
  );
  for (let path = 0; path < paths; path++) {
    // Today (index 0) is certain: shock 1, so every path starts at the
    // deterministic net worth.
    pathValues[0][path] = netWorthDet[0].Value;
    let w = 0;
    for (let month = 1; month < months; month++) {
      w += Math.sqrt(dt) * nextNormal(rng);
      const tYears = month * dt;
      const shock = Math.exp(sigma * w - 0.5 * sigma * sigma * tYears);
      pathValues[month][path] =
        netWorthDet[month].Value + investmentsDet[month] * (shock - 1);
    }
  }

  // Percentiles per month: sort each month's sample once, then index each band.
  const bands: PercentileBand[] = percentiles.map((percentile) => ({
    percentile,
    values: new Array<number>(months),
  }));
  for (let month = 0; month < months; month++) {
    const sorted = pathValues[month].slice().sort((a, b) => a - b);
    bands.forEach((band) => {
      band.values[month] = percentileOf(sorted, band.percentile);
    });
  }

  return { dates, bands };
};
