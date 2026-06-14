import dayjs from 'dayjs';
import { Loan } from '../models/loan-model';
import { CompoundingFrequency, Investment } from '../models/investment-model';
import { ForecastPoint, ScenarioInput } from '../models/forecast-model';
import { getMonthlyPayment } from './loan-helpers';
import {
  generateInvestmentGrowth,
  getContributionForYear,
  getInvestmentYear,
  getPeriodsPerYear,
} from './investment-helpers';

const roundToCents = (value: number): number => Math.round(value * 100) / 100;

// Number of months from start to end, rounded up so a series always spans
// at least to the requested end date (never negative).
const getMonthsBetween = (start: Date, end: Date): number =>
  Math.max(0, Math.ceil(dayjs(end).diff(dayjs(start), 'month', true)));

// Months between occurrences for a frequency (monthly=1, quarterly=3, annually=12).
const getIntervalMonths = (frequency: CompoundingFrequency): number =>
  12 / getPeriodsPerYear(frequency);

// Default chart horizon: the longest loan schedule, extended to at least
// 30 years from today when any investments exist (or when there is nothing
// else to anchor to).
export const getDefaultHorizon = (
  loans: Loan[],
  investments: Investment[],
  today: Date = new Date()
): Date => {
  const thirtyYearsOut = dayjs(today).add(30, 'year');

  const latestLoanEnd = loans.reduce<dayjs.Dayjs | undefined>(
    (latest, loan) => {
      const end = dayjs(loan.EndDate);
      return !latest || end.isAfter(latest) ? end : latest;
    },
    undefined
  );

  if (!latestLoanEnd) {
    return thirtyYearsOut.toDate();
  }

  if (investments.length > 0 && thirtyYearsOut.isAfter(latestLoanEnd)) {
    return thirtyYearsOut.toDate();
  }

  return latestLoanEnd.toDate();
};

// Forecast a loan's remaining balance month by month from today to the
// horizon. The series is anchored to CurrentAmount (today's actual balance)
// rather than replaying the theoretical schedule from StartDate, so the
// forecast starts from reality even after past extra payments or drift.
// Index 0 is today; the balance stays at 0 after payoff so series can be
// summed across entities on a shared axis.
export const forecastLoan = (
  loan: Loan,
  horizon: Date,
  extraMonthlyPayment: number = 0,
  today: Date = new Date()
): ForecastPoint[] => {
  const months = getMonthsBetween(today, horizon);
  const start = dayjs(today);
  const monthlyRate = loan.InterestRate / 100 / 12;

  let balance = roundToCents(Math.max(loan.CurrentAmount, 0));

  // When no usable payment is stored, derive one that amortizes today's actual
  // balance over the remaining term — not the original principal over the full
  // term, which would mis-estimate an anchored forecast. A stored 0 (or any
  // non-positive value) is treated as "unset" rather than a real $0/month
  // payment, which would otherwise grow the balance forever. (#51)
  const remainingTerms = Math.max(1, getMonthsBetween(today, loan.EndDate));
  const storedPayment = loan.MonthlyPayment ?? 0;
  const basePayment =
    storedPayment > 0
      ? storedPayment
      : loan.InterestRate > 0
        ? getMonthlyPayment(balance, loan.InterestRate, remainingTerms)
        : roundToCents(balance / remainingTerms);
  const payment = basePayment + extraMonthlyPayment;

  const points: ForecastPoint[] = [{ Date: start.toDate(), Value: balance }];

  for (let month = 1; month <= months; month++) {
    if (balance > 0) {
      const interest = balance * monthlyRate;
      balance = roundToCents(Math.max(0, balance + interest - payment));
    }
    points.push({
      Date: start.add(month, 'month').toDate(),
      Value: balance,
    });
  }

  return points;
};

