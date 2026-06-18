import {
  Box,
  DialogContent,
  DialogTitle,
  Paper,
  Table,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { Loan } from '../models/loan-model';
import { generateAmortizationSchedule } from '../helpers/loan-helpers';
import { getAmortizationTotals } from '../helpers/schedule-totals-helpers';
import { formatCurrency } from '../helpers/format-helpers';
import dayjs from 'dayjs';
import { useMemo, useRef } from 'react';
import { ResponsiveDialog } from '../components/responsive-dialog';
import { VirtualizedTableBody } from '../components/virtualized-table-body';
import { ScheduleTotalsFooter } from '../components/schedule-totals-footer';

export const AmortizationPopout = (props: AmortizationPopoutProps) => {
  const schedule = useMemo(
    () => generateAmortizationSchedule(props.loan),
    [props.loan]
  );
  const totals = useMemo(() => getAmortizationTotals(schedule), [schedule]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const startDate = props.loan.StartDate;

  return (
    <ResponsiveDialog open={!!props.loan} onClose={props.onClose} maxWidth="md">
      <DialogTitle>Amortization Schedule</DialogTitle>
      <DialogContent>
        <TableContainer
          component={Paper}
          ref={scrollRef}
          sx={{ maxHeight: '60vh', overflow: 'auto' }}
        >
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
            <VirtualizedTableBody
              scrollRef={scrollRef}
              count={schedule.length}
              colSpan={6}
              rowKey={(index) => schedule[index].Term}
              renderCells={(index) => {
                const entry = schedule[index];
                return (
                  <>
                    <TableCell>{entry.Term}</TableCell>
                    <TableCell>
                      {dayjs(startDate)
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
                    <TableCell>
                      {formatCurrency(entry.InterestPayment)}
                    </TableCell>
                    <TableCell>
                      {formatCurrency(entry.RemainingBalance)}
                    </TableCell>
                  </>
                );
              }}
            />
          </Table>
        </TableContainer>
        {schedule.length > 0 ? (
          /* Lifetime-totals footer (roadmap 6.5): pinned below the scroll area
             so it stays visible no matter where the (virtualized) table is
             scrolled. */
          <ScheduleTotalsFooter
            items={[
              { label: 'Total paid', value: formatCurrency(totals.totalPaid) },
              {
                label: 'Principal',
                value: formatCurrency(totals.totalPrincipal),
              },
              {
                label: 'Interest paid',
                value: formatCurrency(totals.totalInterest),
              },
            ]}
          />
        ) : (
          <Box sx={{ mt: 2 }}>
            <Typography color="text.secondary">
              No schedule to display — this loan has no monthly payment set.
            </Typography>
          </Box>
        )}
      </DialogContent>
    </ResponsiveDialog>
  );
};

export interface AmortizationPopoutProps {
  loan: Loan;
  onClose: () => void;
}
