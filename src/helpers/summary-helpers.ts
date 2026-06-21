import { Loan } from '../models/loan-model';
import { Investment } from '../models/investment-model';
import { Asset } from '../models/asset-model';
import {
  forecastInvestment,
  forecastLoan,
  getEffectiveMonthlyPayment,
} from './forecast-helpers';
import { getPeriodsPerYear } from './investment-helpers';
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
      (sum, investment) =>
        sum + forecastInvestment(investment, today, 0, today)[0].Value,
      0
    ) + assetHoldings.reduce((sum, asset) => sum + getAssetValueToday(asset), 0)
  );

  // Use the engine's effective payment (the same value forecastLoan applies),
  // so a loan with an unset/0 MonthlyPayment that the forecast amortizes still
  // contributes its derived payment to the commitment total. (#91)
  const loanCommitments = loans.reduce(
    (sum, loan) => sum + getEffectiveMonthlyPayment(loan, today),
    0
  );
  const investmentCommitments = investments.reduce((sum, investment) => {
    // Contributions only count when a cadence is set (mirrors the engine).
    if (!investment.ContributionFrequency) {
      return sum;
    }
    const perYear =
      (investment.RecurringContribution ?? 0) *
      getPeriodsPerYear(investment.ContributionFrequency);
    return sum + perYear / 12;
  }, 0);

  return {
    totalDebt,
    totalAssets,
    netWorth: roundToCents(totalAssets - totalDebt),
    monthlyCommitments: roundToCents(loanCommitments + investmentCommitments),
  };
};
