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
  Checkbox,
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
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { getTerms } from '../helpers/loan-helpers';
import { forecastLoan, getPayoffDate } from '../helpers/forecast-helpers';
import { formatCurrency, formatPercent } from '../helpers/format-helpers';
import { sortBy, SortDirection, SortValue } from '../helpers/sort-helpers';
import { filterBySearch } from '../helpers/filter-helpers';
import {
  Calculate,
  CalendarMonth,
  ContentCopy,
  Delete,
  Edit,
} from '@mui/icons-material';
import { EntityRowActions, RowAction } from '../components/entity-row-actions';
import { DialogFallback } from '../components/dialog-fallback';
import { TableSearchField } from '../components/table-search-field';
import { BulkActionsToolbar } from '../components/bulk-actions-toolbar';
import { useRowSelection } from '../hooks/use-row-selection';

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
  selected,
  onSelect,
}: {
  row: LoanRow;
  handlers: LoanRowHandlers;
  selected: boolean;
  onSelect: () => void;
}) => {
  const { loan } = row;
  return (
    <Card sx={{ marginBottom: 2 }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
          <Checkbox
            checked={selected}
            onChange={onSelect}
            slotProps={{ input: { 'aria-label': `Select ${loan.Name}` } }}
            sx={{ mt: -1, ml: -1 }}
          />
          <Box sx={{ flexGrow: 1 }}>
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
          </Box>
        </Box>
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

  // Search/filter + multi-select (roadmap 6.4).
  const [query, setQuery] = useState('');
  const selection = useRowSelection();

  // Keep the selection in sync with the loans that currently exist: a deleted
  // row leaves the Set, so a bulk-delete undo restores rows unselected instead
  // of re-selecting them and re-showing the toolbar (PR #109 review follow-up).
  const { retain } = selection;
  useEffect(() => {
    retain(props.loans.map((l) => l.Id));
  }, [props.loans, retain]);

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

  // Visible rows after the text filter (name or provider).
  const visibleRows = useMemo(
    () =>
      filterBySearch(sortedRows, query, (r) => [r.loan.Name, r.loan.Provider]),
    [sortedRows, query]
  );

  const handleSort = (id: LoanColumnId) => {
    if (sortColumn === id) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(id);
      setSortDirection('asc');
    }
  };

  // Totals reflect what's currently visible (equal to all loans when unfiltered).
  const visibleLoans = visibleRows.map((r) => r.loan);
  const totalPrincipal = visibleLoans.reduce((sum, l) => sum + l.Principal, 0);
  const totalCurrent = visibleLoans.reduce(
    (sum, l) => sum + l.CurrentAmount,
    0
  );
  const totalPayment = visibleLoans.reduce(
    (sum, l) => sum + (l.MonthlyPayment ?? 0),
    0
  );

  // Effective selection: selected loans that still exist. Derived (not the raw
  // Set) so a bulk delete naturally drops its rows from the count.
  const selectedLoans = props.loans.filter((l) => selection.isSelected(l.Id));
  const visibleIds = visibleRows.map((r) => r.loan.Id);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selection.isSelected(id));
  const someVisibleSelected = visibleIds.some((id) => selection.isSelected(id));

  const onBulkDuplicate = () => {
    selectedLoans.forEach((loan) => props.onLoanClone(loan));
    selection.clear();
  };
  // Delete routes through Body for the confirm dialog + soft-undo. Selection is
  // left as-is; the confirmed deletions drop out of `selectedLoans` on their
  // own, and a cancel keeps the selection intact.
  const onBulkDelete = () => props.onLoanBulkDelete(selectedLoans);

  const noMatches = visibleRows.length === 0 && query.trim() !== '';

  return (
    <>
      <Suspense fallback={<DialogFallback />}>
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

      <TableSearchField
        value={query}
        onChange={setQuery}
        label="Search loans"
      />
      <BulkActionsToolbar
        count={selectedLoans.length}
        itemLabel="loan"
        onDuplicate={onBulkDuplicate}
        onDelete={onBulkDelete}
        onClear={selection.clear}
      />

      {noMatches ? (
        <Typography color="text.secondary" sx={{ py: 2 }}>
          No loans match “{query}”.
        </Typography>
      ) : isMobile ? (
        <Box>
          {visibleRows.map((row) => (
            <LoanCard
              key={row.loan.Id}
              row={row}
              handlers={handlers}
              selected={selection.isSelected(row.loan.Id)}
              onSelect={() => selection.toggle(row.loan.Id)}
            />
          ))}
        </Box>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={allVisibleSelected}
                    indeterminate={someVisibleSelected && !allVisibleSelected}
                    onChange={(e) =>
                      selection.setMany(visibleIds, e.target.checked)
                    }
                    slotProps={{
                      input: { 'aria-label': 'Select all loans' },
                    }}
                  />
                </TableCell>
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
              {visibleRows.map((row) => {
                const isSelected = selection.isSelected(row.loan.Id);
                return (
                  <TableRow key={row.loan.Id} selected={isSelected}>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={isSelected}
                        onChange={() => selection.toggle(row.loan.Id)}
                        slotProps={{
                          input: { 'aria-label': `Select ${row.loan.Name}` },
                        }}
                      />
                    </TableCell>
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
                );
              })}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell padding="checkbox" />
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
  onLoanBulkDelete: (loans: Loan[]) => void;
};
