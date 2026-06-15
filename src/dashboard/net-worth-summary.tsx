import { useMemo } from 'react';
import { Box, Card, CardContent, Typography } from '@mui/material';
import { Loan } from '../models/loan-model';
import { Investment } from '../models/investment-model';
import { summarizePositions } from '../helpers/summary-helpers';
import { formatCurrency } from '../helpers/format-helpers';

interface NetWorthSummaryProps {
  loans: Loan[];
  investments: Investment[];
}

// Net-worth dashboard summary cards (Phase 3.1). Total assets, total debt, net
// worth, and monthly commitments at today's anchor — the same numbers the
// forecast chart starts from (via summarizePositions). Net worth is colored by
// sign so an underwater position reads at a glance.
export const NetWorthSummary = ({
  loans,
  investments,
}: NetWorthSummaryProps) => {
  const summary = useMemo(
    () => summarizePositions(loans, investments),
    [loans, investments]
  );

  const cards: {
    label: string;
    value: string;
    color?: string;
    hint?: string;
  }[] = [
    {
      label: 'Total assets',
      value: formatCurrency(summary.totalAssets),
      color: 'success.main',
    },
    {
      label: 'Total debt',
      value: formatCurrency(summary.totalDebt),
      color: 'error.main',
    },
    {
      label: 'Net worth',
      value: formatCurrency(summary.netWorth),
      color: summary.netWorth < 0 ? 'error.main' : 'success.main',
    },
    {
      label: 'Monthly commitments',
      value: formatCurrency(summary.monthlyCommitments),
      hint: 'payments + contributions / mo',
    },
  ];

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, 1fr)' },
        gap: 2,
      }}
    >
      {cards.map((card) => (
        <Card key={card.label} variant="outlined">
          <CardContent>
            <Typography variant="overline" color="text.secondary">
              {card.label}
            </Typography>
            <Typography
              variant="h6"
              sx={{
                color: card.color,
                fontWeight: 600,
                wordBreak: 'break-word',
              }}
            >
              {card.value}
            </Typography>
            {card.hint && (
              <Typography variant="caption" color="text.secondary">
                {card.hint}
              </Typography>
            )}
          </CardContent>
        </Card>
      ))}
    </Box>
  );
};
