import {
  Alert,
  Box,
  Button,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  MenuItem,
  FormControl,
  FormHelperText,
  InputLabel,
  Select,
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import {
  emptyInvestment,
  Investment,
  CompoundingFrequency,
  StepUpType,
} from '../models/investment-model';
import { DatePicker } from '@mui/x-date-pickers';
import dayjs from 'dayjs';
import { NumericFormat } from 'react-number-format';
import { ResponsiveDialog } from '../components/responsive-dialog';
import {
  InvestmentField,
  isInvestmentValid,
  validateInvestment,
} from '../helpers/validation-helpers';
import { fieldHelperText } from '../components/field-helper-text';

export const AddEditInvestment = (props: AddEditInvestmentProps) => {
  const [newInvestment, setNewInvestment] =
    useState<Investment>(emptyInvestment);
  // Reveal a field's error only once it's touched or a save was attempted, so an
  // untouched add form doesn't open all-red.
  const [touched, setTouched] = useState<
    Partial<Record<InvestmentField, boolean>>
  >({});
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const hasRecurringContribution =
    typeof newInvestment.RecurringContribution === 'number' &&
    newInvestment.RecurringContribution > 0;

  const validation = useMemo(
    () => validateInvestment(newInvestment),
    [newInvestment]
  );
  const isFormValid = () => isInvestmentValid(newInvestment);

  const showFor = (field: InvestmentField) => submitAttempted || touched[field];
  const touch = (field: InvestmentField) =>
    setTouched((prev) => ({ ...prev, [field]: true }));
  const errorFor = (field: InvestmentField) =>
    showFor(field) ? validation.errors[field] : undefined;
  const warningFor = (field: InvestmentField) =>
    showFor(field) ? validation.warnings[field] : undefined;

  const resetTracking = () => {
    setTouched({});
    setSubmitAttempted(false);
  };

  // Why Save is disabled, always visible while invalid. Lists revealed errors
  // once fields are touched/save attempted; otherwise a neutral prompt.
  const revealedErrors = (Object.keys(validation.errors) as InvestmentField[])
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
    props.onSave(newInvestment, props.investment);
    props.onClose();
    setNewInvestment(emptyInvestment);
    resetTracking();
  };

  const onCancel = () => {
    props.onClose();
    resetTracking();
  };

  useEffect(() => {
    setNewInvestment(props.investment ?? emptyInvestment);
    setTouched({});
    setSubmitAttempted(false);
  }, [props.investment, props.open]);

  return (
    <ResponsiveDialog open={props.open} onClose={props.onClose}>
      <DialogTitle sx={{ textAlign: 'center' }}>
        {!props.investment ? 'Add Investment' : 'Edit Investment'}
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
            label="Investment Name"
            value={newInvestment.Name}
            onChange={(e) =>
              setNewInvestment({ ...newInvestment, Name: e.target.value })
            }
            onBlur={() => touch('Name')}
            error={Boolean(errorFor('Name'))}
            helperText={fieldHelperText(errorFor('Name'), warningFor('Name'))}
            required
          />
          <TextField
            label="Provider"
            value={newInvestment.Provider}
            onChange={(e) =>
              setNewInvestment({ ...newInvestment, Provider: e.target.value })
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
            label="Starting Balance"
            value={newInvestment.StartingBalance}
            thousandSeparator
            decimalScale={2}
            prefix={'$'}
            customInput={TextField}
            onValueChange={(vs) => {
              setNewInvestment({
                ...newInvestment,
                StartingBalance: Number(vs.value),
              });
            }}
            onBlur={() => touch('StartingBalance')}
            error={Boolean(errorFor('StartingBalance'))}
            helperText={fieldHelperText(
              errorFor('StartingBalance'),
              warningFor('StartingBalance')
            )}
            required
          />
          <DatePicker
            label="Start Date"
            value={dayjs(newInvestment.StartDate)}
            onChange={(date) => {
              touch('StartDate');
              setNewInvestment({
                ...newInvestment,
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
          <NumericFormat
            label="Average Return Rate"
            value={newInvestment.AverageReturnRate}
            thousandSeparator
            decimalScale={3}
            suffix={'%'}
            customInput={TextField}
            onValueChange={(vs) => {
              setNewInvestment({
                ...newInvestment,
                AverageReturnRate: Number(vs.value),
              });
            }}
            onBlur={() => touch('AverageReturnRate')}
            error={Boolean(errorFor('AverageReturnRate'))}
            helperText={fieldHelperText(
              errorFor('AverageReturnRate'),
              warningFor('AverageReturnRate')
            )}
            required
          />
          <FormControl fullWidth>
            <InputLabel>Compounding Period</InputLabel>
            <Select
              value={newInvestment.CompoundingPeriod}
              label="Compounding Period"
              onChange={(e) =>
                setNewInvestment({
                  ...newInvestment,
                  CompoundingPeriod: e.target.value as CompoundingFrequency,
                })
              }
            >
              {Object.entries(CompoundingFrequency).map(([key, value]) => (
                <MenuItem key={key} value={value}>
                  {key}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <NumericFormat
            label="Recurring Contribution (Optional)"
            value={newInvestment.RecurringContribution || ''}
            thousandSeparator
            decimalScale={2}
            prefix={'$'}
            customInput={TextField}
            onValueChange={(vs) => {
              const hasContribution = Boolean(vs.value);
              // Reveal the cadence/step-up sanity warnings once contributions
              // are active, since their fields may keep their default values.
              if (hasContribution) {
                touch('ContributionFrequency');
                touch('ContributionStepUpAmount');
              }
              setNewInvestment({
                ...newInvestment,
                RecurringContribution: hasContribution
                  ? Number(vs.value)
                  : undefined,
                ContributionStepUpType: hasContribution
                  ? newInvestment.ContributionStepUpType
                  : undefined,
                ContributionStepUpAmount: hasContribution
                  ? newInvestment.ContributionStepUpAmount
                  : undefined,
              });
            }}
          />
          {hasRecurringContribution && (
            <FormControl fullWidth>
              <InputLabel>Contribution Frequency</InputLabel>
              <Select
                value={
                  newInvestment.ContributionFrequency ||
                  CompoundingFrequency.Monthly
                }
                label="Contribution Frequency"
                onChange={(e) => {
                  touch('ContributionFrequency');
                  setNewInvestment({
                    ...newInvestment,
                    ContributionFrequency: e.target
                      .value as CompoundingFrequency,
                  });
                }}
              >
                {Object.entries(CompoundingFrequency).map(([key, value]) => (
                  <MenuItem key={key} value={value}>
                    {key}
                  </MenuItem>
                ))}
              </Select>
              {warningFor('ContributionFrequency') && (
                <FormHelperText>
                  {fieldHelperText(
                    undefined,
                    warningFor('ContributionFrequency')
                  )}
                </FormHelperText>
              )}
            </FormControl>
          )}
          {hasRecurringContribution && (
            <FormControl fullWidth>
              <InputLabel>Yearly Step-Up Type (Optional)</InputLabel>
              <Select
                value={newInvestment.ContributionStepUpType || ''}
                label="Yearly Step-Up Type (Optional)"
                onChange={(e) =>
                  setNewInvestment({
                    ...newInvestment,
                    ContributionStepUpType: e.target.value
                      ? (e.target.value as StepUpType)
                      : undefined,
                    ContributionStepUpAmount: e.target.value
                      ? newInvestment.ContributionStepUpAmount
                      : undefined,
                  })
                }
              >
                <MenuItem value="">None</MenuItem>
                {Object.entries(StepUpType).map(([key, value]) => (
                  <MenuItem key={key} value={value}>
                    {key}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          {hasRecurringContribution && newInvestment.ContributionStepUpType && (
            <NumericFormat
              label={
                newInvestment.ContributionStepUpType === StepUpType.Flat
                  ? 'Yearly Step-Up Amount'
                  : 'Yearly Step-Up Percentage'
              }
              value={newInvestment.ContributionStepUpAmount || ''}
              thousandSeparator
              decimalScale={2}
              allowNegative={false}
              prefix={
                newInvestment.ContributionStepUpType === StepUpType.Flat
                  ? '$'
                  : undefined
              }
              suffix={
                newInvestment.ContributionStepUpType === StepUpType.Percentage
                  ? '%'
                  : undefined
              }
              customInput={TextField}
              onValueChange={(vs) => {
                touch('ContributionStepUpAmount');
                setNewInvestment({
                  ...newInvestment,
                  ContributionStepUpAmount: vs.value
                    ? Number(vs.value)
                    : undefined,
                });
              }}
              onBlur={() => touch('ContributionStepUpAmount')}
              error={Boolean(errorFor('ContributionStepUpAmount'))}
              helperText={fieldHelperText(
                errorFor('ContributionStepUpAmount'),
                warningFor('ContributionStepUpAmount')
              )}
            />
          )}
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
          {!props.investment ? 'Add Investment' : 'Save Investment'}
        </Button>
      </DialogActions>
    </ResponsiveDialog>
  );
};

export interface AddEditInvestmentProps {
  open: boolean;
  onSave: (newInvestment: Investment, oldInvestment?: Investment) => void;
  onClose: () => void;
  investment?: Investment;
}
