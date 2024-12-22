import {
  Card,
  CardContent,
  Paper,
  Popover,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { Loan } from '../models/loan-model';
import { generateAmortizationSchedule } from '../helpers/loan-helpers';
import dayjs from 'dayjs';

export const AmortizationPopout = (props: AmortizationPopoutProps) => {
  const schedule =
    props.loan.AmortizationSchedule ?? generateAmortizationSchedule(props.loan);

  return (
    <Popover
      open={!!props.loan}
      onClose={props.onClose}
      anchorOrigin={{
        vertical: 'center',
        horizontal: 'center',
      }}
      transformOrigin={{
        vertical: 'center',
        horizontal: 'center',
      }}
      style={{ maxHeight: '90vh' }}
    >
      <Card>
        <CardContent>
          <Typography variant="h5" gutterBottom>
            Amortization Schedule
          </Typography>
          <TableContainer component={Paper} style={{ maxHeight: '75vh' }}>
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
                      {(
                        entry.PrincipalPayment + entry.InterestPayment
                      ).toLocaleString(undefined, {
                        style: 'currency',
                        currency: 'USD',
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </TableCell>
                    <TableCell>
                      {entry.PrincipalPayment.toLocaleString(undefined, {
                        style: 'currency',
                        currency: 'USD',
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </TableCell>
                    <TableCell>
                      {entry.InterestPayment.toLocaleString(undefined, {
                        style: 'currency',
                        currency: 'USD',
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </TableCell>
                    <TableCell>
                      {entry.RemainingBalance.toLocaleString(undefined, {
                        style: 'currency',
                        currency: 'USD',
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Popover>
  );
};

export interface AmortizationPopoutProps {
  loan: Loan;
  onClose: () => void;
}
