import {
  Box,
  Button,
  Card,
  CardContent,
  Popover,
  Stack,
  TextField,
  Typography,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { emptyInvestment, Investment, CompoundingFrequency } from '../models/investment-model';
import { DatePicker } from '@mui/x-date-pickers';
import dayjs from 'dayjs';
import { NumericFormat } from 'react-number-format';
import { Delete } from '@mui/icons-material';
import { generateInvestmentGrowth } from '../helpers/investment-helpers';

export const AddEditInvestment = (props: AddEditInvestmentProps) => {
  const [newInvestment, setNewInvestment] = useState<Investment>(emptyInvestment);

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
  };

  const onDelete = () => {
    props.onSave(emptyInvestment, props.investment);
    props.onClose();
  };

  useEffect(() => {
    setNewInvestment(props.investment ?? emptyInvestment);
  }, [props.investment]);

  useEffect(() => {
    if (
      newInvestment.StartingBalance &&
      newInvestment.AverageReturnRate >= 0 &&
      newInvestment.StartDate
    ) {
      setNewInvestment({
        ...newInvestment,
        ProjectedGrowth: generateInvestmentGrowth(newInvestment),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    newInvestment.StartingBalance,
    newInvestment.AverageReturnRate,
    newInvestment.StartDate,
    newInvestment.CompoundingPeriod,
    newInvestment.RecurringContribution,
    newInvestment.ContributionFrequency,
  ]);

  return (
    <Popover
      open={props.open}
      anchorReference="none"
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      slotProps={{
        paper: {
          sx: {
            backgroundColor: 'rgba(0, 0, 0, 0.1)',
            width: { xs: '95vw', sm: '90vw', md: '600px' },
            maxWidth: '600px',
            maxHeight: { xs: '95vh', sm: '90vh' },
            overflow: 'auto',
          },
        },
      }}
    >
      <Card sx={{ width: '100%', margin: { xs: '10px', sm: '20px' } }}>
        <CardContent>
          <Typography variant="h6" component="div" sx={{ marginBottom: '15px' }}>
            {!props.investment ? 'Add Investment' : 'Edit Investment'}
          </Typography>
          <Box
            component="form"
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
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
                setNewInvestment({ ...newInvestment, StartingBalance: Number(vs.value) });
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
                <MenuItem value={CompoundingFrequency.Monthly}>Monthly</MenuItem>
                <MenuItem value={CompoundingFrequency.Quarterly}>Quarterly</MenuItem>
                <MenuItem value={CompoundingFrequency.Annually}>Annually</MenuItem>
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
                setNewInvestment({ 
                  ...newInvestment, 
                  RecurringContribution: vs.value ? Number(vs.value) : undefined 
                });
              }}
            />
              {newInvestment.RecurringContribution && newInvestment.RecurringContribution > 0 && (
              <FormControl fullWidth>
                <InputLabel>Contribution Frequency</InputLabel>
                <Select
                  value={newInvestment.ContributionFrequency || CompoundingFrequency.Monthly}
                  label="Contribution Frequency"
                  onChange={(e) =>
                    setNewInvestment({
                      ...newInvestment,
                      ContributionFrequency: e.target.value as CompoundingFrequency,
                    })
                  }
                >
                  <MenuItem value={CompoundingFrequency.Monthly}>Monthly</MenuItem>
                  <MenuItem value={CompoundingFrequency.Quarterly}>Quarterly</MenuItem>
                  <MenuItem value={CompoundingFrequency.Annually}>Annually</MenuItem>
                </Select>
              </FormControl>
            )}
            <Stack direction="row">
              {props.investment && (
                <Button
                  onClick={onDelete}
                  sx={{ backgroundColor: 'error.main', color: 'white' }}
                >
                  <Delete />
                </Button>
              )}
              <Button
                type="reset"
                color="secondary"
                onClick={props.onClose}
                sx={{ flex: 3 }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="contained"
                color="primary"
                onClick={onSave}
                disabled={!isFormValid()}
                sx={{ flex: 5 }}
              >
                {!props.investment ? 'Add Investment' : 'Save Investment'}
              </Button>
            </Stack>
          </Box>
        </CardContent>
      </Card>
    </Popover>
  );
};

export interface AddEditInvestmentProps {
  open: boolean;
  onSave: (newInvestment: Investment, oldInvestment?: Investment) => void;
  onClose: () => void;
  investment?: Investment;
}