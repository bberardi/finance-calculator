import { useMemo } from 'react';
import dayjs from 'dayjs';
import { LineChart } from '@mui/x-charts/LineChart';
import { Loan } from '../models/loan-model';
import { Investment } from '../models/investment-model';
import { ScenarioInput } from '../models/forecast-model';
import { getDefaultHorizon } from '../helpers/forecast-helpers';
import {
  NET_WORTH_SERIES_ID,
  buildForecastChartData,
} from '../helpers/forecast-series';
import {
  formatCurrency,
  formatCurrencyCompact,
} from '../helpers/format-helpers';
import { getSeriesColor } from './series-colors';

interface ForecastChartProps {
  loans: Loan[];
  investments: Investment[];
  scenario?: ScenarioInput;
  height?: number;
}

// The forecast line chart (Phase 2). One line per loan (declining balance), one
// per investment (growth), plus the aggregate net-worth line — all from the
// shared forecast engine via `buildForecastChartData`. Series are memoized by
// (positions, horizon, scenario) so re-renders don't recompute identical data.
export const ForecastChart = ({
  loans,
  investments,
  scenario,
  height = 400,
}: ForecastChartProps) => {
  // Stable "today" per mount so the horizon and the series share one anchor and
  // the memo key isn't invalidated by every render's new Date().
  const today = useMemo(() => new Date(), []);

  const { dates, series } = useMemo(() => {
    const horizon = getDefaultHorizon(loans, investments, today);
    return buildForecastChartData(loans, investments, horizon, scenario, today);
  }, [loans, investments, scenario, today]);

  return (
    <LineChart
      height={height}
      xAxis={[
        {
          data: dates,
          scaleType: 'time',
          valueFormatter: (value: Date) => dayjs(value).format('MMM YYYY'),
        },
      ]}
      yAxis={[
        { valueFormatter: (value: number) => formatCurrencyCompact(value) },
      ]}
      series={series.map((s) => ({
        id: s.id,
        data: s.values,
        label: s.label,
        color: getSeriesColor(s.id),
        showMark: false,
        valueFormatter: (value: number | null) =>
          value === null ? '' : formatCurrency(value),
      }))}
      margin={{ left: 64 }}
      // Emphasize the headline net-worth line above the entity lines.
      sx={{
        [`& .MuiLineElement-series-${NET_WORTH_SERIES_ID}`]: {
          strokeWidth: 3,
        },
      }}
    />
  );
};
