import { useMemo } from 'react';
import dayjs from 'dayjs';
import { Stack, Typography } from '@mui/material';
import { Loan } from '../models/loan-model';
import { Investment } from '../models/investment-model';
import { computeMilestones } from '../helpers/milestone-helpers';
import { formatCurrency } from '../helpers/format-helpers';

interface MilestoneCalloutsProps {
  loans: Loan[];
  investments: Investment[];
}

// Dashboard milestone callouts (Phase 3.2): projected debt-free date and net
// worth at +5y / +10y / +30y, derived from the forecast engine via
// computeMilestones. Debt-free is shown only when there are loans.
export const MilestoneCallouts = ({
  loans,
  investments,
}: MilestoneCalloutsProps) => {
  const { debtFreeDate, netWorthAt } = useMemo(
    () => computeMilestones(loans, investments),
    [loans, investments]
  );

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
            {formatCurrency(milestone.value)}
          </Typography>
        </Typography>
      ))}
    </Stack>
  );
};
