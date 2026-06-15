import { useCallback, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import {
  Box,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { LineChart } from '@mui/x-charts/LineChart';
import { Loan } from '../models/loan-model';
import { Investment } from '../models/investment-model';
import { ScenarioInput } from '../models/forecast-model';
import { getDefaultHorizon } from '../helpers/forecast-helpers';
import {
  NET_WORTH_SERIES_ID,
  buildForecastChartData,
  sliceForecastChartData,
} from '../helpers/forecast-series';
import {
  formatCurrency,
  formatCurrencyCompact,
} from '../helpers/format-helpers';
import { getSeriesColor } from './series-colors';
import { ChartLegend } from './chart-legend';

interface ForecastChartProps {
  loans: Loan[];
  investments: Investment[];
  scenario?: ScenarioInput;
  height?: number;
}

type TimeRange = '5y' | '10y' | '30y' | 'full';

// Months shown per range; 'full' means the whole horizon (Infinity clamps in
// sliceForecastChartData to the available length).
const RANGE_MONTHS: Record<TimeRange, number> = {
  '5y': 60,
  '10y': 120,
  '30y': 360,
  full: Infinity,
};

const RANGE_LABELS: { value: TimeRange; label: string }[] = [
  { value: '5y', label: '5Y' },
  { value: '10y', label: '10Y' },
  { value: '30y', label: '30Y' },
  { value: 'full', label: 'Full' },
];

// The forecast line chart (Phase 2). One line per loan (declining balance), one
// per investment (growth), plus the aggregate net-worth line — all from the
// shared forecast engine via `buildForecastChartData`. Series are memoized by
// (positions, horizon, scenario) so re-renders don't recompute identical data.
// An interactive legend (2.3) toggles individual lines on and off.
export const ForecastChart = ({
  loans,
  investments,
  scenario,
  height,
}: ForecastChartProps) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  // Responsive height (2.5): a shorter chart on phones so it fits above the fold
  // with the legend below; callers can still override explicitly.
  const chartHeight = height ?? (isMobile ? 280 : 400);

  // Stable "today" per mount so the horizon and the series share one anchor and
  // the memo key isn't invalidated by every render's new Date().
  const today = useMemo(() => new Date(), []);

  const fullData = useMemo(() => {
    const horizon = getDefaultHorizon(loans, investments, today);
    return buildForecastChartData(loans, investments, horizon, scenario, today);
  }, [loans, investments, scenario, today]);

  const [range, setRange] = useState<TimeRange>('full');

  // Window the full series to the selected range (no recompute — pure slice).
  const { dates, series } = useMemo(
    () => sliceForecastChartData(fullData, RANGE_MONTHS[range]),
    [fullData, range]
  );

  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());

  const toggleSeries = useCallback((id: string) => {
    setHiddenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const showAll = useCallback(() => setHiddenIds(new Set()), []);

  const legendItems = useMemo(
    () =>
      series.map((s) => ({
        id: s.id,
        label: s.label,
        color: getSeriesColor(s.id),
      })),
    [series]
  );

  const visibleSeries = series.filter((s) => !hiddenIds.has(s.id));

  return (
    <Box>
      <Stack
        direction="row"
        sx={{ marginBottom: 1, justifyContent: 'flex-end' }}
      >
        <ToggleButtonGroup
          size="small"
          exclusive
          value={range}
          onChange={(_, next: TimeRange | null) => next && setRange(next)}
          aria-label="Forecast time range"
        >
          {RANGE_LABELS.map(({ value, label }) => (
            <ToggleButton key={value} value={value} aria-label={label}>
              {label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Stack>
      <LineChart
        height={chartHeight}
        hideLegend
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
        series={visibleSeries.map((s) => ({
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
      <ChartLegend
        items={legendItems}
        hiddenIds={hiddenIds}
        onToggle={toggleSeries}
        onShowAll={showAll}
      />
    </Box>
  );
};
