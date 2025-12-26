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
  const schedule = props.investment.ProjectedGrowth ?? generateInvestmentGrowth(props.investment);
  const periodsPerYear = getPeriodsPerYear(props.investment.CompoundingPeriod);

  // Group by year and show yearly totals
  const yearlySchedule = schedule.reduce((acc: YearlyScheduleEntry[], entry) => {
    const yearIndex = Math.floor((entry.Period - 1) / periodsPerYear);
    // Calculate period date based on frequency
    let periodDate = dayjs(props.investment.StartDate);
    if (periodsPerYear === 12) {
      periodDate = periodDate.add(entry.Period - 1, 'months');
    } else if (periodsPerYear === 4) {
      periodDate = periodDate.add((entry.Period - 1) * 3, 'months');
    } else {
      periodDate = periodDate.add(entry.Period - 1, 'years');
    }
    
    if (!acc[yearIndex]) {
      acc[yearIndex] = {
        year: yearIndex + 1,
        date: periodDate.format('YYYY'),
        totalInvested: props.investment.StartingBalance,
        interestAccrued: 0,
        balance: 0,
      };
    }
    
    acc[yearIndex].totalInvested += entry.ContributionAmount;
    acc[yearIndex].interestAccrued += entry.InterestEarned;
    acc[yearIndex].balance = entry.TotalValue;
    acc[yearIndex].date = periodDate.format('YYYY');
    
    return acc;
  }, []);

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
                  <TableCell>Interest Accrued</TableCell>
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