// Forecast an investment's value month by month from today to the horizon.
// The series is anchored to CurrentValue when provided, otherwise to the
// value projected for today from the investment's historical inputs.
// Contribution and compounding cadence is anchored to the investment's
// StartDate at calendar-month granularity (matching the date-based schedule
// of generateInvestmentGrowth), so a forecast does not shift depending on
// when it is generated. Yearly step-ups follow StartDate anniversaries.
// Index 0 is today.
export const forecastInvestment = (
  investment: Investment,
  horizon: Date,
  extraMonthlyContribution: number = 0,
  today: Date = new Date()
): ForecastPoint[] => {
  const months = getMonthsBetween(today, horizon);
  const start = dayjs(today);

  const growthToToday = generateInvestmentGrowth(investment, today);
  const anchorValue =
    investment.CurrentValue ??
    (growthToToday.length > 0
      ? growthToToday[growthToToday.length - 1].TotalValue
      : investment.StartingBalance);

  const periodRate =
    investment.AverageReturnRate /
    100 /
    getPeriodsPerYear(investment.CompoundingPeriod);
  const compoundingInterval = getIntervalMonths(investment.CompoundingPeriod);

  // Match generateInvestmentGrowth: contributions only apply when both the
  // amount and the frequency are set.
  const baseContribution = investment.ContributionFrequency
    ? (investment.RecurringContribution ?? 0)
    : 0;
  const contributionInterval = investment.ContributionFrequency
    ? getIntervalMonths(investment.ContributionFrequency)
    : 1;

  const investmentStartMonth = dayjs(investment.StartDate).startOf('month');

  let value = anchorValue;
  const points: ForecastPoint[] = [
    { Date: start.toDate(), Value: roundToCents(value) },
  ];

  for (let month = 1; month <= months; month++) {
    const monthDate = start.add(month, 'month');
    // Calendar months since the investment started; events stay anchored to
    // the StartDate cadence regardless of the forecast's run date.
    const elapsedMonths = monthDate
      .startOf('month')
      .diff(investmentStartMonth, 'month');

    if (
      baseContribution > 0 &&
      elapsedMonths >= 0 &&
      elapsedMonths % contributionInterval === 0
    ) {
      // Step-up year attribution (ROADMAP §8.1). The canonical engine,
      // generateInvestmentGrowth, applies the contribution that *opens* each
      // compounding period (dated one contribution-interval before this grid
      // month). On the monthly grid the contribution fired at `monthDate`
      // corresponds to that period-opening contribution, so attribute it to the
      // year of `monthDate − contributionInterval`. Without this shift the
      // monthly grid stepped up one contribution early, diverging from the
      // period engine the day a step-up was configured (the off-by-one this
      // reconciles). Without step-ups the year is irrelevant to the amount, so
      // the no-step-up boundary consistency is unaffected.
      const yearNumber = getInvestmentYear(
        monthDate.subtract(contributionInterval, 'month').toDate(),
        investment.StartDate
      );
      value += getContributionForYear(
        baseContribution,
        yearNumber,
        investment.ContributionStepUpAmount,
        investment.ContributionStepUpType
      );
    }

    if (extraMonthlyContribution > 0) {
      value += extraMonthlyContribution;
    }

    if (elapsedMonths > 0 && elapsedMonths % compoundingInterval === 0) {
      value *= 1 + periodRate;
    }

    points.push({
      Date: monthDate.toDate(),
      Value: roundToCents(value),
    });
  }

  return points;
};

// Forecast overall net worth (total investment value minus total loan
// balance) on a shared monthly axis from today to the horizon. Scenario
// extras are applied to the matching entities by ID.
export const forecastNetWorth = (
  loans: Loan[],
  investments: Investment[],
  horizon: Date,
  scenario?: ScenarioInput,
  today: Date = new Date()
): ForecastPoint[] => {
  const months = getMonthsBetween(today, horizon);
  const start = dayjs(today);

  const loanSeries = loans.map((loan) =>
    forecastLoan(
      loan,
      horizon,
      scenario?.ExtraLoanPayments?.[loan.Id] ?? 0,
      today
    )
  );
  const investmentSeries = investments.map((investment) =>
    forecastInvestment(
      investment,
      horizon,
      scenario?.ExtraContributions?.[investment.Id] ?? 0,
      today
    )
  );

  const points: ForecastPoint[] = [];
  for (let month = 0; month <= months; month++) {
    const assets = investmentSeries.reduce(
      (sum, series) => sum + series[month].Value,
      0
    );
    const debts = loanSeries.reduce(
      (sum, series) => sum + series[month].Value,
      0
    );
    points.push({
      Date: start.add(month, 'month').toDate(),
      Value: roundToCents(assets - debts),
    });
  }

  return points;
};

// First date a forecast series reaches zero, or undefined if it never does
// within the series (e.g. payoff falls beyond the horizon).
export const getPayoffDate = (series: ForecastPoint[]): Date | undefined =>
  series.find((point) => point.Value === 0)?.Date;
