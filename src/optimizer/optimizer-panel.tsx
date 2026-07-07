import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { NumericFormat } from 'react-number-format';
import { Loan } from '../models/loan-model';
import { Investment } from '../models/investment-model';
import { Asset } from '../models/asset-model';
import { AllocationMode, AllocationPlan } from '../helpers/optimizer-helpers';
import { formatCurrency, formatNetWorthDelta } from '../helpers/format-helpers';
import { useFinanceData } from '../state/use-finance-data';
import { useOptimizer } from './use-optimizer';
import { CustomSplitBuilder } from './custom-split-builder';
import { StrategyPresets } from './strategy-presets';
import { StrategyComparison } from './strategy-comparison';
import {
  HORIZON_OPTIONS,
  HorizonKey,
  formatPayoffSooner,
  planToScenario,
  resolveHorizon,
} from './optimizer-utils';

interface OptimizerPanelProps {
  loans: Loan[];
  investments: Investment[];
  assets: Asset[];
}

// How many ranked plans to surface (the search produces far more across the
// split grid; the top handful is what's actionable).
const MAX_ROWS = 8;

// A stable, collision-proof React key for a plan row. Two positions can share a
// Name (so the human-readable label isn't unique), but a plan's id→amount
// allocation map uniquely identifies it.
const planKey = (plan: AllocationPlan): string =>
  Object.entries(plan.allocations)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, amount]) => `${id}:${amount}`)
    .join('|');

// The "Next Dollar" optimizer panel (roadmap 5.3): the flagship interaction.
// Enter an extra $/month and a horizon, and a Web Worker ranks single-target and
// split allocation plans by long-term impact; one click turns any plan into a
// chart overlay (the Phase 4 scenario machinery). A custom split builder (5.4)
// lets users pit their own intuition against the suggestions.
export const OptimizerPanel = ({
  loans,
  investments,
  assets,
}: OptimizerPanelProps) => {
  const { addScenario, setActiveScenario } = useFinanceData();

  const [monthlyExtra, setMonthlyExtra] = useState(0);
  const [mode, setMode] = useState<AllocationMode>('monthly');
  const [horizonKey, setHorizonKey] = useState<HorizonKey>('full');
  const [createdName, setCreatedName] = useState<string | null>(null);

  const isOneTime = mode === 'oneTime';

  // Stable "today" so the horizon and worker requests share one anchor.
  const today = useMemo(() => new Date(), []);
  const horizon = useMemo(
    () => resolveHorizon(horizonKey, loans, investments, today),
    [horizonKey, loans, investments, today]
  );

  const { plans, loading, error } = useOptimizer({
    loans,
    investments,
    monthlyExtra,
    today,
    horizon,
    assets,
    mode,
  });

  const topPlans = plans.slice(0, MAX_ROWS);
  const hasPositions = loans.length + investments.length > 0;

  const onViewAsScenario = (plan: AllocationPlan) => {
    const scenario = planToScenario(loans, plan, mode);
    const id = addScenario(scenario);
    setActiveScenario(id);
    setCreatedName(scenario.Name);
  };

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {isOneTime
          ? 'Got a one-time lump sum — a bonus, a tax refund, a windfall? PathWise ranks where that money does the most good — all toward one position, or split across several.'
          : 'Tell PathWise how much extra you can put in each month and it ranks where that money does the most good — all toward one position, or split across several.'}
      </Typography>

      <Stack
        direction="row"
        spacing={2}
        useFlexGap
        sx={{ flexWrap: 'wrap', alignItems: 'center', mb: 2 }}
      >
        <ToggleButtonGroup
          size="small"
          exclusive
          value={mode}
          onChange={(_, next: AllocationMode | null) => next && setMode(next)}
          aria-label="Contribution type"
        >
          <ToggleButton value="monthly" aria-label="Per month">
            Per month
          </ToggleButton>
          <ToggleButton value="oneTime" aria-label="One-time lump sum">
            One-time
          </ToggleButton>
        </ToggleButtonGroup>
        <NumericFormat
          label={isOneTime ? 'One-time amount' : 'Extra per month'}
          value={monthlyExtra || ''}
          thousandSeparator
          decimalScale={2}
          prefix="$"
          customInput={TextField}
          size="small"
          placeholder="$0"
          onValueChange={(vs) => setMonthlyExtra(Number(vs.value))}
          sx={{ width: 180 }}
        />
        <ToggleButtonGroup
          size="small"
          exclusive
          value={horizonKey}
          onChange={(_, next: HorizonKey | null) => next && setHorizonKey(next)}
          aria-label="Optimizer horizon"
        >
          {HORIZON_OPTIONS.map(({ value, label }) => (
            <ToggleButton key={value} value={value} aria-label={label}>
              {label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        {loading && <CircularProgress size={20} aria-label="Optimizing" />}
      </Stack>

      {monthlyExtra <= 0 ? (
        <Alert severity="info">
          Enter an amount above to see where your next dollar should go.
        </Alert>
      ) : (
        <>
          {error && (
            <Alert severity="error">
              The optimizer ran into a problem and couldn&apos;t finish. Try
              adjusting your inputs.
            </Alert>
          )}
          {/* TableContainer lets the 5-column table scroll in place on narrow
              viewports instead of forcing page-level horizontal scroll. */}
          <TableContainer>
            <Table size="small" aria-label="Ranked allocation plans">
              <TableHead>
                <TableRow>
                  <TableCell>Plan</TableCell>
                  <TableCell align="right">
                    Net worth added at horizon
                  </TableCell>
                  <TableCell align="right">Interest saved</TableCell>
                  <TableCell align="right">Debt-free</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {topPlans.map((evaluation, index) => (
                  <TableRow key={planKey(evaluation.plan)} hover>
                    <TableCell>
                      <Stack
                        direction="row"
                        spacing={1}
                        sx={{ alignItems: 'center' }}
                      >
                        {index === 0 && (
                          <Chip label="Best" color="primary" size="small" />
                        )}
                        <span>{evaluation.plan.label}</span>
                      </Stack>
                    </TableCell>
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
                      <Button
                        size="small"
                        onClick={() => onViewAsScenario(evaluation.plan)}
                      >
                        View as scenario
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!loading && topPlans.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <Typography variant="body2" color="text.secondary">
                        No positions to fund yet — add a loan or investment.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {hasPositions && (
            <StrategyPresets
              loans={loans}
              investments={investments}
              assets={assets}
              monthlyExtra={monthlyExtra}
              today={today}
              horizon={horizon}
              mode={mode}
              onViewAsScenario={onViewAsScenario}
            />
          )}

          {hasPositions && (
            <StrategyComparison
              loans={loans}
              investments={investments}
              assets={assets}
              monthlyExtra={monthlyExtra}
              today={today}
              mode={mode}
            />
          )}

          {hasPositions && (
            <CustomSplitBuilder
              loans={loans}
              investments={investments}
              assets={assets}
              monthlyExtra={monthlyExtra}
              today={today}
              horizon={horizon}
              mode={mode}
              onViewAsScenario={onViewAsScenario}
            />
          )}
        </>
      )}

      <Snackbar
        open={createdName !== null}
        autoHideDuration={4000}
        onClose={() => setCreatedName(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" sx={{ width: '100%' }}>
          {`Added “${createdName}” — now overlaid on the forecast chart above.`}
        </Alert>
      </Snackbar>
    </Box>
  );
};
