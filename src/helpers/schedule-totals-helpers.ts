import { AmortizationScheduleEntry } from '../models/loan-model';
import { InvestmentGrowthEntry } from '../models/investment-model';

// Lifetime-totals for the schedule popouts (roadmap 6.5). These are pure
// reductions over series the math core already produces
// (generateAmortizationSchedule / generateInvestmentGrowth), so the popout
// footers stay a thin read of tested numbers rather than UI-side arithmetic.
//
// Rounding policy (PRECISION.md §1): the per-row fields are already rounded to
// cents, but summing many cent values in binary floating point can leave a
// sub-cent artifact (e.g. 1015.0199999999998). We therefore round the final
// total to cents so the footer agrees, to the cent, with the column it sums.
const roundToCents = (value: number): number => Math.round(value * 100) / 100;

export interface AmortizationTotals {
  // Total principal repaid over the schedule. For a schedule that runs to
  // payoff this equals the loan's original principal (money conservation).
  totalPrincipal: number;
  // Total interest paid over the life of the loan ("interest paid").
  totalInterest: number;
  // Everything paid: principal + interest.
  totalPaid: number;
}

export const getAmortizationTotals = (
  schedule: AmortizationScheduleEntry[]
): AmortizationTotals => {
  let totalPrincipal = 0;
  let totalInterest = 0;
  for (const entry of schedule) {
    totalPrincipal += entry.PrincipalPayment;
    totalInterest += entry.InterestPayment;
  }
  totalPrincipal = roundToCents(totalPrincipal);
  totalInterest = roundToCents(totalInterest);
  return {
    totalPrincipal,
    totalInterest,
    totalPaid: roundToCents(totalPrincipal + totalInterest),
  };
};

export interface GrowthTotals {
  // Recurring contributions paid in over the schedule ("contributed").
  // Excludes the starting balance, which was never a contribution.
  totalContributions: number;
  // Interest/returns earned over the schedule ("earned").
  totalInterest: number;
  // Everything the investor put in: starting balance + contributions.
  endingInvested: number;
  // Final projected value (the last entry's TotalValue). Falls back to the
  // starting balance for an empty schedule so the footer is always defined.
  endingValue: number;
}

export const getGrowthTotals = (
  growth: InvestmentGrowthEntry[],
  startingBalance: number
): GrowthTotals => {
  let totalContributions = 0;
  let totalInterest = 0;
  for (const entry of growth) {
    totalContributions += entry.ContributionAmount;
    totalInterest += entry.InterestEarned;
  }
  totalContributions = roundToCents(totalContributions);
  totalInterest = roundToCents(totalInterest);
  const endingValue =
    growth.length > 0 ? growth[growth.length - 1].TotalValue : startingBalance;
  return {
    totalContributions,
    totalInterest,
    endingInvested: roundToCents(startingBalance + totalContributions),
    endingValue: roundToCents(endingValue),
  };
};
