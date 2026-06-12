import {
  Box,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import {
  defaultPitInvestment,
  Investment,
  PitInvestment,
  CompoundingFrequency,
} from '../models/investment-model';
import { DatePicker } from '@mui/x-date-pickers';
import dayjs, { Dayjs } from 'dayjs';
import { getPitInvestmentCalculation } from '../helpers/investment-helpers';
import { formatCurrency } from '../helpers/format-helpers';
import { NumericFormat, NumberFormatValues } from 'react-number-format';
import { ResponsiveDialog } from '../components/responsive-dialog';

export const PitPopout = (props: PitPopoutProps) => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [pitInvestment, setPitInvestment] =
    useState<PitInvestment>(defaultPitInvestment);

  // Get the appropriate date picker views based on compounding frequency
  const getDatePickerViews = (): Array<'year' | 'month' | 'day'> => {
    switch (props.investment.CompoundingPeriod) {
      case CompoundingFrequency.Monthly:
        return ['year', 'month'];
      case CompoundingFrequency.Quarterly:
        return ['year', 'month'];
      case CompoundingFrequency.Annually:
        return ['year'];
      default:
        return ['year', 'month'];
    }
  };

  // Get label for the period input based on compounding frequency
  const getPeriodLabel = (): string => {
    switch (props.investment.CompoundingPeriod) {
      case CompoundingFrequency.Monthly:
        return 'Months';
      case CompoundingFrequency.Quarterly:
        return 'Quarters';
      case CompoundingFrequency.Annually:
        return 'Years';
      default:
        return 'Periods';
    }
  };

  // Calculate the number of periods from start date to the selected date
  const getPeriodsFromStart = (date: Date): number => {
    const start = dayjs(props.investment.StartDate);
    const end = dayjs(date);

    switch (props.investment.CompoundingPeriod) {
      case CompoundingFrequency.Monthly:
        return Math.max(0, end.diff(start, 'month', true));
      case CompoundingFrequency.Quarterly:
        // Calculate quarters from months
        return Math.max(0, end.diff(start, 'month', true) / 3);
      case CompoundingFrequency.Annually:
        return Math.max(0, end.diff(start, 'year', true));
      default:
        return 0;
    }
  };

  // Handle period change (months, quarters, or years depending on compounding)
  const handlePeriodChange = (newPeriods: number) => {
    const start = dayjs(props.investment.StartDate);
    let newDate: Dayjs;

    switch (props.investment.CompoundingPeriod) {
      case CompoundingFrequency.Monthly:
        newDate = start.add(newPeriods, 'month');
        break;
      case CompoundingFrequency.Quarterly:
        newDate = start.add(newPeriods * 3, 'month');
        break;
      case CompoundingFrequency.Annually:
        newDate = start.add(newPeriods, 'year');
        break;
      default:
        newDate = start.add(newPeriods, 'month');
    }

    setSelectedDate(newDate.toDate());
  };

  useEffect(() => {
    if (props.investment) {
      setPitInvestment(
        getPitInvestmentCalculation(props.investment, selectedDate)
      );
    }
  }, [props.investment, selectedDate]);

  return (
    <ResponsiveDialog open={!!props.investment} onClose={props.onClose}>
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
              onChange={(date: Dayjs | null) =>
                setSelectedDate(date?.toDate() ?? props.investment.StartDate)
              }
              minDate={dayjs(props.investment.StartDate)}
              views={getDatePickerViews()}
              openTo={
                props.investment.CompoundingPeriod ===
                CompoundingFrequency.Annually
                  ? 'year'
                  : 'month'
              }
              sx={{ flex: 4 }}
            />
            <NumericFormat
              label={getPeriodLabel()}
              value={getPeriodsFromStart(selectedDate)}
              thousandSeparator
              decimalScale={2}
              customInput={TextField}
              onValueChange={(vs: NumberFormatValues) => {
                handlePeriodChange(Number(vs.value));
              }}
              isAllowed={(values) => {
                const { floatValue } = values;
                return floatValue === undefined || floatValue >= 0;
              }}
              sx={{ flex: 2 }}
            />
          </Stack>
          <Typography>{`Total Contributions: ${formatCurrency(
            pitInvestment.TotalContributions
          )}`}</Typography>
          <Typography>{`Total Interest Earned: ${formatCurrency(
            pitInvestment.TotalInterestEarned
          )}`}</Typography>
          <Typography>{`Current Value: ${formatCurrency(
            pitInvestment.CurrentValue
          )}`}</Typography>
        </Box>
      </DialogContent>
    </ResponsiveDialog>
  );
};

export interface PitPopoutProps {
  investment: Investment;
  onClose: () => void;
}
