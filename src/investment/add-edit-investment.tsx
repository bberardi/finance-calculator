import {
  Box,
  Button,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
} from '@mui/material';
import { useEffect, useState } from 'react';
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

export const AddEditInvestment = (props: AddEditInvestmentProps) => {
  const [newInvestment, setNewInvestment] =
    useState<Investment>(emptyInvestment);

  const hasRecurringContribution =
    typeof newInvestment.RecurringContribution === 'number' &&
    newInvestment.RecurringContribution > 0;

  const isFormValid = () => {
    return (
      newInvestment.Name.trim() !== '' &&
      newInvestment.Provider.trim() !== '' &&
      newInvestment.StartingBalance > 0 &&
      newInvestment.AverageReturnRate >= 0 &&
      newInvestment.StartDate
    );
  };

  const onSave = () => {
    if (!isFormValid()) {
      return;
    }
    props.onSave(newInvestment, props.investment);
    props.onClose();
    setNewInvestment(emptyInvestment);
  };

  useEffect(() => {
    setNewInvestment(props.investment ?? emptyInvestment);
  }, [props.investment]);

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
            required
          />
          <TextField
            label="Provider"
            value={newInvestment.Provider}
            onChange={(e) =>
              setNewInvestment({ ...newInvestment, Provider: e.target.value })
            }
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
            required
          />
          <DatePicker
            label="Start Date"
            value={dayjs(newInvestment.StartDate)}
            onChange={(date) =>
              setNewInvestment({
                ...newInvestment,
                StartDate: date?.toDate() ?? new Date(),
              })
            }
            views={['year', 'month', 'day']}
            openTo="day"
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
                onChange={(e) =>
                  setNewInvestment({
                    ...newInvestment,
                    ContributionFrequency: e.target
                      .value as CompoundingFrequency,
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
                setNewInvestment({
                  ...newInvestment,
                  ContributionStepUpAmount: vs.value
                    ? Number(vs.value)
                    : undefined,
                });
              }}
            />
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button type="reset" color="secondary" onClick={props.onClose}>
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
