import { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Collapse,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import dayjs from 'dayjs';
import { Loan } from '../models/loan-model';
import { Investment } from '../models/investment-model';
import { Asset } from '../models/asset-model';
import { AllocationMode } from '../helpers/optimizer-helpers';
import {
  StrategyComparison as StrategyComparisonRow,
  compareStrategies,
} from '../helpers/strategy-helpers';
import { formatCurrency } from '../helpers/format-helpers';

interface StrategyComparisonProps {
  loans: Loan[];
  investments: Investment[];
  assets: Asset[];
  monthlyExtra: number;
  today: Date;
  mode: AllocationMode;
}

// Strategy comparison view (roadmap 8.5): a side-by-side table of the baseline
// and every allocation preset — net worth at +5y / +10y / +30y, the debt-free
// date, and the final investments-vs-debt split. Tucked behind a toggle so the
// optimizer's default view stays focused; the (heavier) comparison only computes
// once expanded. The figures come from the same engine the chart and dashboard
// use (compareStrategies → computeMilestones), so they agree everywhere.
export const StrategyComparison = ({
  loans,
  investments,
  assets,
  monthlyExtra,
  today,
  mode,
}: StrategyComparisonProps) => {
  const [open, setOpen] = useState(false);

  const comparison = useMemo<StrategyComparisonRow[]>(
    () =>
      open
        ? compareStrategies(
            loans,
            investments,
            assets,
            monthlyExtra,
            mode,
            today
          )
        : [],
    [open, loans, investments, assets, monthlyExtra, mode, today]
  );

  // The strategy with the highest +30y net worth (the last milestone) — flagged
  // in its column header.
  const bestIndex = comparison.reduce((best, row, index) => {
    const last = (r: StrategyComparisonRow) =>
      r.netWorthAt[r.netWorthAt.length - 1].value;
    return last(row) > last(comparison[best]) ? index : best;
  }, 0);

  const horizonYears =
    comparison.length > 0 ? comparison[0].netWorthAt.map((m) => m.years) : [];

  const formatDate = (date?: Date): string =>
    date ? dayjs(date).format('MMM YYYY') : '—';

  return (
    <Box sx={{ marginTop: 2 }}>
      <Button
        size="small"
        onClick={() => setOpen((prev) => !prev)}
        endIcon={open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        aria-expanded={open}
      >
        Compare strategies side by side
      </Button>

      <Collapse in={open} unmountOnExit>
        {/* TableContainer lets the wide side-by-side table scroll in place on
            narrow viewports instead of forcing page-level horizontal scroll. */}
        {comparison.length > 0 && (
          <TableContainer>
            <Table
              size="small"
              aria-label="Strategy comparison"
              sx={{ marginTop: 1 }}
            >
              <TableHead>
                <TableRow>
                  <TableCell />
                  {comparison.map((row, index) => (
                    <TableCell key={row.kind} align="right">
                      <Stack
                        direction="row"
                        spacing={0.5}
                        sx={{
                          justifyContent: 'flex-end',
                          alignItems: 'center',
                        }}
                      >
                        <span>{row.label}</span>
                        {index === bestIndex && (
                          <Chip label="Best" color="primary" size="small" />
                        )}
                      </Stack>
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {horizonYears.map((years, horizonIndex) => (
                  <TableRow key={`nw-${years}`}>
                    <TableCell>Net worth +{years}y</TableCell>
                    {comparison.map((row) => (
                      <TableCell key={row.kind} align="right">
                        {formatCurrency(row.netWorthAt[horizonIndex].value)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell>Debt-free</TableCell>
                  {comparison.map((row) => (
                    <TableCell key={row.kind} align="right">
                      {formatDate(row.debtFreeDate)}
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableCell>Investments (+30y)</TableCell>
                  {comparison.map((row) => (
                    <TableCell key={row.kind} align="right">
                      {formatCurrency(row.finalInvestments)}
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableCell>Debt left (+30y)</TableCell>
                  {comparison.map((row) => (
                    <TableCell key={row.kind} align="right">
                      {formatCurrency(row.finalDebt)}
                    </TableCell>
                  ))}
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Collapse>
    </Box>
  );
};
