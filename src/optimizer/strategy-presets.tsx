import { useMemo } from 'react';
import {
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { Loan } from '../models/loan-model';
import { Investment } from '../models/investment-model';
import { Asset } from '../models/asset-model';
import {
  AllocationMode,
  AllocationPlan,
  evaluatePlan,
} from '../helpers/optimizer-helpers';
import { buildStrategyPlans } from '../helpers/strategy-helpers';
import { formatCurrency, formatNetWorthDelta } from '../helpers/format-helpers';
import { formatPayoffSooner } from './optimizer-utils';

interface StrategyPresetsProps {
  loans: Loan[];
  investments: Investment[];
  assets: Asset[];
  monthlyExtra: number;
  today: Date;
  horizon: Date;
  mode: AllocationMode;
  onViewAsScenario: (plan: AllocationPlan) => void;
}

// Allocation strategy presets (roadmap 8.4): named, pre-built strategies — pay
// down debt, invest, or balance by rate — scored against the baseline the same
// way the ranked suggestions and custom split are, and chartable with one click.
// A quick "compare whole strategies" view alongside the optimizer's search.
export const StrategyPresets = ({
  loans,
  investments,
  assets,
  monthlyExtra,
  today,
  horizon,
  mode,
  onViewAsScenario,
}: StrategyPresetsProps) => {
  const evaluations = useMemo(
    () =>
      buildStrategyPlans(loans, investments, monthlyExtra).map((plan) => ({
        plan,
        evaluation: evaluatePlan(
          loans,
          investments,
          plan,
          today,
          horizon,
          assets,
          mode
        ),
      })),
    [loans, investments, monthlyExtra, today, horizon, assets, mode]
  );

  if (evaluations.length === 0) return null;

  return (
    <Paper variant="outlined" sx={{ padding: 2, marginTop: 2 }}>
      <Typography variant="subtitle2" gutterBottom>
        Strategy presets
      </Typography>
      <Typography variant="caption" color="text.secondary">
        Pre-built strategies for {formatCurrency(monthlyExtra)}
        {mode === 'oneTime' ? '' : '/month'} — compare them, then send any to
        the chart.
      </Typography>
      <Table
        size="small"
        aria-label="Allocation strategy presets"
        sx={{ marginTop: 1 }}
      >
        <TableHead>
          <TableRow>
            <TableCell>Strategy</TableCell>
            <TableCell align="right">Net worth added at horizon</TableCell>
            <TableCell align="right">Interest saved</TableCell>
            <TableCell align="right">Debt-free</TableCell>
            <TableCell />
          </TableRow>
        </TableHead>
        <TableBody>
          {evaluations.map(({ plan, evaluation }) => (
            <TableRow key={plan.kind} hover>
              <TableCell>{plan.label}</TableCell>
              <TableCell align="right">
                {formatNetWorthDelta(evaluation.netWorthDelta)}
              </TableCell>
              <TableCell align="right">
                {formatCurrency(evaluation.interestSaved)}
              </TableCell>
              <TableCell align="right">
                {formatPayoffSooner(evaluation.payoffMonthsEarlier)}
              </TableCell>
              <TableCell align="right">
                <Button size="small" onClick={() => onViewAsScenario(plan)}>
                  View as scenario
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Paper>
  );
};
