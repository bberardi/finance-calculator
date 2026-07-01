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
import { alpha } from '@mui/material/styles';
import { LineChart } from '@mui/x-charts/LineChart';
import { Loan } from '../models/loan-model';
import { Investment } from '../models/investment-model';
import { Asset } from '../models/asset-model';
import { ScenarioInput } from '../models/forecast-model';
import { getDefaultHorizon } from '../helpers/forecast-helpers';
import {
  ForecastChartData,
  NET_WORTH_SERIES_ID,
  buildForecastChartData,
  sliceForecastChartData,
} from '../helpers/forecast-series';
import {
  formatCurrency,
  formatCurrencyCompact,
} from '../helpers/format-helpers';
import {
  NET_WORTH_COLOR,
  SCENARIO_SERIES_SUFFIX,
  baseSeriesId,
  getSeriesColor,
} from './series-colors';
import { ChartLegend } from './chart-legend';
import { ForecastDataTable } from './forecast-data-table';
import { simulateNetWorthBands } from '../helpers/monte-carlo-helpers';

interface ForecastChartProps {
  loans: Loan[];
  investments: Investment[];
  assets?: Asset[];
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
  assets,
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

  // Baseline (solid) lines always; when a scenario is active, add color-matched
  // dotted overlay lines (suffix-tagged ids) on top — originals remain (4.3).
  const assetList = useMemo(() => assets ?? [], [assets]);
  const fullData = useMemo<ForecastChartData>(() => {
    const horizon = getDefaultHorizon(loans, investments, today);
    const baseline = buildForecastChartData(
      loans,
      investments,
      horizon,
      undefined,
      today,
      assetList
    );
    if (!scenario) {
      return baseline;
    }
    const overlay = buildForecastChartData(
      loans,
      investments,
      horizon,
      scenario,
      today,
      assetList
    );
    const scenarioSeries = overlay.series.map((s) => ({
      ...s,
      id: s.id + SCENARIO_SERIES_SUFFIX,
      label: `${s.label} (scenario)`,
    }));
    return {
      dates: baseline.dates,
      series: [...baseline.series, ...scenarioSeries],
    };
  }, [loans, investments, assetList, scenario, today]);

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

  // Per-series line styling: thicken any net-worth line, dash scenario overlays.
  // x-charts v9 tags each line path with `data-series-id` (there is no per-series
  // class), so target that attribute under the shared line class.
  const lineStyles = useMemo(() => {
    const styles: Record<string, Record<string, number | string>> = {};
    series.forEach((s) => {
      const rules: Record<string, number | string> = {};
      if (baseSeriesId(s.id) === NET_WORTH_SERIES_ID) {
        rules.strokeWidth = 3;
      }
      if (s.id.endsWith(SCENARIO_SERIES_SUFFIX)) {
        rules.strokeDasharray = '5 4';
      }
      if (Object.keys(rules).length > 0) {
        styles[`& .MuiLineChart-line[data-series-id="${s.id}"]`] = rules;
      }
    });
    return styles;
  }, [series]);

  const [view, setView] = useState<'chart' | 'table'>('chart');
  const [monteCarlo, setMonteCarlo] = useState(false);
  // Monte Carlo is a chart-only overlay; in table view it has no effect.
  const showMonteCarlo = monteCarlo && view === 'chart';

  // Monte Carlo net-worth bands (9.1), computed over the full horizon only when
  // the mode is on, then sliced to the selected range below. Seeded, so the fan
  // is stable across re-renders.
  const mcBands = useMemo(() => {
    if (!showMonteCarlo) return null;
    const horizon = getDefaultHorizon(loans, investments, today);
    return simulateNetWorthBands(loans, investments, assetList, horizon, today);
  }, [showMonteCarlo, loans, investments, assetList, today]);

  // Build the fan as a transparent p10 base + a shaded p10→p90 band (stacked-area
  // trick — x-charts has no native range series) + a solid p50 median line, all
  // windowed to the current range. The band's tooltip reconstructs the real
  // p10–p90 range from its delta data.
  const fanSeries = useMemo(() => {
    if (!mcBands) return null;
    const count = dates.length;
    const valuesAt = (percentile: number) =>
      mcBands.bands
        .find((band) => band.percentile === percentile)!
        .values.slice(0, count);
    const p10 = valuesAt(10);
    const p50 = valuesAt(50);
    const p90 = valuesAt(90);
    return [
      {
        id: 'mc-p10-base',
        data: p10,
        area: true,
        stack: 'mc-fan',
        color: 'transparent',
        showMark: false,
        valueFormatter: () => '',
      },
      {
        id: 'mc-band',
        data: p90.map((value, index) => value - p10[index]),
        area: true,
        stack: 'mc-fan',
        color: alpha(NET_WORTH_COLOR, 0.18),
        showMark: false,
        label: 'Net worth range (P10–P90)',
        valueFormatter: (
          _value: number | null,
          context: { dataIndex: number }
        ) =>
          `${formatCurrency(p10[context.dataIndex])} – ${formatCurrency(
            p90[context.dataIndex]
          )}`,
      },
      {
        id: 'mc-p50',
        data: p50,
        color: NET_WORTH_COLOR,
        showMark: false,
        label: 'Net worth (median)',
        valueFormatter: (value: number | null) =>
          value === null ? '' : formatCurrency(value),
      },
    ];
  }, [mcBands, dates.length]);

  return (
    <Box>
      <Stack
        direction="row"
        sx={{
          marginBottom: 1,
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 1,
        }}
      >
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={view}
            onChange={(_, next: 'chart' | 'table' | null) =>
              next && setView(next)
            }
            aria-label="Forecast view"
          >
            <ToggleButton value="chart" aria-label="View as chart">
              Chart
            </ToggleButton>
            <ToggleButton value="table" aria-label="View as table">
              Table
            </ToggleButton>
          </ToggleButtonGroup>
          <ToggleButton
            size="small"
            value="monte-carlo"
            selected={monteCarlo}
            onChange={() => setMonteCarlo((prev) => !prev)}
            disabled={view === 'table'}
            aria-label="Monte Carlo mode"
          >
            Monte Carlo
          </ToggleButton>
        </Stack>
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
      {view === 'table' ? (
        <ForecastDataTable dates={dates} series={visibleSeries} />
      ) : showMonteCarlo && fanSeries ? (
        <LineChart
          height={chartHeight}
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
          series={fanSeries}
          margin={{ left: 64 }}
        />
      ) : (
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
          sx={lineStyles}
        />
      )}
      {!showMonteCarlo && (
        <ChartLegend
          items={legendItems}
          hiddenIds={hiddenIds}
          onToggle={toggleSeries}
          onShowAll={showAll}
        />
      )}
    </Box>
  );
};
