import dayjs from 'dayjs';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { ForecastSeries } from '../helpers/forecast-series';
import { formatCurrency } from '../helpers/format-helpers';

interface ForecastDataTableProps {
  dates: Date[];
  series: ForecastSeries[];
}

// Sample one row per year (plus the final point) so the table stays navigable
// over a 30-year horizon while still spanning the full range.
const yearlyIndices = (length: number): number[] => {
  const indices: number[] = [];
  for (let i = 0; i < length; i += 12) {
    indices.push(i);
  }
  const last = length - 1;
  if (last >= 0 && indices[indices.length - 1] !== last) {
    indices.push(last);
  }
  return indices;
};

// Accessible "view as table" fallback (Phase 2.6). A line chart is opaque to
// screen readers and keyboard-only users; this renders the same forecast series
// as a real data table (column headers, row scope) consuming the identical
// values the chart plots. It doubles as a data-inspection view for everyone, and
// reflects the active time range and legend toggles (it receives the windowed,
// visible series).
export const ForecastDataTable = ({
  dates,
  series,
}: ForecastDataTableProps) => {
  const rows = yearlyIndices(dates.length);

  return (
    <TableContainer>
      <Table size="small" aria-label="Forecast values at yearly intervals">
        <caption>
          <Typography variant="caption" color="text.secondary">
            Projected values at yearly intervals — loan balances, investment and
            asset values, and overall net worth.
          </Typography>
        </caption>
        <TableHead>
          <TableRow>
            <TableCell>Date</TableCell>
            {series.map((s) => (
              <TableCell key={s.id} align="right">
                {s.label}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((index) => (
            <TableRow key={dates[index].getTime()}>
              <TableCell component="th" scope="row">
                {dayjs(dates[index]).format('MMM YYYY')}
              </TableCell>
              {series.map((s) => (
                <TableCell key={s.id} align="right">
                  {formatCurrency(s.values[index])}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};
