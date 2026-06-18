import {
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableFooter,
  TableSortLabel,
  Paper,
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Investment,
  CompoundingFrequency,
  StepUpType,
} from '../models/investment-model';
import { getInvestmentPeriods } from '../helpers/investment-helpers';
import { formatCurrency, formatPercent } from '../helpers/format-helpers';
import { sortBy, SortDirection, SortValue } from '../helpers/sort-helpers';
import {
  Calculate,
  ContentCopy,
  Delete,
  Edit,
  TrendingUp,
} from '@mui/icons-material';
import { lazy, Suspense, useMemo, useState } from 'react';
import { EntityRowActions, RowAction } from '../components/entity-row-actions';

// Code-split the popouts (roadmap 6.6): modal, opened on demand, and pulling in
// date pickers + the table virtualizer — kept out of the initial bundle.
const PitPopout = lazy(() =>
  import('./pit-popout').then((m) => ({ default: m.PitPopout }))
);
const GrowthSchedulePopout = lazy(() =>
  import('./growth-schedule-popout').then((m) => ({
    default: m.GrowthSchedulePopout,
  }))
);

// Callbacks an investment row/card needs. Passed down from the table so the row
// and card components can live at module scope (no remount-on-render).
interface InvestmentRowHandlers {
  onGrowth: (investment: Investment) => void;
  onPit: (investment: Investment) => void;
  onEdit: (investment: Investment) => void;
  onClone: (investment: Investment) => void;
  onDelete: (investment: Investment) => void;
}

// Best-known current value: the explicit CurrentValue when set, else the
// starting balance as a stand-in for the table/totals.
const currentValue = (investment: Investment): number =>
  investment.CurrentValue ?? investment.StartingBalance;

const investmentActions = (
  investment: Investment,
  handlers: InvestmentRowHandlers
): RowAction[] => [
  {
    icon: <TrendingUp />,
    title: 'View Growth Schedule',
    onClick: () => handlers.onGrowth(investment),
  },
  {
    icon: <Calculate />,
    title: 'Point-in-Time Calculator',
    onClick: () => handlers.onPit(investment),
  },
  {
    icon: <Edit />,
    title: 'Edit Investment',
    onClick: () => handlers.onEdit(investment),
  },
  {
    icon: <ContentCopy />,
    title: 'Duplicate Investment',
    onClick: () => handlers.onClone(investment),
  },
  {
    icon: <Delete />,
    title: 'Delete Investment',
    onClick: () => handlers.onDelete(investment),
    color: 'error',
  },
];

const formatContribution = (investment: Investment): string => {
  if (!investment.RecurringContribution) return 'None';
  const base = formatCurrency(investment.RecurringContribution);
  if (
    !investment.ContributionStepUpType ||
    !investment.ContributionStepUpAmount
  )
    return base;
  const stepUp =
    investment.ContributionStepUpType === StepUpType.Flat
      ? `+${formatCurrency(investment.ContributionStepUpAmount)}/yr`
      : `+${investment.ContributionStepUpAmount}%/yr`;
  return `${base} (${stepUp})`;
};

const getCompoundingText = (period: CompoundingFrequency) => {
  switch (period) {
    case CompoundingFrequency.Monthly:
      return 'Monthly';
    case CompoundingFrequency.Quarterly:
      return 'Quarterly';
    case CompoundingFrequency.Annually:
      return 'Annually';
    default:
      return period;
  }
};

type InvestmentColumnId =
  | 'Name'
  | 'Provider'
  | 'StartingBalance'
  | 'CurrentValue'
  | 'AverageReturnRate'
  | 'CompoundingPeriod'
  | 'RecurringContribution';

interface InvestmentColumn {
  id: InvestmentColumnId;
  label: string;
  numeric: boolean;
  value: (investment: Investment) => SortValue;
}

const INVESTMENT_COLUMNS: InvestmentColumn[] = [
  { id: 'Name', label: 'Name', numeric: false, value: (i) => i.Name },
  {
    id: 'Provider',
    label: 'Provider',
    numeric: false,
    value: (i) => i.Provider,
  },
  {
    id: 'StartingBalance',
    label: 'Starting Balance',
    numeric: true,
    value: (i) => i.StartingBalance,
  },
  {
    id: 'CurrentValue',
    label: 'Current Value',
    numeric: true,
    value: (i) => currentValue(i),
  },
  {
    id: 'AverageReturnRate',
    label: 'Return Rate',
    numeric: true,
    value: (i) => i.AverageReturnRate,
  },
  {
    id: 'CompoundingPeriod',
    label: 'Compounding',
    numeric: false,
    value: (i) => getCompoundingText(i.CompoundingPeriod),
  },
  {
    id: 'RecurringContribution',
    label: 'Recurring Contribution',
    numeric: true,
    value: (i) => i.RecurringContribution ?? 0,
  },
];

