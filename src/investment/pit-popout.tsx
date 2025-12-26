import {
  Box,
  Card,
  CardContent,
  Popover,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { defaultPitInvestment, Investment, PitInvestment } from '../models/investment-model';
import { DatePicker } from '@mui/x-date-pickers';
import dayjs, { Dayjs } from 'dayjs';
import { getPitInvestmentCalculation } from '../helpers/investment-helpers';
import { NumericFormat, NumberFormatValues } from 'react-number-format';

export const PitPopout = (props: PitPopoutProps) => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [pitInvestment, setPitInvestment] = useState<PitInvestment>(defaultPitInvestment);

  const handleYearsChange = (newYears: number) => {
    if (newYears < 0) {
      setSelectedDate(dayjs(props.investment.StartDate).toDate());
    } else {
      setSelectedDate(
        dayjs(props.investment.StartDate)
          .add(newYears, 'years')
          .toDate()
      );
    }
  };

  const getYearsFromStart = (date: Date): number => {
    const years = dayjs(date).diff(dayjs(props.investment.StartDate), 'years', true);
    return Math.max(0, Math.round(years * 100) / 100);
  };

  useEffect(() => {
    if (props.investment) {
      setPitInvestment(getPitInvestmentCalculation(props.investment, selectedDate));
    }
  }, [props.investment, selectedDate]);

  return (
    <Popover
      open={!!props.investment}
      onClose={props.onClose}
      anchorOrigin={{
        vertical: 'center',
        horizontal: 'center',
      }}
      transformOrigin={{
        vertical: 'center',
        horizontal: 'center',
      }}
    >
      <Card>
        <CardContent>
          <Typography variant="h5" gutterBottom>
            Point-in-Time Calculator
          </Typography>
          <Box display="flex" flexDirection="column" gap={2}>
            <Stack direction="row">
              <DatePicker
                label="Projection Date"
                value={dayjs(selectedDate)}
                onChange={(date: Dayjs | null) =>
                  setSelectedDate(date?.toDate() ?? new Date())
                }
                minDate={dayjs(props.investment.StartDate)}
                views={['year']}
                sx={{ flex: 4 }}
              />
              <NumericFormat
                label="Years"
                value={getYearsFromStart(selectedDate)}
                thousandSeparator
                decimalScale={2}
                customInput={TextField}
                onValueChange={(vs: NumberFormatValues) => {
                  handleYearsChange(Number(vs.value));
                }}
                sx={{ flex: 2 }}
              />
            </Stack>
            <Typography>{`Total Contributions: ${pitInvestment.TotalContributions.toLocaleString(
              undefined,
              {
                style: 'currency',
                currency: 'USD',
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              }
            )}`}</Typography>
            <Typography>{`Total Interest Earned: ${pitInvestment.TotalInterestEarned.toLocaleString(
              undefined,
              {
                style: 'currency',
                currency: 'USD',
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              }
            )}`}</Typography>
            <Typography>{`Current Value: ${pitInvestment.CurrentValue.toLocaleString(
              undefined,
              {
                style: 'currency',
                currency: 'USD',
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              }
            )}`}</Typography>
          </Box>
        </CardContent>
      </Card>
    </Popover>
  );
};

export interface PitPopoutProps {
  investment: Investment;
  onClose: () => void;
}
