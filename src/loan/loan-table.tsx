import {
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableFooter,
  TableSortLabel,
  LinearProgress,
  Paper,
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import { Loan } from '../models/loan-model';
import { lazy, Suspense, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { getTerms } from '../helpers/loan-helpers';
import { forecastLoan, getPayoffDate } from '../helpers/forecast-helpers';
import { formatCurrency, formatPercent } from '../helpers/format-helpers';
import { sortBy, SortDirection, SortValue } from '../helpers/sort-helpers';
import {
  Calculate,
  CalendarMonth,
  ContentCopy,
  Delete,
  Edit,
} from '@mui/icons-material';
import { EntityRowActions, RowAction } from '../components/entity-row-actions';

// Code-split the popouts (roadmap 6.6): they are modal, opened on demand, and
// pull in date pickers + the table virtualizer, so they stay out of the initial
// bundle and load only when a row action is clicked.
const PitPopout = lazy(() =>
  import('./pit-popout').then((m) => ({ default: m.PitPopout }))
);
const AmortizationPopout = lazy(() =>
  import('./amortization-popout').then((m) => ({
    default: m.AmortizationPopout,
  }))
);

// Callbacks a loan row/card needs. Passed down from the table so the row and
// card components can live at module scope (no remount-on-render).
interface LoanRowHandlers {
  onAmortization: (loan: Loan) => void;
  onPit: (loan: Loan) => void;
  onEdit: (loan: Loan) => void;
  onClone: (loan: Loan) => void;
  onDelete: (loan: Loan) => void;
}

// A loan plus its engine-derived display values (3.3): projected payoff date and
// how much of the original principal has been paid down so far.
interface LoanRow {
  loan: Loan;
  payoffDate?: Date;
  principalPaidPct: number;
}

const loanActions = (loan: Loan, handlers: LoanRowHandlers): RowAction[] => [
  {
    icon: <CalendarMonth />,
    title: 'View Amortization Schedule',
    onClick: () => handlers.onAmortization(loan),
  },
  {
    icon: <Calculate />,
    title: 'Point-in-Time Calculator',
    onClick: () => handlers.onPit(loan),
  },
  {
    icon: <Edit />,
    title: 'Edit Loan',
    onClick: () => handlers.onEdit(loan),
  },
  {
    icon: <ContentCopy />,
    title: 'Duplicate Loan',
    onClick: () => handlers.onClone(loan),
  },
  {
    icon: <Delete />,
    title: 'Delete Loan',
    onClick: () => handlers.onDelete(loan),
    color: 'error',
  },
];

const principalPaidPct = (loan: Loan): number => {
  if (!(loan.Principal > 0)) return 0;
  const paid = ((loan.Principal - loan.CurrentAmount) / loan.Principal) * 100;
  return Math.max(0, Math.min(100, paid));
};

const formatPayoff = (date?: Date): string =>
  date ? dayjs(date).format('MMM YYYY') : 'beyond forecast';

// Sortable column definitions. `value` maps a row to a comparable sort key.
type LoanColumnId =
  | 'Name'
  | 'Provider'
  | 'Principal'
  | 'CurrentAmount'
  | 'InterestRate'
  | 'MonthlyPayment'
  | 'Payoff';

interface LoanColumn {
  id: LoanColumnId;
  label: string;
  numeric: boolean;
  value: (row: LoanRow) => SortValue;
}

const LOAN_COLUMNS: LoanColumn[] = [
  { id: 'Name', label: 'Name', numeric: false, value: (r) => r.loan.Name },
  {
    id: 'Provider',
    label: 'Provider',
    numeric: false,
    value: (r) => r.loan.Provider,
  },
  {
    id: 'Principal',
    label: 'Principal',
    numeric: true,
    value: (r) => r.loan.Principal,
  },
  {
    id: 'CurrentAmount',
    label: 'Current Balance',
    numeric: true,
    value: (r) => r.loan.CurrentAmount,
  },
  {
    id: 'InterestRate',
    label: 'Interest Rate',
    numeric: true,
    value: (r) => r.loan.InterestRate,
  },
  {
    id: 'MonthlyPayment',
    label: 'Monthly Payment',
    numeric: true,
    value: (r) => r.loan.MonthlyPayment ?? 0,
  },
  {
    id: 'Payoff',
    label: 'Payoff',
    numeric: true,
    // Loans that never pay off sort last in ascending order.
    value: (r) => r.payoffDate?.getTime() ?? Infinity,
  },
];

const LoanCard = ({
  row,
  handlers,
}: {
  row: LoanRow;
  handlers: LoanRowHandlers;
}) => {
  const { loan } = row;
  return (
    <Card sx={{ marginBottom: 2 }}>
      <CardContent>
        <Typography variant="h6" component="div" gutterBottom>
          {loan.Name}
        </Typography>
        <Typography
          variant="body2"
          gutterBottom
          sx={{ color: 'text.secondary' }}
        >
          {loan.Provider}
        </Typography>
        <Grid container spacing={2}>
          <Grid size={6}>
            <Typography variant="body2">
              <strong>Principal:</strong> {formatCurrency(loan.Principal)}
            </Typography>
          </Grid>
          <Grid size={6}>
            <Typography variant="body2">
              <strong>Current:</strong> {formatCurrency(loan.CurrentAmount)}
            </Typography>
          </Grid>
          <Grid size={6}>
            <Typography variant="body2">
              <strong>Interest:</strong> {formatPercent(loan.InterestRate)}
            </Typography>
          </Grid>
          <Grid size={6}>
            <Typography variant="body2">
              <strong>Payment:</strong>{' '}
              {formatCurrency(loan.MonthlyPayment || 0)}
            </Typography>
          </Grid>
          <Grid size={6}>
            <Typography variant="body2">
              <strong>Terms:</strong> {getTerms(loan)} months
            </Typography>
          </Grid>
          <Grid size={6}>
            <Typography variant="body2">
              <strong>Payoff:</strong> {formatPayoff(row.payoffDate)}
            </Typography>
          </Grid>
        </Grid>
        <Box sx={{ marginTop: 1.5 }}>
          <Typography variant="caption" color="text.secondary">
            Principal paid: {Math.round(row.principalPaidPct)}%
          </Typography>
          <LinearProgress
            variant="determinate"
            value={row.principalPaidPct}
            sx={{ marginTop: 0.5 }}
          />
        </Box>
        <Box sx={{ marginTop: 2 }}>
          <EntityRowActions actions={loanActions(loan, handlers)} isMobile />
        </Box>
      </CardContent>
    </Card>
  );
};

export const LoanTable = (props: LoanTableProps) => {
  const [selectedPit, setSelectedPit] = useState<Loan | undefined>();
  const [selectedAmortization, setSelectedAmortization] = useState<
    Loan | undefined
  >();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // Default ordering mirrors how the optimizer reasons: highest rate first.
  const [sortColumn, setSortColumn] = useState<LoanColumnId>('InterestRate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handlers: LoanRowHandlers = {
    onAmortization: setSelectedAmortization,
    onPit: setSelectedPit,
    onEdit: props.onLoanEdit,
    onClone: props.onLoanClone,
    onDelete: props.onLoanDelete,
  };

  // Engine-derived rows (payoff date + principal-paid %), memoized so they
  // recompute only when the loans change.
  const today = useMemo(() => new Date(), []);
  const rows = useMemo<LoanRow[]>(() => {
    const horizon = dayjs(today).add(50, 'year').toDate();
    return props.loans.map((loan) => ({
      loan,
      payoffDate: getPayoffDate(forecastLoan(loan, horizon, 0, today)),
      principalPaidPct: principalPaidPct(loan),
    }));
  }, [props.loans, today]);

  const column =
    LOAN_COLUMNS.find((c) => c.id === sortColumn) ?? LOAN_COLUMNS[0];
  const sortedRows = useMemo(
    () => sortBy(rows, column.value, sortDirection),
    [rows, column, sortDirection]
  );

  const handleSort = (id: LoanColumnId) => {
    if (sortColumn === id) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(id);
      setSortDirection('asc');
    }
  };

  const totalPrincipal = props.loans.reduce((sum, l) => sum + l.Principal, 0);
  const totalCurrent = props.loans.reduce((sum, l) => sum + l.CurrentAmount, 0);
  const totalPayment = props.loans.reduce(
    (sum, l) => sum + (l.MonthlyPayment ?? 0),
    0
  );

  return (
    <>
      <Suspense fallback={null}>
        {selectedPit && (
          <PitPopout
            loan={selectedPit}
            onClose={() => setSelectedPit(undefined)}
          />
        )}
        {selectedAmortization && (
          <AmortizationPopout
            loan={selectedAmortization}
            onClose={() => setSelectedAmortization(undefined)}
          />
        )}
      </Suspense>

      {isMobile ? (
        <Box>
          {sortedRows.map((row) => (
            <LoanCard key={row.loan.Id} row={row} handlers={handlers} />
          ))}
        </Box>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                {LOAN_COLUMNS.map((col) => (
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
                <TableCell>Principal Paid</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedRows.map((row) => (
                <TableRow key={row.loan.Id}>
                  <TableCell>{row.loan.Name}</TableCell>
                  <TableCell>{row.loan.Provider}</TableCell>
                  <TableCell align="right">
                    {formatCurrency(row.loan.Principal)}
                  </TableCell>
                  <TableCell align="right">
                    {formatCurrency(row.loan.CurrentAmount)}
                  </TableCell>
                  <TableCell align="right">
                    {formatPercent(row.loan.InterestRate)}
                  </TableCell>
                  <TableCell align="right">
                    {formatCurrency(row.loan.MonthlyPayment || 0)}
                  </TableCell>
                  <TableCell align="right">
                    {formatPayoff(row.payoffDate)}
                  </TableCell>
                  <TableCell>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        minWidth: 120,
                      }}
                    >
                      <LinearProgress
                        variant="determinate"
                        value={row.principalPaidPct}
                        sx={{ flexGrow: 1 }}
                      />
                      <Typography variant="caption" sx={{ minWidth: 32 }}>
                        {Math.round(row.principalPaidPct)}%
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <EntityRowActions
                      actions={loanActions(row.loan, handlers)}
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
                  <strong>{formatCurrency(totalPrincipal)}</strong>
                </TableCell>
                <TableCell align="right">
                  <strong>{formatCurrency(totalCurrent)}</strong>
                </TableCell>
                <TableCell />
                <TableCell align="right">
                  <strong>{formatCurrency(totalPayment)}</strong>
                </TableCell>
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

export type LoanTableProps = {
  loans: Loan[];
  onLoanEdit: (l: Loan) => void;
  onLoanDelete: (l: Loan) => void;
  onLoanClone: (l: Loan) => void;
};