const InvestmentCard = ({
  investment,
  handlers,
  isMobile,
}: {
  investment: Investment;
  handlers: InvestmentRowHandlers;
  isMobile: boolean;
}) => (
  <Card sx={{ marginBottom: 2 }}>
    <CardContent>
      <Typography variant="h6" component="div">
        {investment.Name}
      </Typography>
      <Typography sx={{ color: 'text.secondary', mb: 1.5 }}>
        {investment.Provider}
      </Typography>
      <Box sx={{ marginBottom: 1 }}>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Typography variant="body2">
              <strong>Starting Balance:</strong>
            </Typography>
            <Typography variant="body2">
              {formatCurrency(investment.StartingBalance)}
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Typography variant="body2">
              <strong>Current Value:</strong>
            </Typography>
            <Typography variant="body2">
              {formatCurrency(currentValue(investment))}
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Typography variant="body2">
              <strong>Return Rate:</strong>
            </Typography>
            <Typography variant="body2">
              {formatPercent(investment.AverageReturnRate, 3)}
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Typography variant="body2">
              <strong>Recurring:</strong>
            </Typography>
            <Typography variant="body2">
              {formatContribution(investment)}
            </Typography>
          </Grid>
        </Grid>
      </Box>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexDirection: { xs: 'column', sm: 'row' },
          gap: { xs: 1, sm: 0 },
        }}
      >
        <Typography variant="body2">
          <strong>Periods:</strong> {getInvestmentPeriods(investment)}
        </Typography>
        <EntityRowActions
          actions={investmentActions(investment, handlers)}
          isMobile={isMobile}
        />
      </Box>
    </CardContent>
  </Card>
);

export const InvestmentTable = (props: InvestmentTableProps) => {
  const [selectedPit, setSelectedPit] = useState<Investment | undefined>();
  const [selectedGrowth, setSelectedGrowth] = useState<
    Investment | undefined
  >();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // Default ordering: highest expected return first.
  const [sortColumn, setSortColumn] =
    useState<InvestmentColumnId>('AverageReturnRate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handlers: InvestmentRowHandlers = {
    onGrowth: setSelectedGrowth,
    onPit: setSelectedPit,
    onEdit: props.onInvestmentEdit,
    onClone: props.onInvestmentClone,
    onDelete: props.onInvestmentDelete,
  };

  const column =
    INVESTMENT_COLUMNS.find((c) => c.id === sortColumn) ??
    INVESTMENT_COLUMNS[0];
  const sortedInvestments = useMemo(
    () => sortBy(props.investments, column.value, sortDirection),
    [props.investments, column, sortDirection]
  );

  const handleSort = (id: InvestmentColumnId) => {
    if (sortColumn === id) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(id);
      setSortDirection('asc');
    }
  };

  const totalStarting = props.investments.reduce(
    (sum, i) => sum + i.StartingBalance,
    0
  );
  const totalCurrent = props.investments.reduce(
    (sum, i) => sum + currentValue(i),
    0
  );

  return (
    <>
      <Suspense fallback={null}>
        {selectedPit && (
          <PitPopout
            investment={selectedPit}
            onClose={() => setSelectedPit(undefined)}
          />
        )}
        {selectedGrowth && (
          <GrowthSchedulePopout
            investment={selectedGrowth}
            onClose={() => setSelectedGrowth(undefined)}
          />
        )}
      </Suspense>

      {isMobile ? (
        <Box>
          {sortedInvestments.map((investment) => (
            <InvestmentCard
              key={investment.Id}
              investment={investment}
              handlers={handlers}
              isMobile={isMobile}
            />
          ))}
        </Box>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                {INVESTMENT_COLUMNS.map((col) => (
                  <TableCell
                    key={col.id}
                    align={col.numeric ? 'right' : 'left'}
                    sortDirection={
                      sortColumn === col.id ? sortDirection : false
                    }
                  >
                    <TableSortLabel
                      active={sortColumn === col.id}
                      direction={sortColumn === col.id ? sortDirection : 'asc'}
                      onClick={() => handleSort(col.id)}
                    >
                      {col.label}
                    </TableSortLabel>
                  </TableCell>
                ))}
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedInvestments.map((row) => (
                <TableRow key={row.Id}>
                  <TableCell>{row.Name}</TableCell>
                  <TableCell>{row.Provider}</TableCell>
                  <TableCell align="right">
                    {formatCurrency(row.StartingBalance)}
                  </TableCell>
                  <TableCell align="right">
                    {formatCurrency(currentValue(row))}
                  </TableCell>
                  <TableCell align="right">
                    {formatPercent(row.AverageReturnRate, 3)}
                  </TableCell>
                  <TableCell>
                    {getCompoundingText(row.CompoundingPeriod)}
                  </TableCell>
                  <TableCell align="right">{formatContribution(row)}</TableCell>
                  <TableCell>
                    <EntityRowActions
                      actions={investmentActions(row, handlers)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell>
                  <strong>Totals</strong>
                </TableCell>
                <TableCell />
                <TableCell align="right">
                  <strong>{formatCurrency(totalStarting)}</strong>
                </TableCell>
                <TableCell align="right">
                  <strong>{formatCurrency(totalCurrent)}</strong>
                </TableCell>
                <TableCell />
                <TableCell />
                <TableCell />
                <TableCell />
              </TableRow>
            </TableFooter>
          </Table>
        </TableContainer>
      )}
    </>
  );
};

export type InvestmentTableProps = {
  investments: Investment[];
  onInvestmentEdit: (investment: Investment) => void;
  onInvestmentDelete: (investment: Investment) => void;
  onInvestmentClone: (investment: Investment) => void;
};
