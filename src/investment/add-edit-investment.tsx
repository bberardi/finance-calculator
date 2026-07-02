import {
  Alert,
  Box,
  Button,
  Checkbox,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
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
  isInvestmentValid,
  validateInvestment,
} from '../helpers/validation-helpers';
import { fieldHelperText } from '../components/field-helper-text';
import { useFieldTracking } from '../hooks/use-field-tracking';

export const AddEditInvestment = (props: AddEditInvestmentProps) => {
  const [newInvestment, setNewInvestment] =
    useState<Investment>(emptyInvestment);
  // Opt-in toggle for the employer-match fields (ROADMAP 8.1). Independent of
  // recurring contributions, so the optimizer can be told about a match on a
  // 401(k) the user isn't funding yet but might.
  const [hasEmployerMatch, setHasEmployerMatch] = useState(false);

  const hasRecurringContribution =
    typeof newInvestment.RecurringContribution === 'number' &&
    newInvestment.RecurringContribution > 0;

  const validation = useMemo(
    () => validateInvestment(newInvestment),
    [newInvestment]
  );
  const isFormValid = () => isInvestmentValid(newInvestment);

  // Touched / submit-attempt reveal logic + the save-disabled explanation,
  // shared with the loan form (see use-field-tracking).
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
    // Edit reuses the passed entity; an import seeds add-mode from
    // `initialValues` (name/provider/starting balance pre-filled); a plain add
    // starts empty.
    const seeded = props.investment ?? props.initialValues ?? emptyInvestment;
    setNewInvestment(seeded);
    setHasEmployerMatch(
      Boolean(
        seeded.EmployerMatchRate ||
        seeded.EmployerMatchLimitPct ||
        seeded.AnnualSalary
      )
    );
    resetTracking();
  }, [props.investment, props.initialValues, props.open, resetTracking]);

  // Toggling the match off clears its inputs so nothing partial is saved.
  const onToggleEmployerMatch = (checked: boolean) => {
    setHasEmployerMatch(checked);
    if (!checked) {
      setNewInvestment((prev) => ({
        ...prev,
        EmployerMatchRate: undefined,
        EmployerMatchLimitPct: undefined,
        AnnualSalary: undefined,
      }));
    }
  };

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
          <NumericFormat
            label="Current Value (Optional)"
            value={newInvestment.CurrentValue ?? ''}
            thousandSeparator
            decimalScale={2}
            prefix={'$'}
            customInput={TextField}
            onValueChange={(vs) => {
              // Leave undefined when blank so the forecast falls back to the
              // value projected to today (preserving prior behavior); set it to
              // anchor the forecast to today's actual value, like a loan's
              // Current Amount. (#110)
              setNewInvestment({
                ...newInvestment,
                CurrentValue: vs.value ? Number(vs.value) : undefined,
              });
            }}
            onBlur={() => touch('CurrentValue')}
            error={Boolean(errorFor('CurrentValue'))}
            helperText={fieldHelperText(
              errorFor('CurrentValue'),
              warningFor('CurrentValue')
            )}
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
            onBlur={() => touch('RecurringContribution')}
            error={Boolean(errorFor('RecurringContribution'))}
            helperText={fieldHelperText(
              errorFor('RecurringContribution'),
              warningFor('RecurringContribution')
            )}
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

          <Divider sx={{ my: 1 }} />
          <FormControlLabel
            control={
              <Checkbox
                checked={hasEmployerMatch}
                onChange={(e) => onToggleEmployerMatch(e.target.checked)}
              />
            }
            label="Employer 401(k) match"
          />
          {hasEmployerMatch && (
            <>
              <NumericFormat
                label="Employer match"
                value={newInvestment.EmployerMatchRate ?? ''}
                thousandSeparator
                decimalScale={2}
                suffix={'%'}
                allowNegative={false}
                customInput={TextField}
                onValueChange={(vs) =>
                  setNewInvestment({
                    ...newInvestment,
                    EmployerMatchRate: vs.value ? Number(vs.value) : undefined,
                  })
                }
                onBlur={() => touch('EmployerMatchRate')}
                error={Boolean(errorFor('EmployerMatchRate'))}
                helperText={
                  fieldHelperText(
                    errorFor('EmployerMatchRate'),
                    warningFor('EmployerMatchRate')
                  ) ?? 'Employer adds this % of your contributions.'
                }
              />
              <NumericFormat
                label="Up to this % of salary"
                value={newInvestment.EmployerMatchLimitPct ?? ''}
                thousandSeparator
                decimalScale={2}
                suffix={'%'}
                allowNegative={false}
                customInput={TextField}
                onValueChange={(vs) =>
                  setNewInvestment({
                    ...newInvestment,
                    EmployerMatchLimitPct: vs.value
                      ? Number(vs.value)
                      : undefined,
                  })
                }
                onBlur={() => touch('EmployerMatchLimitPct')}
                error={Boolean(errorFor('EmployerMatchLimitPct'))}
                helperText={
                  fieldHelperText(
                    errorFor('EmployerMatchLimitPct'),
                    warningFor('EmployerMatchLimitPct')
                  ) ??
                  'The match applies to your contributions up to this share of salary each year.'
                }
              />
              <NumericFormat
                label="Annual salary"
                value={newInvestment.AnnualSalary ?? ''}
                thousandSeparator
                decimalScale={2}
                prefix={'$'}
                allowNegative={false}
                customInput={TextField}
                onValueChange={(vs) =>
                  setNewInvestment({
                    ...newInvestment,
                    AnnualSalary: vs.value ? Number(vs.value) : undefined,
                  })
                }
                onBlur={() => touch('AnnualSalary')}
                error={Boolean(errorFor('AnnualSalary'))}
                helperText={
                  fieldHelperText(
                    errorFor('AnnualSalary'),
                    warningFor('AnnualSalary')
                  ) ?? 'Used only to size the match cap — not stored as income.'
                }
              />
            </>
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
  // Add-mode prefill (e.g. configuring an account chosen as Investment during
  // Monarch import). Ignored when `investment` is set (edit mode); the form still
  // treats this as an add, so onSave receives no `oldInvestment`.
  initialValues?: Investment;
}
