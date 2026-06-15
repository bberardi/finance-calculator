import { Loan } from '../models/loan-model';
import { Investment } from '../models/investment-model';
import { ScenarioInput } from '../models/forecast-model';
import { computeScenarioImpact } from './scenario-impact-helpers';

// The "Next Dollar" optimizer engine (Phase 5). An allocation plan splits $X/mo
// across any number of loans/investments; evaluatePlan scores it against the
// baseline using the same forecast engine the chart and scenarios use. Pure and
// framework-free (D7) so the Phase 5.2 search can run in a Web Worker.
//
// A single-target plan is the degenerate 100%-to-one case. v1 does NOT redirect
// a loan's freed payment after payoff (the "snowball" mode reserved for later) —
// see the score note below for how the ranking still values debt payoff.

const roundToCents = (value: number): number => Math.round(value * 100) / 100;

export interface AllocationPlan {
  // Human-readable description, e.g. "All to Car Loan" or "50% Car Loan / 50% 401k".
  label: string;
  // Extra $/month per target Id (a loan or an investment).
  allocations: Record<string, number>;
}

export interface PlanEvaluation {
  plan: AllocationPlan;
  // Net worth at the forecast horizon vs. baseline.
  netWorthDelta: number;
  // Lifetime loan interest avoided vs. baseline.
  interestSaved: number;
  // Months the projected debt-free date moves earlier.
  payoffMonthsEarlier: number;
  // Ranking objective: net worth gained PLUS interest saved. Net worth at the
  // horizon alone undervalues paying off a loan that's already cleared by then
  // (v1 doesn't redirect the freed payment), so interest avoided — real money
  // that stayed with the user — is added so high-rate debt payoff ranks fairly
  // against investing.
  score: number;
}

// Split a plan's allocations into the engine's loan/contribution maps, dropping
// non-positive amounts. An Id that matches no loan is treated as a contribution
// target (and simply does nothing if it matches no investment either).
const planToScenario = (
  loans: Loan[],
  allocations: Record<string, number>
): ScenarioInput => {
  const loanIds = new Set(loans.map((loan) => loan.Id));
  const ExtraLoanPayments: Record<string, number> = {};
  const ExtraContributions: Record<string, number> = {};
  for (const [id, amount] of Object.entries(allocations)) {
    if (!(amount > 0)) continue;
    if (loanIds.has(id)) {
      ExtraLoanPayments[id] = amount;
    } else {
      ExtraContributions[id] = amount;
    }
  }
  return { ExtraLoanPayments, ExtraContributions };
};

export const evaluatePlan = (
  loans: Loan[],
  investments: Investment[],
  plan: AllocationPlan,
  today: Date = new Date()
): PlanEvaluation => {
  const scenario = planToScenario(loans, plan.allocations);
  const impact = computeScenarioImpact(loans, investments, scenario, today);
  return {
    plan,
    netWorthDelta: impact.netWorthDelta,
    interestSaved: impact.interestSaved,
    payoffMonthsEarlier: impact.payoffMonthsEarlier,
    score: roundToCents(impact.netWorthDelta + impact.interestSaved),
  };
};
