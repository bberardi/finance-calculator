import {
  Alert,
  Box,
  Button,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormHelperText,
  Slider,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useMemo, useRef, useState } from 'react';
import { emptyLoan, Loan } from '../models/loan-model';
import { DatePicker } from '@mui/x-date-pickers';
import dayjs from 'dayjs';
import { getMonthlyPayment, getTerms } from '../helpers/loan-helpers';
import { NumericFormat } from 'react-number-format';
import { ResponsiveDialog } from '../components/responsive-dialog';
import {
  isLoanValid,
  LOAN_RATE_WARNING_THRESHOLD,
  validateLoan,
} from '../helpers/validation-helpers';
import { fieldHelperText } from '../components/field-helper-text';
import { useFieldTracking } from '../hooks/use-field-tracking';

export const AddEditLoan = (props: AddEditLoanProps) => {
  const [newLoan, setNewLoan] = useState<Loan>(emptyLoan);

  const validation = useMemo(() => validateLoan(newLoan), [newLoan]);
  const isFormValid = () => isLoanValid(newLoan);

  // Touched / submit-attempt reveal logic + the save-disabled explanation,
  // shared with the investment form (see use-field-tracking).
  const {
    touch,
    errorFor,
    warningFor,
    resetTracking,
    markSubmitAttempted,
    saveDisabledReason,
  } = useFieldTracking(validation);

  const onSave = () => {
    if (!isFormValid()) {
      markSubmitAttempted();
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

  // When the dialog opens to EDIT an existing loan, the driving fields below
  // transition from emptyLoan defaults to the loaded values, which would
  // otherwise trigger the auto-recompute effect and clobber the loan's stored
  // MonthlyPayment. Suppress that one recompute so a saved/custom payment
  // survives opening the editor. (#56)
  //
  // Only suppress when the loaded loan actually carries a usable (positive)
  // payment. An imported loan can arrive with MonthlyPayment absent or 0 — the
  // JSON import boundary allows it and the forecast derives an effective payment
  // — but validateLoan requires MonthlyPayment > 0, so suppressing the recompute
  // there would leave Save permanently disabled and trap the loan as uneditable.
  // Letting the recompute run fills in the derived payment so the round-trip
  // (import → edit → save) works, matching the engine's "derive when unset"
  // behavior. (#94)
  const skipNextPaymentRecompute = useRef(false);

  useEffect(() => {
    // Edit reuses the passed loan; a conversion (Add Liability → "Convert to
    // loan") seeds add-mode from `initialValues`; a plain add starts empty.
    setNewLoan(props.loan ?? props.initialValues ?? emptyLoan);
    resetTracking();
    skipNextPaymentRecompute.current =
      typeof props.loan?.MonthlyPayment === 'number' &&
      props.loan.MonthlyPayment > 0;
  }, [props.loan, props.initialValues, props.open, resetTracking]);

  useEffect(() => {
    if (skipNextPaymentRecompute.current) {
      skipNextPaymentRecompute.current = false;
      return;
    }
    // Guard on "rate is a valid non-negative number" rather than truthiness:
    // a 0% (interest-free) loan is a first-class, supported input, but `0` is
    // falsy, so a truthiness check skipped the recompute entirely — leaving the
    // payment at $0 (blocking Save) for a new 0% loan, and keeping a stale
    // payment when an existing loan's rate was changed to 0%. getMonthlyPayment
    // already returns principal / terms for a 0% rate. (#79)
    if (
      newLoan.Principal > 0 &&
      newLoan.InterestRate >= 0 &&
      newLoan.StartDate &&
      newLoan.EndDate
    ) {
      setNewLoan((prev) => ({
        ...prev,
        MonthlyPayment: getMonthlyPayment(
          prev.Principal,
          prev.InterestRate,
          getTerms(prev)
        ),
      }));
    }
  }, [
    newLoan.Principal,
    newLoan.InterestRate,
    newLoan.StartDate,
    newLoan.EndDate,
  ]);

  // An optional dollar input for the "true monthly payment" fields (Phase 8.3).
  // An empty field clears back to undefined so the loan stays without the field
  // (absent = $0), rather than persisting a literal 0.
  const optionalDollarField = (
    field:
      | 'HomeValue'
      | 'PropertyTaxAnnual'
      | 'HomeInsuranceAnnual'
      | 'MonthlyPmi',
    label: string
  ) => (
    <NumericFormat
      label={label}
      value={newLoan[field] ?? ''}
      thousandSeparator
      decimalScale={2}
      prefix={'$'}
      allowNegative={false}
      customInput={TextField}
      fullWidth
      placeholder="$0"
      onValueChange={(vs) =>
        setNewLoan({
          ...newLoan,
          [field]: vs.value === '' ? undefined : Number(vs.value),
        })
      }
      onBlur={() => touch(field)}
      error={Boolean(errorFor(field))}
      helperText={fieldHelperText(errorFor(field), warningFor(field))}
    />
  );

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
              onChange={(e) => {
                // Ignore empty / non-numeric / sub-1 input so the field can't
                // drive EndDate before StartDate or to an Invalid Date (which
                // would propagate NaN through getTerms / MonthlyPayment). (#52)
                const n = Number(e.target.value);
                if (!Number.isFinite(n) || n < 1) {
                  return;
                }
                setNewLoan({
                  ...newLoan,
                  EndDate: dayjs(newLoan.StartDate)
                    .add(n - 1, 'months')
                    .toDate(),
                });
              }}
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
                // Headroom above the warning threshold so the slider can
                // actually reach a rate that trips the "unusually high" warning,
                // and so the ceiling tracks the threshold instead of drifting.
                max={LOAN_RATE_WARNING_THRESHOLD + 10}
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

          <Divider textAlign="left">Housing costs (escrow &amp; PMI)</Divider>
          <Typography variant="body2" color="text.secondary" sx={{ mt: -1 }}>
            Optional. Property tax, insurance, and PMI form the “true monthly
            payment” shown in your monthly commitments — they don’t pay down the
            balance, and PMI drops off at 80% loan-to-value.
          </Typography>
          {optionalDollarField('HomeValue', 'Home value')}
          <Stack direction="row" spacing={1}>
            {optionalDollarField('PropertyTaxAnnual', 'Property tax (annual)')}
            {optionalDollarField('HomeInsuranceAnnual', 'Insurance (annual)')}
          </Stack>
          {optionalDollarField('MonthlyPmi', 'PMI (monthly)')}
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
  // Add-mode prefill (e.g. converting a custom liability into a loan). Ignored
  // when `loan` is set (edit mode). The form still treats this as an add, so
  // onSave receives no `oldLoan` and the entity gets a fresh Id.
  initialValues?: Loan;
}
