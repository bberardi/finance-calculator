import { describe, it, expect } from 'vitest';
import {
  NET_WORTH_SERIES_ID,
  buildForecastChartData,
  sliceForecastChartData,
} from './forecast-series';
import { forecastNetWorth } from './forecast-helpers';
import { Loan } from '../models/loan-model';
import { CompoundingFrequency, Investment } from '../models/investment-model';

const TODAY = new Date(2025, 0, 1);
const HORIZON = new Date(2025, 3, 1); // 3 months out — small, deterministic axis

const loan: Loan = {
  Id: 'loan-1',
  Provider: 'Bank',
  Name: 'Car Loan',
  InterestRate: 6,
  Principal: 12000,
  CurrentAmount: 6000,
  MonthlyPayment: 500,
  StartDate: new Date(2024, 0, 1),
  EndDate: new Date(2026, 0, 1),
};

const investment: Investment = {
  Id: 'inv-1',
  Provider: 'Brokerage',
  Name: 'Index Fund',
  StartDate: new Date(2024, 0, 1),
  StartingBalance: 10000,
  AverageReturnRate: 6,
  CompoundingPeriod: CompoundingFrequency.Monthly,
  RecurringContribution: 200,
  ContributionFrequency: CompoundingFrequency.Monthly,
};

describe('buildForecastChartData', () => {
  it('returns a shared monthly date axis even with no positions', () => {
    const { dates, series } = buildForecastChartData(
      [],
      [],
      HORIZON,
      undefined,
      TODAY
    );
    expect(dates).toHaveLength(4); // today + 3 months
    expect(dates[0].getTime()).toBe(TODAY.getTime());
    // Only the aggregate net-worth line, flat at 0.
    expect(series).toHaveLength(1);
    expect(series[0].id).toBe(NET_WORTH_SERIES_ID);
    expect(series[0].values).toEqual([0, 0, 0, 0]);
  });

  it('orders series loans, then investments, then net worth with correct metadata', () => {
    const { dates, series } = buildForecastChartData(
      [loan],
      [investment],
      HORIZON,
      undefined,
      TODAY
    );
    expect(series.map((s) => s.id)).toEqual([
      'loan-1',
      'inv-1',
      NET_WORTH_SERIES_ID,
    ]);
    expect(series.map((s) => s.kind)).toEqual([
      'loan',
      'investment',
      'networth',
    ]);
    expect(series.map((s) => s.label)).toEqual([
      'Car Loan',
      'Index Fund',
      'Net worth',
    ]);
    // Every series is aligned to the date axis.
    series.forEach((s) => expect(s.values).toHaveLength(dates.length));
  });

  it('plots loan balances as a declining liability anchored to CurrentAmount', () => {
    const { series } = buildForecastChartData(
      [loan],
      [],
      HORIZON,
      undefined,
      TODAY
    );
    const loanSeries = series.find((s) => s.id === 'loan-1')!;
    expect(loanSeries.values[0]).toBe(6000);
    // Balance falls as payments exceed interest.
    expect(loanSeries.values[1]).toBeLessThan(loanSeries.values[0]);
    // With only a loan, net worth is the negative of its balance.
    const net = series.find((s) => s.id === NET_WORTH_SERIES_ID)!;
    expect(net.values[0]).toBe(-6000);
  });

  it('net-worth line is identical to forecastNetWorth (single source of truth)', () => {
    const { series } = buildForecastChartData(
      [loan],
      [investment],
      HORIZON,
      undefined,
      TODAY
    );
    const net = series.find((s) => s.id === NET_WORTH_SERIES_ID)!;
    const engineNet = forecastNetWorth(
      [loan],
      [investment],
      HORIZON,
      undefined,
      TODAY
    ).map((p) => p.Value);
    expect(net.values).toEqual(engineNet);
  });

  it('applies scenario extras to the matching entities', () => {
    const baseline = buildForecastChartData(
      [loan],
      [],
      HORIZON,
      undefined,
      TODAY
    );
    const withExtra = buildForecastChartData(
      [loan],
      [],
      HORIZON,
      { ExtraLoanPayments: { 'loan-1': 1000 } },
      TODAY
    );
    const baseLoan = baseline.series.find((s) => s.id === 'loan-1')!;
    const extraLoan = withExtra.series.find((s) => s.id === 'loan-1')!;
    // More toward principal ⇒ a lower balance next month.
    expect(extraLoan.values[1]).toBeLessThan(baseLoan.values[1]);
  });
});

describe('sliceForecastChartData', () => {
  const full = buildForecastChartData(
    [loan],
    [investment],
    HORIZON,
    undefined,
    TODAY
  );

  it('keeps the first N month-steps (N+1 points) across every series', () => {
    const sliced = sliceForecastChartData(full, 2);
    expect(sliced.dates).toHaveLength(3);
    sliced.series.forEach((s) => expect(s.values).toHaveLength(3));
    // Windowed values match the head of the full series (today-anchored).
    expect(sliced.series[0].values).toEqual(full.series[0].values.slice(0, 3));
  });

  it('clamps to the full series when asked for more than the horizon', () => {
    const sliced = sliceForecastChartData(full, 999);
    expect(sliced.dates).toHaveLength(full.dates.length);
    expect(sliced.series[0].values).toEqual(full.series[0].values);
  });

  it('does not mutate the source data', () => {
    const beforeLength = full.dates.length;
    sliceForecastChartData(full, 1);
    expect(full.dates).toHaveLength(beforeLength);
  });
});
