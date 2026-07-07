import dayjs from 'dayjs';
import { Loan } from '../models/loan-model';
import { CompoundingFrequency, Investment } from '../models/investment-model';
import { Asset } from '../models/asset-model';
import { ForecastPoint, ScenarioInput } from '../models/forecast-model';
import {
  PMI_LTV_THRESHOLD,
  getMonthlyEscrow,
  getMonthlyPayment,
  isPmiActive,
} from './loan-helpers';
import { assetNetWorthSign, forecastAsset } from './asset-helpers';
import {
  employerMatchOnContribution,
  generateInvestmentGrowth,
  getAnniversaryDate,
  getContributionForYear,
  getContributionsWithStepUp,
  getInvestmentYear,
  getNextCompoundingDate,
  getPeriodsPerYear,
  hasPassedAnniversary,
} from './investment-helpers';

const roundToCents = (value: number): number => Math.round(value * 100) / 100;

// Number of months from start to end, rounded up so a series always spans
// at least to the requested end date (never negative).
const getMonthsBetween = (start: Date, end: Date): number =>
  Math.max(0, Math.ceil(dayjs(end).diff(dayjs(start), 'month', true)));

// Months between occurrences for a frequency (monthly=1, quarterly=3, annually=12).
const getIntervalMonths = (frequency: CompoundingFrequency): number =>
  12 / getPeriodsPerYear(frequency);

// Fraction (0 ≤ f < 1) of the current compounding period already elapsed at
// `today`, measured exactly as generateInvestmentGrowth does: step from the
// StartDate cadence to the last boundary on or before `today` and pro-rate by
// elapsed/total days of that period. Returns 0 when `today` lands on a
// boundary (or before StartDate) — no partial period is in flight. (#88)
const getPartialPeriodFraction = (
  startDate: Date,
  today: Date,
  frequency: CompoundingFrequency
): number => {
  if (today <= startDate) {
    return 0;
  }
  let boundary = new Date(startDate.getTime());
  let next = getNextCompoundingDate(boundary, frequency);
  while (next <= today) {
    boundary = next;
    next = getNextCompoundingDate(boundary, frequency);
  }
  // boundary ≤ today < next.
  if (boundary.getTime() === today.getTime()) {
    return 0;
  }
  const totalMs = next.getTime() - boundary.getTime();
  const elapsedMs = today.getTime() - boundary.getTime();
  return elapsedMs / totalMs;
};

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

  // No loans to anchor to, or every loan's scheduled EndDate is already in the
  // past (a loans-only portfolio that is behind on / past the nominal term of
  // its loans but still owes a balance): there is nothing further out to anchor
  // the horizon to, so fall back to the default 30-year horizon. Returning the
  // latest (past) EndDate here would make the horizon earlier than today and
  // collapse the forecast chart to a single point. (#86)
  if (!latestLoanEnd || !latestLoanEnd.isAfter(dayjs(today))) {
    return thirtyYearsOut.toDate();
  }

  if (investments.length > 0 && thirtyYearsOut.isAfter(latestLoanEnd)) {
    return thirtyYearsOut.toDate();
  }

  return latestLoanEnd.toDate();
};

