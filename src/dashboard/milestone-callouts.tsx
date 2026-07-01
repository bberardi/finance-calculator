import { useMemo } from 'react';
import dayjs from 'dayjs';
import { Stack, Typography } from '@mui/material';
import { Loan } from '../models/loan-model';
import { Investment } from '../models/investment-model';
import { Asset } from '../models/asset-model';
import { computeMilestones } from '../helpers/milestone-helpers';
import { formatCurrency } from '../helpers/format-helpers';
import {
  DEFAULT_INFLATION_PCT,
  toRealValueOverYears,
} from '../helpers/inflation-helpers';

interface MilestoneCalloutsProps {
  loans: Loan[];
  investments: Investment[];
  assets: Asset[];
  // When true, the future net-worth figures are shown in today's dollars
  // (inflation-adjusted, Phase 9.2).
  inflationAdjusted?: boolean;
}

// Dashboard milestone callouts (Phase 3.2): projected debt-free date and net
// worth at +5y / +10y / +30y, derived from the forecast engine via
// computeMilestones. Assets (Phase 7) flow into the net-worth figures. Debt-free
// is shown only when there are loans.
export const MilestoneCallouts = ({
  loans,
  investments,
  assets,
  inflationAdjusted = false,
}: MilestoneCalloutsProps) => {
  const { debtFreeDate, netWorthAt } = useMemo(
    () => computeMilestones(loans, investments, undefined, assets),
    [loans, investments, assets]
  );

  // In real mode each future milestone is discounted back to today's dollars by
  // its own horizon in years; the debt-free date is a date, so it is unaffected.
  const milestoneValue = (value: number, years: number) =>
    inflationAdjusted
      ? toRealValueOverYears(value, years, DEFAULT_INFLATION_PCT)
      : value;

  return (
    <Stack
      direction="row"
      spacing={3}
      useFlexGap
      sx={{ flexWrap: 'wrap', alignItems: 'baseline' }}
    >
      {loans.length > 0 && (
        <Typography variant="body2" color="text.secondary">
          Debt-free:{' '}
          <Typography component="span" variant="body2" color="text.primary">
            {debtFreeDate
              ? dayjs(debtFreeDate).format('MMM YYYY')
              : 'beyond forecast'}
          </Typography>
        </Typography>
      )}
      {netWorthAt.map((milestone) => (
        <Typography
          key={milestone.years}
          variant="body2"
          color="text.secondary"
        >
          Net worth +{milestone.years}y:{' '}
          <Typography component="span" variant="body2" color="text.primary">
            {formatCurrency(milestoneValue(milestone.value, milestone.years))}
          </Typography>
        </Typography>
      ))}
    </Stack>
  );
};
