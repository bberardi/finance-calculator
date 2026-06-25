import {
  Box,
  Card,
  CardContent,
  Checkbox,
  Typography,
  Grid,
  LinearProgress,
} from '@mui/material';
import { Loan } from '../models/loan-model';
import { lazy, Suspense, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { getTerms } from '../helpers/loan-helpers';
import { forecastLoan, getPayoffDate } from '../helpers/forecast-helpers';
import { formatCurrency, formatPercent } from '../helpers/format-helpers';
import {
  Calculate,
  CalendarMonth,
  ContentCopy,
  Delete,
  Edit,
} from '@mui/icons-material';
import { EntityRowActions, RowAction } from '../components/entity-row-actions';
import { DialogFallback } from '../components/dialog-fallback';
import { HoldingColumn, HoldingTable } from '../components/holding-table';

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

const principalPaidValue = (loan: Loan): number => {
  if (!(loan.Principal > 0)) return 0;
  const paid = ((loan.Principal - loan.CurrentAmount) / loan.Principal) * 100;
  return Math.max(0, Math.min(100, paid));
};

const formatPayoff = (date?: Date): string =>
  date ? dayjs(date).format('MMM YYYY') : 'beyond forecast';

const sumBy = (rows: LoanRow[], pick: (loan: Loan) => number): string =>
  formatCurrency(rows.reduce((sum, r) => sum + pick(r.loan), 0));

// The principal-paid progress bar — a derived, non-sortable column shared by the
// table cell and (in a fuller form) the card.
const PrincipalPaidBar = ({ pct }: { pct: number }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 120 }}>
    <LinearProgress variant="determinate" value={pct} sx={{ flexGrow: 1 }} />
    <Typography variant="caption" sx={{ minWidth: 32 }}>
      {Math.round(pct)}%
    </Typography>
  </Box>
);

const LOAN_COLUMNS: HoldingColumn<LoanRow>[] = [
  {
    id: 'Name',
    label: 'Name',
    numeric: false,
    value: (r) => r.loan.Name,
    render: (r) => r.loan.Name,
    footer: () => <strong>Totals</strong>,
  },
  {
    id: 'Provider',
    label: 'Provider',
    numeric: false,
    value: (r) => r.loan.Provider,
    render: (r) => r.loan.Provider,
  },
  {
    id: 'Principal',
    label: 'Principal',
    numeric: true,
    value: (r) => r.loan.Principal,
    render: (r) => formatCurrency(r.loan.Principal),
    footer: (rows) => <strong>{sumBy(rows, (l) => l.Principal)}</strong>,
  },
  {
    id: 'CurrentAmount',
    label: 'Current Balance',
    numeric: true,
    value: (r) => r.loan.CurrentAmount,
    render: (r) => formatCurrency(r.loan.CurrentAmount),
    footer: (rows) => <strong>{sumBy(rows, (l) => l.CurrentAmount)}</strong>,
  },
  {
    id: 'InterestRate',
    label: 'Interest Rate',
    numeric: true,
    value: (r) => r.loan.InterestRate,
    render: (r) => formatPercent(r.loan.InterestRate),
  },
  {
    id: 'MonthlyPayment',
    label: 'Monthly Payment',
    numeric: true,
    value: (r) => r.loan.MonthlyPayment ?? 0,
    render: (r) => formatCurrency(r.loan.MonthlyPayment || 0),
    footer: (rows) => (
      <strong>{sumBy(rows, (l) => l.MonthlyPayment ?? 0)}</strong>
    ),
  },
  {
    id: 'Payoff',
    label: 'Payoff',
    numeric: true,
    // Loans that never pay off sort last in ascending order.
    value: (r) => r.payoffDate?.getTime() ?? Infinity,
    render: (r) => formatPayoff(r.payoffDate),
  },
  {
    id: 'PrincipalPaid',
    label: 'Principal Paid',
    numeric: false,
    sortable: false,
    render: (r) => <PrincipalPaidBar pct={r.principalPaidPct} />,
  },
];

// Stable accessors for HoldingTable's effect/memo dependencies.
const loanRowId = (row: LoanRow): string => row.loan.Id;
const loanSearchFields = (row: LoanRow): string[] => [
  row.loan.Name,
  row.loan.Provider,
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
      principalPaidPct: principalPaidValue(loan),
    }));
  }, [props.loans, today]);

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

      <HoldingTable<LoanRow>
        items={rows}
        getRowId={loanRowId}
        searchFields={loanSearchFields}
        columns={LOAN_COLUMNS}
        getRowName={(r) => r.loan.Name}
        rowActions={(r) => loanActions(r.loan, handlers)}
        renderCard={({ item, selected, onSelect }) => (
          <LoanCard
            row={item}
            handlers={handlers}
            selected={selected}
            onSelect={onSelect}
          />
        )}
        // Default ordering mirrors how the optimizer reasons: highest rate first.
        defaultSortColumnId="InterestRate"
        searchLabel="Search loans"
        itemLabel="loan"
        itemLabelPlural="loans"
        onBulkDuplicate={(rows) =>
          rows.forEach((r) => props.onLoanClone(r.loan))
        }
        onBulkDelete={(rows) => props.onLoanBulkDelete(rows.map((r) => r.loan))}
      />
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