// The monthly payment the forecast actually applies to a loan. When a usable
// positive MonthlyPayment is stored it is used as-is; otherwise a payment is
// derived that amortizes today's actual balance over the remaining term — not
// the original principal over the full term, which would mis-estimate an
// anchored forecast. A stored 0 (or any non-positive value) is treated as
// "unset" rather than a real $0/month payment, which would otherwise grow the
// balance forever. (#51)
//
// Shared by forecastLoan and the dashboard summary so the "Monthly commitments"
// card and the chart never disagree on a loan's outflow: a loan imported with
// MonthlyPayment: 0 (or no MonthlyPayment key) amortizes in the forecast, so it
// must contribute that same derived payment to the commitment total. (#91)
export const getEffectiveMonthlyPayment = (
  loan: Loan,
  today: Date = new Date()
): number => {
  const balance = roundToCents(Math.max(loan.CurrentAmount, 0));
  const remainingTerms = Math.max(1, getMonthsBetween(today, loan.EndDate));
  const storedPayment = loan.MonthlyPayment ?? 0;
  return storedPayment > 0
    ? storedPayment
    : loan.InterestRate > 0
      ? getMonthlyPayment(balance, loan.InterestRate, remainingTerms)
      : roundToCents(balance / remainingTerms);
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
  today: Date = new Date(),
  // A one-time lump-sum payment applied once, alongside the first month's payment
  // (Phase 8.2). Like the recurring extra it reduces principal after that month's
  // interest accrues, so a $X lump and one month of $X extra hit the balance
  // identically — the difference is only that the lump never recurs. Index 0
  // (today) is left at CurrentAmount so baseline and scenario agree at the anchor
  // and diverge from month 1.
  oneTimePayment: number = 0
): ForecastPoint[] => {
  const months = getMonthsBetween(today, horizon);
  const start = dayjs(today);
  const monthlyRate = loan.InterestRate / 100 / 12;

  let balance = roundToCents(Math.max(loan.CurrentAmount, 0));

  const payment = getEffectiveMonthlyPayment(loan, today) + extraMonthlyPayment;

  const points: ForecastPoint[] = [{ Date: start.toDate(), Value: balance }];

  for (let month = 1; month <= months; month++) {
    if (balance > 0) {
      const interest = balance * monthlyRate;
      const oneTimeThisMonth = month === 1 ? oneTimePayment : 0;
      balance = roundToCents(
        Math.max(0, balance + interest - payment - oneTimeThisMonth)
      );
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
  today: Date = new Date(),
  // A one-time lump-sum contribution applied once, at the first forecast month
  // (Phase 8.2). It is added to that month's money-in exactly like the recurring
  // extra — so it earns the employer match up to the remaining annual cap and
  // compounds from month 1 — but it does not recur.
  oneTimeContribution: number = 0
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

  // Off-boundary anchor reconciliation (#88, #103). When `today` falls inside a
  // compounding period (fraction f elapsed), contributions made during the
  // remainder of the period still earn the full period rate (they open the
  // period in the canonical engine), but the carried anchor grows by a
  // first-boundary factor that depends on WHICH anchor we carried:
  //
  //  - generateInvestmentGrowth / StartingBalance anchor: it already bakes in
  //    this period's pro-rated slice (base·(1 + r·f)), so applying a full
  //    `periodRate` at the next boundary would count that slice twice. Complete
  //    the period instead with (1 + r)/(1 + r·f), which divides the baked-in
  //    slice back out and upgrades it to exactly one full period → base·(1 + r).
  //
  //  - user-supplied CurrentValue anchor: it is just today's actual value, with
  //    NO pro-rated slice baked in. Applying (1 + r)/(1 + r·f) would divide out a
  //    slice that was never added, systematically under-crediting the first
  //    partial period and every value after it (#103). It must instead earn only
  //    the *remaining* fraction of the period to the next boundary. Use the same
  //    LINEAR day-fraction pro-rating generateInvestmentGrowth uses for a partial
  //    period (PRECISION.md): 1 + r·(1 − f).
  //
  // Both reduce to (1 + r) when `today` is on a boundary (f = 0), so boundary-
  // anchored consistency — and the #88 off-boundary tests — are unchanged.
  const partialFraction = getPartialPeriodFraction(
    investment.StartDate,
    today,
    investment.CompoundingPeriod
  );
  const usesCurrentValueAnchor = investment.CurrentValue != null;
  const firstBoundaryFactor = usesCurrentValueAnchor
    ? 1 + periodRate * (1 - partialFraction)
    : (1 + periodRate) / (1 + periodRate * partialFraction);
  let firstBoundaryApplied = false;
  // Contributions added since today within the still-open first period; these
  // earn the full period rate, separate from the carried anchor's correction.
  let partialPeriodContributions = 0;
  // Employer-match accrual state (ROADMAP 8.1): matchable contribution used this
  // investment-year, reset at year boundaries so the annual cap holds.
  let matchYear = 0;
  let matchCumThisYear = 0;

  // Contributions made earlier in the CURRENT investment-year (from the last
  // StartDate anniversary up to `today`) already consumed match-cap headroom in
  // the canonical engine, and they're baked into the anchor value. Seed the
  // accrual state with them — otherwise a mid-year-anchored forecast re-grants
  // match the employer already paid this year, over-crediting the first partial
  // year by up to the full annual match whenever contributions exceed the cap.
  // The window [last anniversary, today) is exactly the set of contribution
  // dates getInvestmentYear attributes to the current year (anniversaries are
  // contribution dates, so no date between them and `today` changes year).
  const matchActive =
    (investment.EmployerMatchRate ?? 0) > 0 &&
    (investment.EmployerMatchLimitPct ?? 0) > 0 &&
    (investment.AnnualSalary ?? 0) > 0;
  if (
    matchActive &&
    baseContribution > 0 &&
    investment.ContributionFrequency &&
    today > investment.StartDate
  ) {
    const anniversaryYear = hasPassedAnniversary(today, investment.StartDate)
      ? today.getFullYear()
      : today.getFullYear() - 1;
    matchYear = getInvestmentYear(today, investment.StartDate);
    matchCumThisYear = getContributionsWithStepUp(
      getAnniversaryDate(investment.StartDate, anniversaryYear),
      today,
      investment.StartDate,
      baseContribution,
      investment.ContributionFrequency,
      investment.ContributionStepUpAmount,
      investment.ContributionStepUpType
    );
  }

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

    // Contributions added before the first compounding boundary belong to the
    // open period and earn the full period rate there.
    let contributionThisMonth = 0;
    // The base contribution's canonical investment-year (set only when it fires),
    // used to attribute the employer match to a year consistently with the period
    // growth engine.
    let baseContributionYear: number | undefined;

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
      contributionThisMonth += getContributionForYear(
        baseContribution,
        yearNumber,
        investment.ContributionStepUpAmount,
        investment.ContributionStepUpType
      );
      baseContributionYear = yearNumber;
    }

    if (extraMonthlyContribution > 0) {
      contributionThisMonth += extraMonthlyContribution;
    }

    // One-time lump-sum contribution (ROADMAP 8.2): applied once at month 1, then
    // folded into the same money-in as the recurring/extra contributions below so
    // it is matched and compounded identically.
    if (oneTimeContribution > 0 && month === 1) {
      contributionThisMonth += oneTimeContribution;
    }

    // Employer match (ROADMAP 8.1) on this month's total contribution (recurring
    // + any optimizer extra), accrued against the annual cap per investment-year.
    // Attribute to the base contribution's canonical year when it fires (matching
    // generateInvestmentGrowth), else this grid month's year. Folded into the
    // month's money-in so it earns the period rate like any contribution.
    if (contributionThisMonth > 0) {
      const contributionYear =
        baseContributionYear ??
        getInvestmentYear(monthDate.toDate(), investment.StartDate);
      if (contributionYear !== matchYear) {
        matchYear = contributionYear;
        matchCumThisYear = 0;
      }
      const employerMatch = employerMatchOnContribution(
        matchCumThisYear,
        contributionThisMonth,
        investment
      );
      matchCumThisYear += contributionThisMonth;
      contributionThisMonth += employerMatch;
    }

    value += contributionThisMonth;
    if (!firstBoundaryApplied) {
      partialPeriodContributions += contributionThisMonth;
    }

    if (elapsedMonths > 0 && elapsedMonths % compoundingInterval === 0) {
      if (!firstBoundaryApplied) {
        // First boundary after an off-boundary `today`: grow the carried anchor
        // by the complementary factor, and credit this period's contributions
        // the full period rate. With f = 0 (boundary anchor) this collapses to
        // value *= (1 + periodRate).
        value =
          (value - partialPeriodContributions) * firstBoundaryFactor +
          partialPeriodContributions * (1 + periodRate);
        firstBoundaryApplied = true;
      } else {
        value *= 1 + periodRate;
      }
    }

    points.push({
      Date: monthDate.toDate(),
      Value: roundToCents(value),
    });
  }

  return points;
};

