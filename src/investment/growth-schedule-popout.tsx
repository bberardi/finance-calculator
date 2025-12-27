import {
  Card,
  CardContent,
  Paper,
  Popover,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { Investment, CompoundingFrequency } from '../models/investment-model';
import { generateInvestmentGrowth, getPeriodsPerYear } from '../helpers/investment-helpers';
import dayjs from 'dayjs';

type ScheduleEntry = {
  period: number;
  date: string;
  totalInvested: number;
  interestAccrued: number;
  balance: number;
};

export const GrowthSchedulePopout = (props: GrowthSchedulePopoutProps) => {
  // Project 30 years from today (when the schedule is generated), not from StartDate,
  // so investments that started in the past can show historical periods plus 30 future years.
  const endDate = dayjs().add(30, 'years').toDate();
  // Always generate fresh schedule with 30-year projection (from "today")
  const schedule = generateInvestmentGrowth(props.investment, endDate);
  const periodsPerYear = getPeriodsPerYear(props.investment.CompoundingPeriod);

  // Get period label based on compounding frequency
  const getPeriodLabel = (): string => {
    switch (props.investment.CompoundingPeriod) {
      case CompoundingFrequency.Monthly:
        return 'Month';
      case CompoundingFrequency.Quarterly:
        return 'Quarter';
      case CompoundingFrequency.Annually:
        return 'Year';
      default:
        return 'Period';
    }
  };

  // Get date format based on compounding frequency
  const getDateFormat = (): string => {
    switch (props.investment.CompoundingPeriod) {
      case CompoundingFrequency.Monthly:
        return 'MMM YYYY';
      case CompoundingFrequency.Quarterly:
        return '[Q]Q YYYY';
      case CompoundingFrequency.Annually:
        return 'YYYY';
      default:
        return 'MMM YYYY';
    }
  };

  // For monthly and quarterly, show individual periods; for annual, group by year
  let cumulativeInvested = props.investment.StartingBalance;
  const scheduleEntries: ScheduleEntry[] = schedule.map((entry) => {
    const monthsPerPeriod = periodsPerYear ? 12 / periodsPerYear : 12;
    // Period 0 is the initial state, so use start date
    let periodDate = entry.Period === 0 
      ? dayjs(props.investment.StartDate)
      : dayjs(props.investment.StartDate).add((entry.Period - 1) * monthsPerPeriod, 'months');
    
    // For end-of-period calculations, we want to show the end of the period
    // E.g., if start is 6/15/2022, period 1 should show end of first period
    // Period 0 uses the start date as-is
    if (entry.Period > 0) {
      switch (props.investment.CompoundingPeriod) {
        case CompoundingFrequency.Monthly:
          periodDate = periodDate.endOf('month');
          break;
        case CompoundingFrequency.Quarterly:
          // For quarterly, end of the quarter month
          periodDate = periodDate.endOf('month');
          break;
        case CompoundingFrequency.Annually:
          periodDate = periodDate.endOf('year');
          break;
      }
    }

    cumulativeInvested += entry.ContributionAmount;

    return {
      period: entry.Period,
      date: periodDate.format(getDateFormat()),
      totalInvested: cumulativeInvested,
      interestAccrued: entry.InterestEarned,
      balance: entry.TotalValue,
    };
  });

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
      style={{ maxHeight: '90vh' }}
    >
      <Card>
        <CardContent>
          <Typography variant="h5" gutterBottom>
            Growth Schedule
          </Typography>
          <TableContainer component={Paper} sx={{ maxHeight: '75vh' }}>
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>{getPeriodLabel()}</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell>Total Invested</TableCell>
                  <TableCell>Interest This Period</TableCell>
                  <TableCell>Balance</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {scheduleEntries.map((entry) => (
                  <TableRow key={entry.period}>
                    <TableCell>{entry.period}</TableCell>
                    <TableCell>{entry.date}</TableCell>
                    <TableCell>
                      {entry.totalInvested.toLocaleString(undefined, {
                        style: 'currency',
                        currency: 'USD',
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </TableCell>
                    <TableCell>
                      {entry.interestAccrued.toLocaleString(undefined, {
                        style: 'currency',
                        currency: 'USD',
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </TableCell>
                    <TableCell>
                      {entry.balance.toLocaleString(undefined, {
                        style: 'currency',
                        currency: 'USD',
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Popover>
  );
};

export interface GrowthSchedulePopoutProps {
  investment: Investment;
  onClose: () => void;
}
