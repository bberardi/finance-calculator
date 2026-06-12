import {
  Alert,
  Box,
  Button,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormHelperText,
  Slider,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { emptyLoan, Loan } from '../models/loan-model';
import { DatePicker } from '@mui/x-date-pickers';
import dayjs from 'dayjs';
import { getMonthlyPayment, getTerms } from '../helpers/loan-helpers';
import { NumericFormat } from 'react-number-format';
import { ResponsiveDialog } from '../components/responsive-dialog';
import {
  isLoanValid,
  LoanField,
  validateLoan,
} from '../helpers/validation-helpers';
import { fieldHelperText } from '../components/field-helper-text';

export const AddEditLoan = (props: AddEditLoanProps) => {
  const [newLoan, setNewLoan] = useState<Loan>(emptyLoan);
  // Track which fields the user has interacted with, plus a save-attempt flag,
  // so an untouched add form doesn't open all-red. A field's error shows once it
  // is touched OR a save has been attempted.
  const [touched, setTouched] = useState<Partial<Record<LoanField, boolean>>>(
    {}
  );
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const validation = useMemo(() => validateLoan(newLoan), [newLoan]);
  const isFormValid = () => isLoanValid(newLoan);

  const showFor = (field: LoanField) => submitAttempted || touched[field];
  const touch = (field: LoanField) =>
    setTouched((prev) => ({ ...prev, [field]: true }));
  const errorFor = (field: LoanField) =>
    showFor(field) ? validation.errors[field] : undefined;
  const warningFor = (field: LoanField) =>
    showFor(field) ? validation.warnings[field] : undefined;

  const resetTracking = () => {
    setTouched({});
    setSubmitAttempted(false);
  };

  // Why Save is disabled, always visible while invalid. Once the user has
  // touched fields (or attempted save) we list the specific revealed errors;
  // before that we show a neutral prompt so the form doesn't open all-red but
  // the user still knows what's expected.
  const revealedErrors = (Object.keys(validation.errors) as LoanField[])
    .filter((field) => showFor(field))
    .map((field) => validation.errors[field]);
  const saveDisabledReason =
    revealedErrors.length > 0
      ? revealedErrors.join(' ')
      : 'Fill in all required fields to enable saving.';

  const onSave = () => {
    if (!isFormValid()) {
      setSubmitAttempted(true);
      return;
    }
    props.onSave(newLoan, props.loan);
    props.onClose();
    setNewLoan(emptyLoan);
    resetTracking();
  };

  const onCancel = () => {
    props.onClose();
    resetTracking();
  };

  useEffect(() => {
    setNewLoan(props.loan ?? emptyLoan);
    setTouched({});
    setSubmitAttempted(false);
  }, [props.loan, props.open]);

  useEffect(() => {
    if (
      newLoan.Principal &&
      newLoan.InterestRate &&
      newLoan.StartDate &&
      newLoan.EndDate
    ) {
      setNewLoan({
        ...newLoan,
        MonthlyPayment: getMonthlyPayment(
          newLoan.Principal,
          newLoan.InterestRate,
          getTerms(newLoan)
        ),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    newLoan.Principal,
    newLoan.InterestRate,
    newLoan.StartDate,
    newLoan.EndDate,
  ]);

  return (
    <ResponsiveDialog open={props.open} onClose={props.onClose}>
      <DialogTitle sx={{ textAlign: 'center' }}>
        {!props.loan ? 'Add new loan' : 'Edit loan'}
      </DialogTitle>
      <DialogContent>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            mt: 1,
          }}
        >
          <TextField
            label="Name"
            value={newLoan.Name}
            onChange={(e) => setNewLoan({ ...newLoan, Name: e.target.value })}
            onBlur={() => touch('Name')}
            error={Boolean(errorFor('Name'))}
            helperText={fieldHelperText(errorFor('Name'), warningFor('Name'))}
            required
          />
          <TextField
            label="Loan Provider"
            value={newLoan.Provider}
            onChange={(e) =>
              setNewLoan({ ...newLoan, Provider: e.target.value })
            }
            onBlur={() => touch('Provider')}
            error={Boolean(errorFor('Provider'))}
            helperText={fieldHelperText(
              errorFor('Provider'),
              warningFor('Provider')
            )}
            required
          />
          <NumericFormat
            label="Principal"
            value={newLoan.Principal}
            thousandSeparator
            decimalScale={2}
            prefix={'$'}
            customInput={TextField}
            onValueChange={(vs) => {
              setNewLoan({ ...newLoan, Principal: Number(vs.value) });
            }}
            onBlur={() => touch('Principal')}
            error={Boolean(errorFor('Principal'))}
            helperText={fieldHelperText(
              errorFor('Principal'),
              warningFor('Principal')
            )}
            required
          />
          <NumericFormat
            label="Current Amount"
            value={newLoan.CurrentAmount}
            thousandSeparator
            decimalScale={2}
            prefix={'$'}
            customInput={TextField}
            onValueChange={(vs) => {
              setNewLoan({ ...newLoan, CurrentAmount: Number(vs.value) });
            }}
            onBlur={() => touch('CurrentAmount')}
            error={Boolean(errorFor('CurrentAmount'))}
            helperText={fieldHelperText(
              errorFor('CurrentAmount'),
              warningFor('CurrentAmount')
            )}
            required
          />
          <DatePicker
            label="Start Date"
            value={dayjs(newLoan.StartDate)}
            onChange={(date) => {
              touch('StartDate');
              setNewLoan({
                ...newLoan,
                StartDate: date?.toDate() ?? new Date(),
              });
            }}
            views={['year', 'month', 'day']}
            openTo="day"
            slotProps={{
              textField: {
                onBlur: () => touch('StartDate'),
                error: Boolean(errorFor('StartDate')),
                helperText: fieldHelperText(
                  errorFor('StartDate'),
                  warningFor('StartDate')
                ),
              },
            }}
          />
          <Stack direction="row" spacing={1}>
            <DatePicker
              label="End Date"
              value={dayjs(newLoan.EndDate)}
              onChange={(date) => {
                touch('EndDate');
                setNewLoan({
                  ...newLoan,
                  EndDate: date?.toDate() ?? new Date(),
                });
              }}
              views={['year', 'month', 'day']}
              openTo="year"
              sx={{ flex: 5 }}
              slotProps={{
                textField: {
                  onBlur: () => touch('EndDate'),
                  error: Boolean(errorFor('EndDate')),
                  helperText: fieldHelperText(
                    errorFor('EndDate'),
                    warningFor('EndDate')
                  ),
                },
              }}
            />
            <TextField
              label="Terms"
              value={getTerms(newLoan)}
              onChange={(e) =>
                setNewLoan({
                  ...newLoan,
                  EndDate: dayjs(newLoan.StartDate)
                    .add(Number(e.target.value) - 1, 'months')
                    .toDate(),
                })
              }
              sx={{ flex: 2 }}
            />
          </Stack>
          <Stack>
            <Typography gutterBottom>Interest Percentage</Typography>
            <Stack
              direction="row"
              spacing={1}
              sx={{
                alignItems: 'center',
              }}
            >
              <Slider
                value={newLoan.InterestRate}
                onChange={(_e, newValue) =>
                  setNewLoan({
                    ...newLoan,
                    InterestRate: Array.isArray(newValue)
                      ? newValue[0]
                      : newValue,
                  })
                }
                valueLabelDisplay="auto"
                step={0.25}
                min={0}
                max={30}
                sx={{ flex: 5 }}
              />
              <NumericFormat
                label="Interest Rate"
                value={newLoan.InterestRate}
                thousandSeparator
                decimalScale={3}
                suffix={'%'}
                customInput={TextField}
                onValueChange={(vs) => {
                  setNewLoan({
                    ...newLoan,
                    InterestRate: Number(vs.value),
                  });
                }}
                onBlur={() => touch('InterestRate')}
                error={Boolean(errorFor('InterestRate'))}
                sx={{ flex: 2 }}
                required
              />
            </Stack>
            {(errorFor('InterestRate') || warningFor('InterestRate')) && (
              <FormHelperText error={Boolean(errorFor('InterestRate'))}>
                {fieldHelperText(
                  errorFor('InterestRate'),
                  warningFor('InterestRate')
                )}
              </FormHelperText>
            )}
          </Stack>

          <Stack direction="row">
            <NumericFormat
              label="Monthly Payment"
              value={newLoan.MonthlyPayment}
              thousandSeparator
              decimalScale={2}
              prefix={'$'}
              customInput={TextField}
              onValueChange={(vs) => {
                setNewLoan({ ...newLoan, MonthlyPayment: Number(vs.value) });
              }}
              sx={{ flex: 6 }}
              required
            />
            <Button
              onClick={() =>
                setNewLoan({
                  ...newLoan,
                  MonthlyPayment: getMonthlyPayment(
                    newLoan.Principal,
                    newLoan.InterestRate,
                    getTerms(newLoan)
                  ),
                })
              }
              sx={{ flex: 1 }}
            >
              Reset
            </Button>
          </Stack>
        </Box>
      </DialogContent>
      <Box sx={{ px: 3 }}>
        {!isFormValid() && (
          <Alert severity="info" sx={{ mb: 1 }}>
            {saveDisabledReason}
          </Alert>
        )}
      </Box>
      <DialogActions>
        <Button type="reset" color="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="submit"
          variant="contained"
          color="primary"
          onClick={onSave}
          disabled={!isFormValid()}
        >
          {!props.loan ? 'Add loan' : 'Save loan'}
        </Button>
      </DialogActions>
    </ResponsiveDialog>
  );
};

export interface AddEditLoanProps {
  open: boolean;
  onSave: (newLoan: Loan, oldLoan?: Loan) => void;
  onClose: () => void;
  loan?: Loan;
}