// Best-known value of an investment as of `today`: the explicit CurrentValue
// anchor when set, otherwise the value the engine projects to today from the
// investment's historical inputs. This is exactly forecastInvestment's index-0
// anchor, exposed as a single source of truth so the investment table's
// "Current Value" column/totals and the dashboard's "Total assets" never show
// two different figures for the same position. (#125)
export const currentInvestmentValue = (
  investment: Investment,
  today: Date = new Date()
): number => forecastInvestment(investment, today, 0, today)[0].Value;

// Forecast overall net worth on a shared monthly axis from today to the
// horizon: total investment value, plus simple assets (cash/property/custom,
// Phase 7), minus total loan balance and any custom-liability assets. Scenario
// extras are applied to the matching loans/investments by ID. `assets` is an
// optional trailing parameter so the many existing call sites keep working
// unchanged; passive holdings take no scenario extras.
export const forecastNetWorth = (
  loans: Loan[],
  investments: Investment[],
  horizon: Date,
  scenario?: ScenarioInput,
  today: Date = new Date(),
  assets: Asset[] = []
): ForecastPoint[] => {
  const months = getMonthsBetween(today, horizon);
  const start = dayjs(today);

  const loanSeries = loans.map((loan) =>
    forecastLoan(
      loan,
      horizon,
      scenario?.ExtraLoanPayments?.[loan.Id] ?? 0,
      today,
      scenario?.OneTimeLoanPayments?.[loan.Id] ?? 0
    )
  );
  const investmentSeries = investments.map((investment) =>
    forecastInvestment(
      investment,
      horizon,
      scenario?.ExtraContributions?.[investment.Id] ?? 0,
      today,
      scenario?.OneTimeContributions?.[investment.Id] ?? 0
    )
  );
  const assetSeries = assets.map((asset) =>
    forecastAsset(asset, horizon, today)
  );

  const points: ForecastPoint[] = [];
  for (let month = 0; month <= months; month++) {
    const investmentValue = investmentSeries.reduce(
      (sum, series) => sum + series[month].Value,
      0
    );
    // Ordinary assets add, custom liabilities subtract (assetNetWorthSign).
    const assetValue = assetSeries.reduce(
      (sum, series, index) =>
        sum + assetNetWorthSign(assets[index]) * series[month].Value,
      0
    );
    const debts = loanSeries.reduce(
      (sum, series) => sum + series[month].Value,
      0
    );
    points.push({
      Date: start.add(month, 'month').toDate(),
      Value: roundToCents(investmentValue + assetValue - debts),
    });
  }

  return points;
};

