import {
  Box,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { defaultPit, Loan, PitLoan } from '../models/loan-model';
import { DatePicker } from '@mui/x-date-pickers';
import dayjs from 'dayjs';
import { getPitCalculation, getTerms } from '../helpers/loan-helpers';
import {
  getMonthlyPaymentBreakdown,
  getPmiEndDate,
} from '../helpers/forecast-helpers';
import { formatCurrency } from '../helpers/format-helpers';
import { NumericFormat } from 'react-number-format';
import { ResponsiveDialog } from '../components/responsive-dialog';

export const PitPopout = (props: PitPopoutProps) => {
  const [selectedDate, setSelectedDate] = useState<Date>(props.loan.EndDate);
  const [pitLoan, setPitLoan] = useState<PitLoan>(defaultPit);

  const handleTermsChange = (newTerms: number) => {
    if (newTerms < 0) {
      setSelectedDate(dayjs(props.loan.StartDate).toDate());
    } else if (newTerms > getTerms(props.loan)) {
      setSelectedDate(dayjs(props.loan.EndDate).toDate());
    } else {
      setSelectedDate(
        dayjs(props.loan.StartDate)
          .add(newTerms - 1, 'months')
          .toDate()
      );
    }
  };

  useEffect(() => {
    if (props.loan) {
      setPitLoan(getPitCalculation(props.loan, selectedDate));
    }
  }, [props.loan, selectedDate]);

  // "True monthly payment" breakdown + PMI drop-off (Phase 8.3), a current
  // snapshot (today) independent of the projection date above. Only shown when
  // the loan carries any escrow/PMI fields, so a plain loan is unchanged.
  const today = useMemo(() => new Date(), []);
  const breakdown = useMemo(
    () => getMonthlyPaymentBreakdown(props.loan, today),
    [props.loan, today]
  );
  const pmiEndDate = useMemo(
    () => getPmiEndDate(props.loan, today),
    [props.loan, today]
  );
  const hasHousingCosts =
    (props.loan.HomeValue ?? 0) > 0 ||
    (props.loan.PropertyTaxAnnual ?? 0) > 0 ||
    (props.loan.HomeInsuranceAnnual ?? 0) > 0 ||
    (props.loan.MonthlyPmi ?? 0) > 0;

  return (
    <ResponsiveDialog open={!!props.loan} onClose={props.onClose}>
      <DialogTitle>Point-in-Time Calculator</DialogTitle>
      <DialogContent>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            mt: 1,
          }}
        >
          <Stack direction="row">
            <DatePicker
              label="Projection Date"
              value={dayjs(selectedDate)}
              onChange={(date) => setSelectedDate(date?.toDate() ?? new Date())}
              minDate={dayjs(props.loan.StartDate)}
              maxDate={dayjs(props.loan.EndDate)}
              views={['year', 'month']}
              sx={{ flex: 4 }}
            />
            <NumericFormat
              label="Terms"
              value={getTerms(props.loan, selectedDate)}
              thousandSeparator
              decimalScale={0}
              customInput={TextField}
              onValueChange={(vs) => {
                handleTermsChange(Number(vs.value));
              }}
              sx={{ flex: 2 }}
            />
          </Stack>
          <Typography>{`Paid Terms: ${pitLoan.PaidTerms}`}</Typography>
          <Typography>{`Remaining Terms: ${pitLoan.RemainingTerms}`}</Typography>
          <Typography>{`Paid Principal: ${formatCurrency(
            pitLoan.PaidPrincipal
          )}`}</Typography>
          <Typography>{`Paid Interest: ${formatCurrency(
            pitLoan.PaidInterest
          )}`}</Typography>
          <Typography>{`Remaining Principal: ${formatCurrency(
            pitLoan.RemainingPrincipal
          )}`}</Typography>

          {hasHousingCosts && (
            <>
              <Divider textAlign="left">True monthly payment</Divider>
              <Typography>{`Principal & Interest: ${formatCurrency(
                breakdown.principalAndInterest
              )}`}</Typography>
              {breakdown.escrow > 0 && (
                <Typography>{`Escrow (tax + insurance): ${formatCurrency(
                  breakdown.escrow
                )}`}</Typography>
              )}
              {(props.loan.MonthlyPmi ?? 0) > 0 && (
                <Typography>{`PMI: ${
                  breakdown.pmi > 0
                    ? formatCurrency(breakdown.pmi)
                    : '— (LTV at/below 80%)'
                }`}</Typography>
              )}
              <Typography sx={{ fontWeight: 600 }}>{`Total: ${formatCurrency(
                breakdown.total
              )}/mo`}</Typography>
              {pmiEndDate && breakdown.pmi > 0 && (
                <Typography variant="body2" color="text.secondary">
                  {`PMI drops off around ${dayjs(pmiEndDate).format(
                    'MMM YYYY'
                  )}`}
                </Typography>
              )}
            </>
          )}
        </Box>
      </DialogContent>
    </ResponsiveDialog>
  );
};

export interface PitPopoutProps {
  loan: Loan;
  onClose: () => void;
}
