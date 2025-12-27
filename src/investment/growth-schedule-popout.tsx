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
import { Investment } from '../models/investment-model';
import { generateInvestmentGrowth, getPeriodsPerYear } from '../helpers/investment-helpers';
import dayjs from 'dayjs';

type YearlyScheduleEntry = {
  year: number;
  date: string;
  totalInvested: number;
  interestAccrued: number;
  balance: number;
};

export const GrowthSchedulePopout = (props: GrowthSchedulePopoutProps) => {
  // NOTE:
  // This growth schedule is designed to always project 30 years into the future
  // from "today" (the time the schedule is generated), not 30 years from the
  // investment StartDate. As a result, if the investment started in the past,
  // the schedule can include more than 30 years of data (historical + 30 future).
  // This differs from loan amortization schedules (which usually run strictly
  // from loan start to loan end), but is intentional so users always see a
  // 30‑year forward-looking projection from the current date.
  const endDate = dayjs().add(30, 'years').toDate();
  // Always generate fresh schedule with 30-year projection (from "today")
  const schedule = generateInvestmentGrowth(props.investment, endDate);
  const periodsPerYear = getPeriodsPerYear(props.investment.CompoundingPeriod);

  // Group by year and show yearly totals
  const yearlyScheduleMap = schedule.reduce(
    (acc: Map<number, YearlyScheduleEntry>, entry) => {
      const yearIndex = Math.floor((entry.Period - 1) / periodsPerYear);
      // Calculate period date based on compounding frequency.
      // getPeriodsPerYear currently returns values that evenly divide 12 (e.g., 1, 4, 12),
      // so we can safely compute monthsPerPeriod directly.
      let periodDate = dayjs(props.investment.StartDate);
      const monthsPerPeriod = periodsPerYear ? 12 / periodsPerYear : 12;
      periodDate = periodDate.add((entry.Period - 1) * monthsPerPeriod, 'months');

      let yearEntry = acc.get(yearIndex);
      if (!yearEntry) {
        yearEntry = {
          year: yearIndex + 1,
          date: periodDate.format('YYYY'),
          totalInvested: 0,
          interestAccrued: 0,
          balance: 0,
        };
        acc.set(yearIndex, yearEntry);
      }

      yearEntry.totalInvested += entry.ContributionAmount;
      yearEntry.interestAccrued += entry.InterestEarned;
      yearEntry.balance = entry.TotalValue;
      yearEntry.date = periodDate.format('YYYY');

      return acc;
    },
    new Map<number, YearlyScheduleEntry>()
  );

  const yearlySchedule = Array.from(yearlyScheduleMap.values()).sort(
    (a, b) => a.year - b.year
  );
  
  // Add starting balance to the first year only
  if (yearlySchedule.length > 0) {
    yearlySchedule[0].totalInvested += props.investment.StartingBalance;
  }

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
                  <TableCell>Year</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell>Total Invested</TableCell>
                  <TableCell>Interest This Year</TableCell>
                  <TableCell>Balance</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {yearlySchedule.map((entry) => (
                  <TableRow key={entry.year}>
                    <TableCell>{entry.year}</TableCell>
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
