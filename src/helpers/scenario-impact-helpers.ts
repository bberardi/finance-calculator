import dayjs from 'dayjs';
import { Loan } from '../models/loan-model';
import { Investment } from '../models/investment-model';
import { Asset } from '../models/asset-model';
import { ScenarioInput } from '../models/forecast-model';
import {
  forecastLoan,
  forecastNetWorth,
  getDefaultHorizon,
} from './forecast-helpers';

// Scenario impact vs. baseline (Phase 4.4): what a what-if actually buys you —
// net worth at the horizon, lifetime loan interest saved, and how much sooner
// the debt-free date arrives. Pure and framework-free (D7), reading the same
// engine series the chart draws.

const roundToCents = (value: number): number => Math.round(value * 100) / 100;

export interface ScenarioImpact {
  // Scenario − baseline net worth at the forecast horizon (positive = better).
  netWorthDelta: number;
  // Baseline − scenario total loan interest over the loans' lifetimes
  // (positive = interest saved).
  interestSaved: number;
  // Months the projected debt-free date moves earlier (0 if unchanged, or if a
  // debt-free date can't be determined for both baseline and scenario).
  payoffMonthsEarlier: number;
}

// Total interest a loan accrues over the forecast: each month's interest is the
// prior month's balance times the monthly rate (the engine accrues on the
// balance before the payment, and a paid-off balance of 0 accrues nothing).
const totalLoanInterest = (
  loan: Loan,
  horizon: Date,
  extraMonthlyPayment: number,
  today: Date
): number => {
  const series = forecastLoan(loan, horizon, extraMonthlyPayment, today);
  const monthlyRate = loan.InterestRate / 100 / 12;
  let total = 0;
  for (let month = 1; month < series.length; month++) {
    total += series[month - 1].Value * monthlyRate;
  }
  return total;
};

// First month index at which the summed loan balances reach zero, or undefined
// if they never do within the horizon.
const debtFreeMonth = (
  loans: Loan[],
  horizon: Date,
  scenario: ScenarioInput | undefined,
  today: Date,
  length: number
): number | undefined => {
  if (loans.length === 0) return undefined;
  const series = loans.map((loan) =>
    forecastLoan(
      loan,
      horizon,
      scenario?.ExtraLoanPayments?.[loan.Id] ?? 0,
      today
    )
  );
  for (let month = 0; month < length; month++) {
    const totalDebt = series.reduce((sum, s) => sum + s[month].Value, 0);
    if (totalDebt <= 0) return month;
  }
  return undefined;
};

// The plan-independent half of a scenario impact: everything derived from the
// baseline (no extra payments/contributions). Computing this once lets a search
// that scores many scenarios against the same starting point — the Phase 5
// optimizer — reuse it instead of re-forecasting the baseline per candidate.
export interface ScenarioBaseline {
  // Resolved net-worth comparison horizon (honours the optional override).
  nwHorizon: Date;
  // Long horizon over which interest and payoff are measured (full lifetimes).
  longHorizon: Date;
  // Shared month-count of any series over `longHorizon`.
  length: number;
  // Baseline net worth at `nwHorizon`.
  netWorthAtHorizon: number;
  // Baseline lifetime loan interest.
  interest: number;
  // Baseline debt-free month, or undefined if debt isn't cleared in the horizon.
  payoffMonth: number | undefined;
}

// Compute the baseline (no-scenario) figures a scenario is measured against.
// Pure (D7); the horizon override matches computeScenarioImpact's semantics.
export const computeScenarioBaseline = (
  loans: Loan[],
  investments: Investment[],
  today: Date = new Date(),
  horizon?: Date,
  // Passive holdings (cash/property/custom, Phase 7) included in the absolute
  // net-worth anchor so baseline.netWorthAtHorizon is a true net worth. They
  // cancel out of the scenario delta — an asset is identical with or without the
  // what-if — so the change the panels show is unchanged.
  assets: Asset[] = []
): ScenarioBaseline => {
  // Net worth compared at the requested (or chart default) horizon.
  const nwHorizon = horizon ?? getDefaultHorizon(loans, investments, today);
  const baselineNet = forecastNetWorth(
    loans,
    investments,
    nwHorizon,
    undefined,
    today,
    assets
  );

  // Interest and payoff over a long horizon so full loan lifetimes are captured.
  const longHorizon = dayjs(today).add(50, 'year').toDate();
  // The shared month-count of any series over this horizon (an empty net-worth
  // series is still a date-stamped axis).
  const length = forecastNetWorth([], [], longHorizon, undefined, today).length;

  const interest = loans.reduce(
    (sum, loan) => sum + totalLoanInterest(loan, longHorizon, 0, today),
    0
  );
  const payoffMonth = debtFreeMonth(
    loans,
    longHorizon,
    undefined,
    today,
    length
  );

  return {
    nwHorizon,
    longHorizon,
    length,
    netWorthAtHorizon: baselineNet[baselineNet.length - 1].Value,
    interest,
    payoffMonth,
  };
};

// Score a single scenario against a precomputed baseline — the
// scenario-dependent half of computeScenarioImpact, split out so a many-scenario
// search can amortise the baseline across candidates (roadmap 5.2).
export const computeScenarioImpactWithBaseline = (
  loans: Loan[],
  investments: Investment[],
  scenario: ScenarioInput,
  baseline: ScenarioBaseline,
  today: Date = new Date(),
  // Must be the same assets the baseline was computed with, so passive holdings
  // cancel exactly between the scenario and baseline net worth.
  assets: Asset[] = []
): ScenarioImpact => {
  const scenarioNet = forecastNetWorth(
    loans,
    investments,
    baseline.nwHorizon,
    scenario,
    today,
    assets
  );
  const netWorthDelta = roundToCents(
    scenarioNet[scenarioNet.length - 1].Value - baseline.netWorthAtHorizon
  );

  const scenarioInterest = loans.reduce(
    (sum, loan) =>
      sum +
      totalLoanInterest(
        loan,
        baseline.longHorizon,
        scenario.ExtraLoanPayments?.[loan.Id] ?? 0,
        today
      ),
    0
  );
  const interestSaved = roundToCents(baseline.interest - scenarioInterest);

  const scenarioPayoff = debtFreeMonth(
    loans,
    baseline.longHorizon,
    scenario,
    today,
    baseline.length
  );
  const payoffMonthsEarlier =
    baseline.payoffMonth !== undefined && scenarioPayoff !== undefined
      ? Math.max(0, baseline.payoffMonth - scenarioPayoff)
      : 0;

  return { netWorthDelta, interestSaved, payoffMonthsEarlier };
};

export const computeScenarioImpact = (
  loans: Loan[],
  investments: Investment[],
  scenario: ScenarioInput,
  today: Date = new Date(),
  // Optional override for the net-worth comparison horizon. Defaults to the
  // chart's default horizon (Phase 4); the Phase 5 optimizer passes the user's
  // chosen horizon so "net worth at horizon" reflects the picker. Interest and
  // payoff are always measured over a full 50-year lifetime regardless.
  horizon?: Date,
  // Passive holdings included in the net-worth anchor (Phase 7); they cancel out
  // of the returned delta. See computeScenarioBaseline.
  assets: Asset[] = []
): ScenarioImpact => {
  const baseline = computeScenarioBaseline(
    loans,
    investments,
    today,
    horizon,
    assets
  );
  return computeScenarioImpactWithBaseline(
    loans,
    investments,
    scenario,
    baseline,
    today,
    assets
  );
};
