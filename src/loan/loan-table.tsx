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
  IconButton,
} from '@mui/material';
import { Loan } from '../models/loan-model';
import { useState } from 'react';
import { PitPopout } from './pit-popout';
import { getTerms } from '../helpers/loan-helpers';
import { Calculate, CalendarMonth, Edit } from '@mui/icons-material';
import { AmortizationPopout } from './amortization-popout';

export const LoanTable = (props: LoanTableProps) => {
  const [selectedPit, setSelectedPit] = useState<Loan | undefined>();
  const [selectedAmortization, setSelectedAmortization] = useState<
    Loan | undefined
  >();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString(undefined, {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const formatPercent = (rate: number) => {
    return (rate / 100).toLocaleString(undefined, {
      style: 'percent',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const LoanActions = ({
    loan,
    isMobile = false,
  }: {
    loan: Loan;
    isMobile?: boolean;
  }) => (
    <Box
      sx={{
        display: 'flex',
        justifyContent: isMobile ? 'space-around' : 'flex-start',
        gap: isMobile ? 0 : 1,
      }}
    >
      <IconButton
        onClick={() => setSelectedAmortization(loan)}
        color="primary"
        size={isMobile ? 'medium' : 'small'}
        title="View Amortization Schedule"
      >
        <CalendarMonth />
      </IconButton>
      <IconButton
        onClick={() => setSelectedPit(loan)}
        color="primary"
        size={isMobile ? 'medium' : 'small'}
        title="Point-in-Time Calculator"
      >
        <Calculate />
      </IconButton>
      <IconButton
        onClick={() => props.onLoanEdit(loan)}
        color="primary"
        size={isMobile ? 'medium' : 'small'}
        title="Edit Loan"
      >
        <Edit />
      </IconButton>
    </Box>
  );

  const LoanCard = ({ loan }: { loan: Loan }) => (
    <Card sx={{ marginBottom: 2 }}>
      <CardContent>
        <Typography variant="h6" component="div" gutterBottom>
          {loan.Name}
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          {loan.Provider}
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={6}>
            <Typography variant="body2">
              <strong>Principal:</strong> {formatCurrency(loan.Principal)}
            </Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="body2">
              <strong>Current:</strong> {formatCurrency(loan.CurrentAmount)}
            </Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="body2">
              <strong>Interest:</strong> {formatPercent(loan.InterestRate)}
            </Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="body2">
              <strong>Payment:</strong>{' '}
              {formatCurrency(loan.MonthlyPayment || 0)}
            </Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="body2">
              <strong>Terms:</strong> {getTerms(loan)} months
            </Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="body2">
              <strong>End Date:</strong> {loan.EndDate.toLocaleDateString()}
            </Typography>
          </Grid>
        </Grid>
        <Box sx={{ marginTop: 2 }}>
          <LoanActions loan={loan} isMobile={true} />
        </Box>
      </CardContent>
    </Card>
  );

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
            <LoanCard key={loan.Name} loan={loan} />
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
                <TableRow key={row.Name}>
                  <TableCell>{row.Name}</TableCell>
                  <TableCell>{row.Provider}</TableCell>
                  <TableCell>{formatCurrency(row.Principal)}</TableCell>
                  <TableCell>{formatPercent(row.InterestRate)}</TableCell>
                  <TableCell>
                    {formatCurrency(row.MonthlyPayment || 0)}
                  </TableCell>
                  <TableCell>{getTerms(row)} months</TableCell>
                  <TableCell>
                    <LoanActions loan={row} />
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
};
