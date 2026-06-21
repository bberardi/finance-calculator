import { useEffect, useMemo, useState } from 'react';
import { Box, Button, Paper, Slider, Stack, Typography } from '@mui/material';
import { Loan } from '../models/loan-model';
import { Investment } from '../models/investment-model';
import {
  AllocationPlan,
  evaluatePlan,
  rebalanceAllocation,
  roundToCents,
} from '../helpers/optimizer-helpers';
import { formatCurrency, formatNetWorthDelta } from '../helpers/format-helpers';
import { formatPayoffSooner } from './optimizer-utils';

interface CustomSplitBuilderProps {
  loans: Loan[];
  investments: Investment[];
  monthlyExtra: number;
  today: Date;
  horizon: Date;
  onViewAsScenario: (plan: AllocationPlan) => void;
}

interface Target {
  id: string;
  name: string;
}

// An even split of `total` across `ids`, with rounding drift parked on the first
// target so the dollars always add up.
const evenSplit = (ids: string[], total: number): Record<string, number> => {
  const each = roundToCents(total / ids.length);
  const values: Record<string, number> = {};
  ids.forEach((id) => {
    values[id] = each;
  });
  const drift = roundToCents(total - each * ids.length);
  values[ids[0]] = roundToCents(values[ids[0]] + drift);
  return values;
};

// Custom split builder (roadmap 5.4): sliders that divide $X across the chosen
// positions, always summing to $X (the engine's rebalanceAllocation enforces the
// constraint), live-evaluated against the baseline and chartable via "view as
// scenario" like any suggested plan. Lets users test their own intuition against
// the optimizer's suggestions.
export const CustomSplitBuilder = ({
  loans,
  investments,
  monthlyExtra,
  today,
  horizon,
  onViewAsScenario,
}: CustomSplitBuilderProps) => {
  const targets: Target[] = useMemo(
    () => [
      ...loans.map((loan) => ({ id: loan.Id, name: loan.Name })),
      ...investments.map((inv) => ({ id: inv.Id, name: inv.Name })),
    ],
    [loans, investments]
  );

  const [values, setValues] = useState<Record<string, number>>({});

  // (Re)seed an even split whenever the budget or the set of positions changes.
  const targetKey = targets.map((target) => target.id).join('|');
  useEffect(() => {
    setValues(
      evenSplit(
        targets.map((target) => target.id),
        monthlyExtra
      )
    );
    // targetKey captures the identity of the target set without re-running on
    // every array reference change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetKey, monthlyExtra]);

  const plan: AllocationPlan = useMemo(
    () => ({
      label: 'Custom split',
      allocations: Object.fromEntries(
        Object.entries(values).filter(([, amount]) => amount > 0)
      ),
    }),
    [values]
  );

  const evaluation = useMemo(
    () => evaluatePlan(loans, investments, plan, today, horizon),
    [loans, investments, plan, today, horizon]
  );

  const handleSlider = (id: string, next: number) => {
    setValues((prev) => rebalanceAllocation(prev, id, next, monthlyExtra));
  };

  const metrics = [
    {
      label: 'Net worth added at horizon',
      value: formatNetWorthDelta(evaluation.netWorthDelta),
    },
    {
      label: 'Interest saved',
      value: formatCurrency(evaluation.interestSaved),
    },
    {
      label: 'Debt-free',
      value: formatPayoffSooner(evaluation.payoffMonthsEarlier),
    },
  ];

  return (
    <Paper variant="outlined" sx={{ padding: 2, marginTop: 2 }}>
      <Typography variant="subtitle2" gutterBottom>
        Build your own split
      </Typography>
      <Typography variant="caption" color="text.secondary">
        Drag to divide {formatCurrency(monthlyExtra)}/month across your
        positions — the rest rebalances so it always adds up.
      </Typography>

      <Stack spacing={2} sx={{ marginTop: 2 }}>
        {targets.map((target) => (
          <Box key={target.id}>
            <Stack
              direction="row"
              sx={{ justifyContent: 'space-between', alignItems: 'baseline' }}
            >
              <Typography variant="body2">{target.name}</Typography>
              <Typography variant="body2" color="text.secondary">
                {formatCurrency(values[target.id] ?? 0)}/mo
              </Typography>
            </Stack>
            <Slider
              size="small"
              min={0}
              max={monthlyExtra}
              step={Math.max(1, Math.round(monthlyExtra / 100))}
              value={values[target.id] ?? 0}
              onChange={(_, next) => handleSlider(target.id, next as number)}
              aria-label={`Extra per month toward ${target.name}`}
            />
          </Box>
        ))}
      </Stack>

      <Stack
        direction="row"
        spacing={4}
        useFlexGap
        sx={{ flexWrap: 'wrap', marginTop: 1 }}
      >
        {metrics.map((metric) => (
          <Box key={metric.label}>
            <Typography variant="caption" color="text.secondary">
              {metric.label}
            </Typography>
            <Typography variant="h6">{metric.value}</Typography>
          </Box>
        ))}
      </Stack>

      <Button
        size="small"
        sx={{ marginTop: 1 }}
        onClick={() => onViewAsScenario(plan)}
      >
        View as scenario
      </Button>
    </Paper>
  );
};
