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

// Dashboard milestone derivations (Phase 3.2): the projected debt-free date and
// net worth at +5y / +10y / +30y. Cheap reads off the same engine series the
// chart uses. Pure and framework-free (D7).

export const MILESTONE_YEARS = [5, 10, 30] as const;

export interface NetWorthMilestone {
  years: number;
  value: number;
}

export interface Milestones {
  // First date Σ loan balances reach zero, or undefined if there are no loans
  // or none pay off within the horizon.
  debtFreeDate?: Date;
  netWorthAt: NetWorthMilestone[];
}

export const computeMilestones = (
  loans: Loan[],
  investments: Investment[],
  today: Date = new Date(),
  assets: Asset[] = [],
  // Optional what-if extras (Phase 8.5): when supplied, the milestones reflect the
  // scenario (e.g. an allocation strategy's extra payments/contributions) instead
  // of the baseline. Omitted by the dashboard, which shows baseline milestones.
  scenario?: ScenarioInput
): Milestones => {
  // Extend the horizon to at least 30 years so the +30y milestone always exists,
  // while still covering a longer loan schedule for the debt-free date.
  const defaultHorizon = getDefaultHorizon(loans, investments, today);
  const thirtyYears = dayjs(today).add(30, 'year').toDate();
  const horizon = dayjs(defaultHorizon).isAfter(thirtyYears)
    ? defaultHorizon
    : thirtyYears;

  // Assets (cash/property/custom) flow into the net-worth milestones; the
  // debt-free date below stays loan-only (a custom liability has no payoff
  // schedule — it just decays at its rate).
  const netWorth = forecastNetWorth(
    loans,
    investments,
    horizon,
    scenario,
    today,
    assets
  );

  const netWorthAt = MILESTONE_YEARS.map((years) => ({
    years,
    value: netWorth[Math.min(years * 12, netWorth.length - 1)].Value,
  }));

  // Debt-free: the first month the summed loan balances reach zero.
  let debtFreeDate: Date | undefined;
  if (loans.length > 0) {
    const loanSeries = loans.map((loan) =>
      forecastLoan(
        loan,
        horizon,
        scenario?.ExtraLoanPayments?.[loan.Id] ?? 0,
        today,
        scenario?.OneTimeLoanPayments?.[loan.Id] ?? 0
      )
    );
    for (let month = 0; month < netWorth.length; month++) {
      const totalDebt = loanSeries.reduce(
        (sum, series) => sum + series[month].Value,
        0
      );
      if (totalDebt <= 0) {
        debtFreeDate = netWorth[month].Date;
        break;
      }
    }
  }

  return { debtFreeDate, netWorthAt };
};
