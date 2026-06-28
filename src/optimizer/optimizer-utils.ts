import dayjs from 'dayjs';
import { Loan } from '../models/loan-model';
import { Investment } from '../models/investment-model';
import { getDefaultHorizon } from '../helpers/forecast-helpers';
import {
  AllocationMode,
  AllocationPlan,
  splitAllocations,
} from '../helpers/optimizer-helpers';
import { Scenario, emptyScenario } from '../models/scenario-model';

// Horizon choices for the optimizer (mirrors the chart's time-range control).
// 'full' defers to the engine's default horizon for the given positions.
export type HorizonKey = '5y' | '10y' | '30y' | 'full';

export const HORIZON_OPTIONS: { value: HorizonKey; label: string }[] = [
  { value: '5y', label: '5Y' },
  { value: '10y', label: '10Y' },
  { value: '30y', label: '30Y' },
  { value: 'full', label: 'Full' },
];

const HORIZON_YEARS: Record<Exclude<HorizonKey, 'full'>, number> = {
  '5y': 5,
  '10y': 10,
  '30y': 30,
};

// Resolve a horizon choice to a concrete date relative to `today`. 'full' uses
// the same default horizon the forecast chart draws to.
export const resolveHorizon = (
  key: HorizonKey,
  loans: Loan[],
  investments: Investment[],
  today: Date
): Date =>
  key === 'full'
    ? getDefaultHorizon(loans, investments, today)
    : dayjs(today).add(HORIZON_YEARS[key], 'year').toDate();

// Human-readable "debt-free N sooner" from a months-earlier count.
export const formatPayoffSooner = (months: number): string => {
  if (months <= 0) return '—';
  const years = Math.floor(months / 12);
  const rem = months % 12;
  const parts: string[] = [];
  if (years > 0) parts.push(`${years}y`);
  if (rem > 0) parts.push(`${rem}mo`);
  return `${parts.join(' ')} sooner`;
};

// Build a Scenario (Phase 4 overlay) from an allocation plan so "view as
// scenario" on the chart reuses the existing scenario machinery. The plan label
// becomes the scenario name (prefixed for a one-time lump so the chip is
// self-describing). In 'oneTime' mode (Phase 8.2) splitAllocations targets the
// OneTime* maps, so the overlay shows the lump applied at the first month.
export const planToScenario = (
  loans: Loan[],
  plan: AllocationPlan,
  mode: AllocationMode = 'monthly'
): Scenario => {
  const {
    ExtraLoanPayments,
    ExtraContributions,
    OneTimeLoanPayments,
    OneTimeContributions,
  } = splitAllocations(loans, plan.allocations, mode);
  return {
    ...emptyScenario,
    Name: mode === 'oneTime' ? `One-time — ${plan.label}` : plan.label,
    ExtraLoanPayments,
    ExtraContributions,
    OneTimeLoanPayments,
    OneTimeContributions,
  };
};
