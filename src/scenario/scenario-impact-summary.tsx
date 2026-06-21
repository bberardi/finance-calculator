import { useMemo } from 'react';
import { Box, Paper, Stack, Typography } from '@mui/material';
import { Loan } from '../models/loan-model';
import { Investment } from '../models/investment-model';
import { Scenario } from '../models/scenario-model';
import { computeScenarioImpact } from '../helpers/scenario-impact-helpers';
import { formatCurrency, formatNetWorthDelta } from '../helpers/format-helpers';

interface ScenarioImpactSummaryProps {
  loans: Loan[];
  investments: Investment[];
  scenario: Scenario;
}

const formatMonths = (months: number): string => {
  if (months <= 0) return 'No change';
  const years = Math.floor(months / 12);
  const rem = months % 12;
  const parts = [];
  if (years > 0) parts.push(`${years}y`);
  if (rem > 0) parts.push(`${rem}mo`);
  return `${parts.join(' ')} sooner`;
};

// Scenario impact summary (Phase 4.4): what the active scenario buys vs.
// baseline — net worth at the horizon, lifetime interest saved, and how much
// sooner the debt-free date arrives. Turns the overlay chart into a decision.
export const ScenarioImpactSummary = ({
  loans,
  investments,
  scenario,
}: ScenarioImpactSummaryProps) => {
  const impact = useMemo(
    () => computeScenarioImpact(loans, investments, scenario, new Date()),
    [loans, investments, scenario]
  );

  const metrics: { label: string; value: string }[] = [
    {
      label: 'Net worth added at horizon',
      value: formatNetWorthDelta(impact.netWorthDelta),
    },
    {
      label: 'Lifetime interest saved',
      value: formatCurrency(impact.interestSaved),
    },
    {
      label: 'Debt-free',
      value: formatMonths(impact.payoffMonthsEarlier),
    },
  ];

  return (
    <Paper variant="outlined" sx={{ padding: 2, marginTop: 2 }}>
      <Typography variant="subtitle2" gutterBottom>
        “{scenario.Name}” vs. baseline
      </Typography>
      <Stack direction="row" spacing={4} useFlexGap sx={{ flexWrap: 'wrap' }}>
        {metrics.map((metric) => (
          <Box key={metric.label}>
            <Typography variant="caption" color="text.secondary">
              {metric.label}
            </Typography>
            <Typography variant="h6">{metric.value}</Typography>
          </Box>
        ))}
      </Stack>
    </Paper>
  );
};
