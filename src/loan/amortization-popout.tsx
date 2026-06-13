import {
  DialogContent,
  DialogTitle,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import { Loan } from '../models/loan-model';
import { generateAmortizationSchedule } from '../helpers/loan-helpers';
import { formatCurrency } from '../helpers/format-helpers';
import dayjs from 'dayjs';
import { useMemo } from 'react';
import { ResponsiveDialog } from '../components/responsive-dialog';

export const AmortizationPopout = (props: AmortizationPopoutProps) => {
  const schedule = useMemo(
    () => generateAmortizationSchedule(props.loan),
    [props.loan]
  );

  return (
    <ResponsiveDialog open={!!props.loan} onClose={props.onClose} maxWidth="md">
      <DialogTitle>Amortization Schedule</DialogTitle>
      <DialogContent>
        <TableContainer component={Paper}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Term</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Monthly Payment</TableCell>
                <TableCell>Principal Portion</TableCell>
                <TableCell>Interest Portion</TableCell>
                <TableCell>Remaining Principal</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {schedule.map((entry) => (
                <TableRow key={entry.Term}>
                  <TableCell>{entry.Term}</TableCell>
                  <TableCell>
                    {dayjs(props.loan.StartDate)
                      .add(entry.Term - 1, 'months')
                      .format('YYYY/MM (MMM)')}
                  </TableCell>
                  <TableCell>
                    {formatCurrency(
                      entry.PrincipalPayment + entry.InterestPayment
                    )}
                  </TableCell>
                  <TableCell>
                    {formatCurrency(entry.PrincipalPayment)}
                  </TableCell>
                  <TableCell>{formatCurrency(entry.InterestPayment)}</TableCell>
                  <TableCell>
                    {formatCurrency(entry.RemainingBalance)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </DialogContent>
    </ResponsiveDialog>
  );
};

export interface AmortizationPopoutProps {
  loan: Loan;
  onClose: () => void;
}
