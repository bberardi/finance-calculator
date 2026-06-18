import { Loan } from '../models/loan-model';
import { Investment } from '../models/investment-model';
import { ScenarioInput } from '../models/forecast-model';
import {
  forecastInvestment,
  forecastLoan,
  forecastNetWorth,
} from './forecast-helpers';

// Chart-ready shaping of the forecast engine (Phase 2). The engine already
// produces every series on a shared monthly date axis anchored to today; this
// turns those into the labelled, aligned arrays a line chart consumes, with the
// net-worth line guaranteed identical to `forecastNetWorth` (single source of
// truth — Charter cross-consistency). Pure and framework-free (D7), so the
// chart, dashboard, and scenario overlays all read the same data.

const roundToCents = (value: number): number => Math.round(value * 100) / 100;

export type ForecastSeriesKind = 'loan' | 'investment' | 'networth';

export interface ForecastSeries {
  // Entity Id for loans/investments, or the literal 'networth'.
  id: string;
  label: string;
  kind: ForecastSeriesKind;
  // One value per date in `ForecastChartData.dates`, same length and order.
  values: number[];
}

export interface ForecastChartData {
  dates: Date[];
  series: ForecastSeries[];
}

// Stable id for the aggregate net-worth line, so consumers (legend, scenario
// overlays) can reference it without colliding with an entity Id.
export const NET_WORTH_SERIES_ID = 'networth';

/**
 * Build the chart series for the given positions over a horizon. Order is
 * loans, then investments, then the aggregate net-worth line. Loan lines are the
 * remaining balance (declining to 0 at payoff); investment lines are projected
 * value; the net-worth line is Σ investments − Σ loans, computed the same way as
 * `forecastNetWorth` so the chart and any net-worth readout never disagree.
 */
export const buildForecastChartData = (
  loans: Loan[],
  investments: Investment[],
  horizon: Date,
  scenario?: ScenarioInput,
  today: Date = new Date()
): ForecastChartData => {
  const loanForecasts = loans.map((loan) =>
    forecastLoan(
      loan,
      horizon,
      scenario?.ExtraLoanPayments?.[loan.Id] ?? 0,
      today
    )
  );
  const investmentForecasts = investments.map((investment) =>
    forecastInvestment(
      investment,
      horizon,
      scenario?.ExtraContributions?.[investment.Id] ?? 0,
      today
    )
  );

  // A reference series with no entities gives the shared date axis even when
  // there are no positions yet (an empty forecast is still a date-stamped axis).
  const reference = forecastNetWorth([], [], horizon, undefined, today);
  const dates = reference.map((point) => point.Date);

  const netWorthValues = dates.map((_, month) => {
    const assets = investmentForecasts.reduce(
      (sum, series) => sum + series[month].Value,
      0
    );
    const debts = loanForecasts.reduce(
      (sum, series) => sum + series[month].Value,
      0
    );
    return roundToCents(assets - debts);
  });

  const series: ForecastSeries[] = [
    ...loans.map((loan, index) => ({
      id: loan.Id,
      label: loan.Name,
      kind: 'loan' as const,
      values: loanForecasts[index].map((point) => point.Value),
    })),
    ...investments.map((investment, index) => ({
      id: investment.Id,
      label: investment.Name,
      kind: 'investment' as const,
      values: investmentForecasts[index].map((point) => point.Value),
    })),
    {
      id: NET_WORTH_SERIES_ID,
      label: 'Net worth',
      kind: 'networth' as const,
      values: netWorthValues,
    },
  ];

  return { dates, series };
};

/**
 * Window a forecast to the first `months` month-steps (the time-range control,
 * 2.4). Index 0 is today, so `months` steps means `months + 1` points; the
 * window is clamped to what exists, so asking for more than the horizon returns
 * the full series. Pure slice — every series stays aligned to the trimmed axis.
 */
export const sliceForecastChartData = (
  data: ForecastChartData,
  months: number
): ForecastChartData => {
  // Clamp `months` at the low end before adding the index-0 point: a negative
  // window is meaningless, and `Array.slice(0, negative)` would trim from the
  // end rather than return an empty window, silently yielding a back-trimmed
  // series instead of nothing. (#95)
  const count = Math.min(Math.max(0, months + 1), data.dates.length);
  return {
    dates: data.dates.slice(0, count),
    series: data.series.map((s) => ({
      ...s,
      values: s.values.slice(0, count),
    })),
  };
};
