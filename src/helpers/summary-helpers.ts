import { Loan } from '../models/loan-model';
import { Investment } from '../models/investment-model';
import { Asset } from '../models/asset-model';
import {
  currentInvestmentValue,
  forecastLoan,
  getMonthlyPaymentBreakdown,
} from './forecast-helpers';
import {
  getContributionForYear,
  getInvestmentYear,
  getPeriodsPerYear,
} from './investment-helpers';
import { getAssetValueToday, isAssetLiability } from './asset-helpers';

// "Today" net-worth summary metrics for the dashboard (Phase 3.1). Debt and
// asset totals are read from the forecast engine's today-anchor (index 0), so
// the cards show exactly the numbers the chart starts from — a single source of
// truth. Pure and framework-free (D7).

const roundToCents = (value: number): number => Math.round(value * 100) / 100;

export interface PositionSummary {
  // Σ current loan balances (liabilities).
  totalDebt: number;
  // Σ current investment values (the engine's today anchor, honoring CurrentValue).
  totalAssets: number;
  // totalAssets − totalDebt.
  netWorth: number;
  // Σ monthly-equivalent outflow: loan payments + investment contributions,
  // each contribution normalized to a monthly amount by its cadence.
  monthlyCommitments: number;
}

export const summarizePositions = (
  loans: Loan[],
  investments: Investment[],
  today: Date = new Date(),
  assets: Asset[] = []
): PositionSummary => {
  // Ordinary assets (cash/property/custom) count toward assets at today's
  // value; custom liabilities count toward debt — a single source of truth with
  // the net-worth roll-up.
  const assetHoldings = assets.filter((asset) => !isAssetLiability(asset));
  const liabilityHoldings = assets.filter((asset) => isAssetLiability(asset));

  // forecast*(…, today, 0, today) yields a single point at today's anchor.
  const totalDebt = roundToCents(
    loans.reduce(
      (sum, loan) => sum + forecastLoan(loan, today, 0, today)[0].Value,
      0
    ) +
      liabilityHoldings.reduce(
        (sum, asset) => sum + getAssetValueToday(asset),
        0
      )
  );
  const totalAssets = roundToCents(
    investments.reduce(
      (sum, investment) => sum + currentInvestmentValue(investment, today),
      0
    ) + assetHoldings.reduce((sum, asset) => sum + getAssetValueToday(asset), 0)
  );

  // The full "true monthly payment" (Phase 8.3): principal & interest plus escrow
  // (tax + insurance) and any active PMI, so the commitments card reflects the
  // real monthly outflow, not just P&I. The P&I term is the engine's effective
  // payment (the same value forecastLoan applies), so a loan with an unset/0
  // MonthlyPayment that the forecast amortizes still contributes its derived
  // payment. (#91) A loan with no escrow/PMI fields contributes P&I alone.
  const loanCommitments = loans.reduce(
    (sum, loan) => sum + getMonthlyPaymentBreakdown(loan, today).total,
    0
  );
  const investmentCommitments = investments.reduce((sum, investment) => {
    // Contributions only count when both an amount and a cadence are set
    // (mirrors the engine).
    const base = investment.RecurringContribution ?? 0;
    if (!investment.ContributionFrequency || !(base > 0)) {
      return sum;
    }
    // The contribution actually being made now — the base stepped up to the
    // current investment year — so the card reflects the same outflow the
    // forecast applies this month, not the year-one amount. (#91-style
    // cross-consistency, for step-ups.)
    const current = getContributionForYear(
      base,
      getInvestmentYear(today, investment.StartDate),
      investment.ContributionStepUpAmount,
      investment.ContributionStepUpType
    );
    const perYear =
      current * getPeriodsPerYear(investment.ContributionFrequency);
    return sum + perYear / 12;
  }, 0);

  return {
    totalDebt,
    totalAssets,
    netWorth: roundToCents(totalAssets - totalDebt),
    monthlyCommitments: roundToCents(loanCommitments + investmentCommitments),
  };
};
