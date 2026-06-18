import {
  Box,
  DialogContent,
  DialogTitle,
  Paper,
  Table,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { Investment, CompoundingFrequency } from '../models/investment-model';
import {
  generateInvestmentGrowth,
  getPeriodsPerYear,
} from '../helpers/investment-helpers';
import { getGrowthTotals } from '../helpers/schedule-totals-helpers';
import { formatCurrency } from '../helpers/format-helpers';
import dayjs from 'dayjs';
import { useMemo, useRef } from 'react';
import { ResponsiveDialog } from '../components/responsive-dialog';
import { VirtualizedTableBody } from '../components/virtualized-table-body';
import { ScheduleTotalsFooter } from '../components/schedule-totals-footer';

type ScheduleEntry = {
  period: number;
  date: string;
  contributionAmount: number;
  totalInvested: number;
  interestAccrued: number;
  balance: number;
};

export const GrowthSchedulePopout = (props: GrowthSchedulePopoutProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const schedule = useMemo(() => {
    // Project 30 years from today (when the schedule is generated), not from StartDate,
    // so investments that started in the past can show historical periods plus 30 future years.
    const endDate = dayjs().add(30, 'years').toDate();
    // Always generate fresh schedule with 30-year projection (from "today")
    return generateInvestmentGrowth(props.investment, endDate);
  }, [props.investment]);
  const periodsPerYear = getPeriodsPerYear(props.investment.CompoundingPeriod);

  const totals = useMemo(
    () => getGrowthTotals(schedule, props.investment.StartingBalance),
    [schedule, props.investment.StartingBalance]
  );

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

  const hasStepUp =
    !!props.investment.ContributionStepUpType &&
    !!props.investment.ContributionStepUpAmount;

  // Precompute every row up front (cheap, O(periods)) so the virtualized body
  // can read any row by index — the running cumulative total can't be derived
  // inside an out-of-order windowed render.
  const scheduleEntries = useMemo<ScheduleEntry[]>(() => {
    let cumulativeInvested = props.investment.StartingBalance;
    const dateFormat = getDateFormat();
    return schedule.map((entry) => {
      const monthsPerPeriod = periodsPerYear ? 12 / periodsPerYear : 12;
      // Period 0 is the initial state, so use start date
      let periodDate =
        entry.Period === 0
          ? dayjs(props.investment.StartDate)
          : dayjs(props.investment.StartDate).add(
              entry.Period * monthsPerPeriod,
              'months'
            );

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
        date: periodDate.format(dateFormat),
        contributionAmount: entry.ContributionAmount,
        totalInvested: cumulativeInvested,
        interestAccrued: entry.InterestEarned,
        balance: entry.TotalValue,
      };
    });
    // getDateFormat / getPeriodsPerYear are derived from the investment, which
    // is the dependency that matters here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schedule, props.investment, periodsPerYear]);

  const colSpan = hasStepUp ? 6 : 5;

  return (
    <ResponsiveDialog
      open={!!props.investment}
      onClose={props.onClose}
      maxWidth="md"
    >
      <DialogTitle>Growth Schedule</DialogTitle>
      <DialogContent>
        <TableContainer
          component={Paper}
          ref={scrollRef}
          sx={{ maxHeight: '60vh', overflow: 'auto' }}
        >
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>{getPeriodLabel()}</TableCell>
                <TableCell>Date</TableCell>
                {hasStepUp && <TableCell>Contribution</TableCell>}
                <TableCell>Total Invested</TableCell>
                <TableCell>Interest This Period</TableCell>
                <TableCell>Balance</TableCell>
              </TableRow>
            </TableHead>
            <VirtualizedTableBody
              scrollRef={scrollRef}
              count={scheduleEntries.length}
              colSpan={colSpan}
              rowKey={(index) => scheduleEntries[index].period}
              renderCells={(index) => {
                const entry = scheduleEntries[index];
                return (
                  <>
                    <TableCell>{entry.period}</TableCell>
                    <TableCell>{entry.date}</TableCell>
                    {hasStepUp && (
                      <TableCell>
                        {formatCurrency(entry.contributionAmount)}
                      </TableCell>
                    )}
                    <TableCell>{formatCurrency(entry.totalInvested)}</TableCell>
                    <TableCell>
                      {formatCurrency(entry.interestAccrued)}
                    </TableCell>
                    <TableCell>{formatCurrency(entry.balance)}</TableCell>
                  </>
                );
              }}
            />
          </Table>
        </TableContainer>
        {scheduleEntries.length > 0 ? (
          /* Lifetime-totals footer (roadmap 6.5): pinned below the scroll area. */
          <ScheduleTotalsFooter
            items={[
              {
                label: 'Total invested',
                value: formatCurrency(totals.endingInvested),
              },
              {
                label: 'Interest earned',
                value: formatCurrency(totals.totalInterest),
              },
              {
                label: 'Final balance',
                value: formatCurrency(totals.endingValue),
              },
            ]}
          />
        ) : (
          <Box sx={{ mt: 2 }}>
            <Typography color="text.secondary">
              No schedule to display for this investment.
            </Typography>
          </Box>
        )}
      </DialogContent>
    </ResponsiveDialog>
  );
};

export interface GrowthSchedulePopoutProps {
  investment: Investment;
  onClose: () => void;
}