// Forecast a property's home equity (Phase 7.2): the linked mortgage's
// remaining balance subtracted from the property's projected value, month by
// month on the shared axis. Makes net worth honest for homeowners — the same
// figure the aggregate net-worth line already reflects, surfaced on its own so
// the property row can show equity directly. Pure composition of forecastAsset
// and forecastLoan, both already rounded per point.
export const forecastHomeEquity = (
  property: Asset,
  loan: Loan,
  horizon: Date,
  today: Date = new Date()
): ForecastPoint[] => {
  const propertySeries = forecastAsset(property, horizon, today);
  const loanSeries = forecastLoan(loan, horizon, 0, today);
  return propertySeries.map((point, index) => ({
    Date: point.Date,
    Value: roundToCents(point.Value - loanSeries[index].Value),
  }));
};

// First date a forecast series reaches zero, or undefined if it never does
// within the series (e.g. payoff falls beyond the horizon).
export const getPayoffDate = (series: ForecastPoint[]): Date | undefined =>
  series.find((point) => point.Value === 0)?.Date;

// A loan's full monthly outflow split into the amortizing principal-and-interest,
// the escrow (property tax + homeowners insurance), and PMI (Phase 8.3). `total`
// is the "true monthly payment". For a plain loan with no escrow/PMI fields,
// escrow and pmi are 0 and total equals the P&I payment — fully backward
// compatible, so existing loans and the commitment total are unchanged.
export interface MonthlyPaymentBreakdown {
  principalAndInterest: number;
  escrow: number;
  pmi: number;
  total: number;
}

export const getMonthlyPaymentBreakdown = (
  loan: Loan,
  today: Date = new Date()
): MonthlyPaymentBreakdown => {
  const principalAndInterest = getEffectiveMonthlyPayment(loan, today);
  const escrow = getMonthlyEscrow(loan);
  // PMI only applies while LTV is above the 80% line; below it the breakdown
  // drops it, exactly as the lender would. isPmiActive already guarantees a
  // positive MonthlyPmi, so the non-null assertion is safe.
  const pmi = isPmiActive(loan) ? roundToCents(loan.MonthlyPmi!) : 0;
  return {
    principalAndInterest,
    escrow,
    pmi,
    total: roundToCents(principalAndInterest + escrow + pmi),
  };
};

// The date PMI drops off: the first forecast month the balance falls to or below
// 80% of the home value (LTV ≤ 80%). Undefined when the loan carries no PMI (no
// premium, or no home value to measure against) or never builds enough equity to
// cross the line within its schedule. When today's balance is already at/below
// the line the first point (today) is returned — PMI is not owed at all.
export const getPmiEndDate = (
  loan: Loan,
  today: Date = new Date()
): Date | undefined => {
  if (!((loan.MonthlyPmi ?? 0) > 0) || !((loan.HomeValue ?? 0) > 0)) {
    return undefined;
  }
  // The guard above guarantees a positive HomeValue past this point.
  const threshold = PMI_LTV_THRESHOLD * loan.HomeValue!;
  const horizon = getDefaultHorizon([loan], [], today);
  const series = forecastLoan(loan, horizon, 0, today);
  return series.find((point) => point.Value <= threshold)?.Date;
};
