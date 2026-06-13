import {
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
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
import { useState } from 'react';
import { PitPopout } from './pit-popout';
import { getTerms } from '../helpers/loan-helpers';
import { formatCurrency, formatPercent } from '../helpers/format-helpers';
import { Calculate, CalendarMonth, Delete, Edit } from '@mui/icons-material';
import { AmortizationPopout } from './amortization-popout';
import { EntityRowActions, RowAction } from '../components/entity-row-actions';

// Callbacks a loan row/card needs. Passed down from the table so the row and
// card components can live at module scope (no remount-on-render).
interface LoanRowHandlers {
  onAmortization: (loan: Loan) => void;
  onPit: (loan: Loan) => void;
  onEdit: (loan: Loan) => void;
  onDelete: (loan: Loan) => void;
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
    icon: <Delete />,
    title: 'Delete Loan',
    onClick: () => handlers.onDelete(loan),
    color: 'error',
  },
];

const LoanCard = ({
  loan,
  handlers,
}: {
  loan: Loan;
  handlers: LoanRowHandlers;
}) => (
  <Card sx={{ marginBottom: 2 }}>
    <CardContent>
      <Typography variant="h6" component="div" gutterBottom>
        {loan.Name}
      </Typography>
      <Typography
        variant="body2"
        gutterBottom
        sx={{
          color: 'text.secondary',
        }}
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
            <strong>Payment:</strong> {formatCurrency(loan.MonthlyPayment || 0)}
          </Typography>
        </Grid>
        <Grid size={6}>
          <Typography variant="body2">
            <strong>Terms:</strong> {getTerms(loan)} months
          </Typography>
        </Grid>
        <Grid size={6}>
          <Typography variant="body2">
            <strong>End Date:</strong> {loan.EndDate.toLocaleDateString()}
          </Typography>
        </Grid>
      </Grid>
      <Box sx={{ marginTop: 2 }}>
        <EntityRowActions actions={loanActions(loan, handlers)} isMobile />
      </Box>
    </CardContent>
  </Card>
);

export const LoanTable = (props: LoanTableProps) => {
  const [selectedPit, setSelectedPit] = useState<Loan | undefined>();
  const [selectedAmortization, setSelectedAmortization] = useState<
    Loan | undefined
  >();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const handlers: LoanRowHandlers = {
    onAmortization: setSelectedAmortization,
    onPit: setSelectedPit,
    onEdit: props.onLoanEdit,
    onDelete: props.onLoanDelete,
  };

  return (
    <>
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

      {isMobile ? (
        <Box>
          {props.loans.map((loan) => (
            <LoanCard key={loan.Id} loan={loan} handlers={handlers} />
          ))}
        </Box>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Provider</TableCell>
                <TableCell>Principal</TableCell>
                <TableCell>Interest Rate</TableCell>
                <TableCell>Monthly Payment</TableCell>
                <TableCell>Terms</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {props.loans.map((row) => (
                <TableRow key={row.Id}>
                  <TableCell>{row.Name}</TableCell>
                  <TableCell>{row.Provider}</TableCell>
                  <TableCell>{formatCurrency(row.Principal)}</TableCell>
                  <TableCell>{formatPercent(row.InterestRate)}</TableCell>
                  <TableCell>
                    {formatCurrency(row.MonthlyPayment || 0)}
                  </TableCell>
                  <TableCell>{getTerms(row)} months</TableCell>
                  <TableCell>
                    <EntityRowActions actions={loanActions(row, handlers)} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
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
};
