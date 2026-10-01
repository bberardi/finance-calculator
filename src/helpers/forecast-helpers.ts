import dayjs from 'dayjs';
import { Loan } from '../models/loan-model';
import { Investment } from '../models/investment-model';
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
  InvestmentContributionEvent,
  runInvestmentEngine,
} from './investment-helpers';

const roundToCents = (value: number): number => Math.round(value * 100) / 100;

// Number of months from start to end, rounded up so a series always spans
// at least to the requested end date (never negative).
const getMonthsBetween = (start: Date, end: Date): number =>
  Math.max(0, Math.ceil(dayjs(end).diff(dayjs(start), 'month', true)));

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
// The series is a read of the single investment engine (runInvestmentEngine) at
// each grid month: index 0 is today's pro-rated value, and each later point is
// the value at the last compounding boundary on or before it plus the money
// added since. So it agrees with generateInvestmentGrowth — the Growth
// Schedule, PIT view and dashboard — at every compounding boundary, for every
// compounding / contribution cadence and whatever day the forecast is run.
// (#165, #187, #217)
//
// When CurrentValue is set, it replaces the modeled value of the money already
// in the account: that anchor grows from today on (earning only the remainder
// of today's compounding period, #103), and contributions from today on are
// added on top exactly as the engine credits them (employer match included,
// with this year's cap already partly used by earlier contributions).
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
  const dates = Array.from({ length: months + 1 }, (_, month) =>
    start.add(month, 'month').toDate()
  );

  // Month k's extra (and the one-time lump at month 1) is contributed at the
  // start of that month's interval, so it shows in month k's point.
  const extras: InvestmentContributionEvent[] = [];
  for (let month = 1; month <= months; month++) {
    const amount =
      Math.max(0, extraMonthlyContribution) +
      (month === 1 ? Math.max(0, oneTimeContribution) : 0);
    if (amount > 0) {
      extras.push({ Date: dates[month - 1], Amount: amount });
    }
  }

  const end = dates[dates.length - 1];
  const projected = runInvestmentEngine(investment, end, {
    extras,
    sampleDates: dates,
    lumpDate: today,
    accrueAt: today,
  });

  let values = projected.samples;
  if (investment.CurrentValue != null) {
    // Money already in the account per the model (no contributions from today
    // on); the difference to `projected` is the money added from today on.
    const carried = runInvestmentEngine(investment, end, {
      sampleDates: dates,
      contributionCutoff: today,
      accrueAt: today,
    }).samples;
    const anchor = investment.CurrentValue;
    values = projected.samples.map(
      (value, index) =>
        anchor * projected.lumpFactors[index] + value - carried[index]
    );
  }

  return values.map((value, index) => ({
    Date: dates[index],
    Value: roundToCents(value),
  }));
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
