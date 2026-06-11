import dayjs from 'dayjs';
import { Loan } from '../models/loan-model';
import { CompoundingFrequency, Investment } from '../models/investment-model';
import { ForecastPoint, ScenarioInput } from '../models/forecast-model';
import { getMonthlyPayment, getTerms } from './loan-helpers';
import {
  generateInvestmentGrowth,
  getContributionForYear,
  getInvestmentYear,
  getPeriodsPerYear,
} from './investment-helpers';

const roundToCents = (value: number): number => Math.round(value * 100) / 100;

// Number of whole months from start to end (never negative).
const getMonthsBetween = (start: Date, end: Date): number =>
  Math.max(0, dayjs(end).diff(dayjs(start), 'month'));

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
  const basePayment =
    loan.MonthlyPayment ??
    getMonthlyPayment(loan.Principal, loan.InterestRate, getTerms(loan));
  const payment = basePayment + extraMonthlyPayment;

  let balance = Math.max(loan.CurrentAmount, 0);
  const points: ForecastPoint[] = [
    { Date: start.toDate(), Value: roundToCents(balance) },
  ];

  for (let month = 1; month <= months; month++) {
    if (balance > 0) {
      const interest = balance * monthlyRate;
      balance = Math.max(0, balance + interest - payment);
    }
    points.push({
      Date: start.add(month, 'month').toDate(),
      Value: roundToCents(balance),
    });
  }

  return points;
};

// Forecast an investment's value month by month from today to the horizon.
// The series is anchored to CurrentValue when provided, otherwise to the
// value projected for today from the investment's historical inputs.
// Contributions land at the start of each contribution interval (with any
// configured yearly step-up, anchored to the investment's start date);
// interest compounds at the end of each compounding interval. Index 0 is
// today.
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
  const contributionInterval = getIntervalMonths(
    investment.ContributionFrequency ?? CompoundingFrequency.Monthly
  );
  const baseContribution = investment.RecurringContribution ?? 0;

  let value = anchorValue;
  const points: ForecastPoint[] = [
    { Date: start.toDate(), Value: roundToCents(value) },
  ];

  for (let month = 1; month <= months; month++) {
    const monthDate = start.add(month, 'month');

    if (baseContribution > 0 && (month - 1) % contributionInterval === 0) {
      const yearNumber = getInvestmentYear(
        monthDate.toDate(),
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

    if (month % compoundingInterval === 0) {
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
