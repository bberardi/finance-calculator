import {
  Investment,
  InvestmentGrowthEntry,
  PitInvestment,
  CompoundingFrequency,
  StepUpType,
} from '../models/investment-model';

// Returns the number of compounding periods per year based on frequency
export const getPeriodsPerYear = (frequency: CompoundingFrequency): number => {
  switch (frequency) {
    case CompoundingFrequency.Monthly:
      return 12;
    case CompoundingFrequency.Quarterly:
      return 4;
    case CompoundingFrequency.Annually:
      return 1;
    default:
      return 1;
  }
};

const roundToCents = (value: number): number => Math.round(value * 100) / 100;

// Get the anniversary date for a given year based on a start date
// Handles leap year edge case: if start date is Feb 29, uses Feb 28 for non-leap years
export const getAnniversaryDate = (
  startDate: Date,
  targetYear: number
): Date => {
  const anniversaryMonth = startDate.getMonth();
  let anniversaryDay = startDate.getDate();

  // Check if start date is Feb 29 (leap day)
  if (anniversaryMonth === 1 && anniversaryDay === 29) {
    // Check if target year is a leap year
    const isLeapYear =
      (targetYear % 4 === 0 && targetYear % 100 !== 0) ||
      targetYear % 400 === 0;
    if (!isLeapYear) {
      // Use Feb 28 for non-leap years
      anniversaryDay = 28;
    }
  }

  return new Date(targetYear, anniversaryMonth, anniversaryDay);
};

// Check if we've passed the anniversary for a given year
// Returns true if currentDate is on or after the anniversary in that year
export const hasPassedAnniversary = (
  currentDate: Date,
  startDate: Date
): boolean => {
  const anniversaryThisYear = getAnniversaryDate(
    startDate,
    currentDate.getFullYear()
  );
  return currentDate >= anniversaryThisYear;
};

// Returns the number of periods between start date and end date (or current date)
export const getInvestmentPeriods = (
  investment: Investment,
  endDate?: Date
): number => {
  if (!investment.StartDate) {
    return 0;
  }

  const end = endDate ?? new Date();
  const start = investment.StartDate;

  // If the investment started in the future, return 0 periods elapsed so far
  if (end < start) {
    return 0;
  }

  const periodsPerYear = getPeriodsPerYear(investment.CompoundingPeriod);

  // Calculate the exact number of periods based on the compounding frequency
  let periods: number;

  if (periodsPerYear === 12) {
    // Monthly
    periods =
      (end.getFullYear() - start.getFullYear()) * 12 +
      (end.getMonth() - start.getMonth());
    // Add partial month if we've passed the start day
    if (end.getDate() >= start.getDate()) {
      periods += 1;
    }
  } else if (periodsPerYear === 4) {
    // Quarterly — anchored to StartDate, not the calendar (Jan/Apr/Jul/Oct)
    // quarters. Bucketing into calendar quarters added a phantom period for any
    // investment that didn't start on a quarter boundary, disagreeing with
    // generateInvestmentGrowth (which steps 3 months at a time from StartDate).
    // Count whole months elapsed since StartDate (same start-day comparison as
    // the monthly branch) and divide into 3-month quarters. (#75)
    let monthsElapsed =
      (end.getFullYear() - start.getFullYear()) * 12 +
      (end.getMonth() - start.getMonth());
    if (end.getDate() < start.getDate()) {
      monthsElapsed -= 1;
    }
    periods = Math.floor(monthsElapsed / 3) + 1;
  } else {
    // Annually
    periods = end.getFullYear() - start.getFullYear();
    // Add partial year if we've passed the anniversary (using shared helper for consistency)
    if (hasPassedAnniversary(end, start)) {
      periods += 1;
    }
  }

  // Return at least 1 period: an investment whose start is today or in the
  // past has elapsed at least one period. (end < start already returned 0
  // above, so end >= start holds here.)
  return Math.max(periods, 1);
};

// Add `months` calendar months to a date, CLAMPING to the last valid day of the
// target month (Jan 31 + 1mo → Feb 28) instead of OVERFLOWING the way bare
// Date.setMonth does ("Feb 31" → Mar 3). Native Date math (no dayjs) keeps this
// cheap on the hot forecast/growth loops. Time-of-day is preserved.
const addMonthsClamped = (date: Date, months: number): Date => {
  const day = date.getDate();
  const result = new Date(date.getTime());
  // Move to the 1st first so the pending large day can't itself overflow the
  // month while we shift months.
  result.setDate(1);
  result.setMonth(result.getMonth() + months);
  // Day 0 of the following month is the last day of the target month.
  const lastDayOfMonth = new Date(
    result.getFullYear(),
    result.getMonth() + 1,
    0
  ).getDate();
  result.setDate(Math.min(day, lastDayOfMonth));
  return result;
};

// Get the next compounding date based on frequency.
//
// Clamps month/year steps to the last valid day of the target month rather than
// overflowing. For a day-29..31 start, Date.setMonth's overflow ("Feb 31" →
// Mar 3) silently skipped a whole month (February), so generateInvestmentGrowth
// ran one calendar month behind for the life of the investment and disagreed
// with the calendar period counters (getInvestmentPeriods) and forecastInvestment
// — both of which step months with dayjs, which clamps. Clamping here makes all
// three agree for month-end starts. (#93) For day-1..28 starts clamping is a
// no-op, so non-month-end behavior is unchanged. (Feb 29 annual clamps to Feb 28,
// consistent with getAnniversaryDate.)
export const getNextCompoundingDate = (
  currentDate: Date,
  frequency: CompoundingFrequency
): Date => {
  const monthsToAdd =
    frequency === CompoundingFrequency.Monthly
      ? 1
      : frequency === CompoundingFrequency.Quarterly
        ? 3
        : 12; // Annually
  return addMonthsClamped(currentDate, monthsToAdd);
};

// Months between occurrences of a cadence (monthly=1, quarterly=3, annually=12).
export const getIntervalMonths = (frequency: CompoundingFrequency): number =>
  12 / getPeriodsPerYear(frequency);

// The k-th cadence date after `anchor`, always measured FROM THE ANCHOR
// (anchor + k·interval months, clamped to month end). Stepping from the running
// date instead let a day-29..31 start that clamped in a short month stay stuck
// on the clamped day forever (Jan 31 → Feb 28 → Mar 28 …), drifting the whole
// cadence earlier and over-counting contributions. (#199)
const getCadenceDate = (
  anchor: Date,
  k: number,
  frequency: CompoundingFrequency
): Date => addMonthsClamped(anchor, k * getIntervalMonths(frequency));

// Count how many contributions occur between two dates (exclusive of end date),
// on the cadence anchored to `startDate`.
export const getContributionsInPeriod = (
  startDate: Date,
  endDate: Date,
  contributionFrequency: CompoundingFrequency
): number => {
  let count = 0;
  while (getCadenceDate(startDate, count, contributionFrequency) < endDate) {
    count++;
  }
  return count;
};

// Calculate the contribution amount for a specific year with step-up applied
// Year 1 = first year (no step-up yet), Year 2 = second year (first step-up applied), etc.
export const getContributionForYear = (
  baseContribution: number,
  yearNumber: number,
  stepUpAmount?: number,
  stepUpType?: StepUpType
): number => {
  if (!stepUpAmount || stepUpAmount <= 0 || !stepUpType || yearNumber <= 1) {
    return roundToCents(baseContribution);
  }

  // Number of step-ups applied (first year has no step-up)
  const stepUpsApplied = yearNumber - 1;

  if (stepUpType === StepUpType.Flat) {
    // Flat: add step-up amount for each year after the first
    return roundToCents(baseContribution + stepUpAmount * stepUpsApplied);
  } else {
    // Percentage: compound the step-up for each year after the first
    return roundToCents(
      baseContribution * Math.pow(1 + stepUpAmount / 100, stepUpsApplied)
    );
  }
};

// Employer 401(k) match earned as this investment-year's cumulative contributions
// grow by `contributionThisStep` from `priorCumulativeThisYear` (ROADMAP 8.1).
// The employer adds EmployerMatchRate% of your contributions, on the first
// (EmployerMatchLimitPct% of AnnualSalary) you contribute each year — so the
// match tapers to 0 as cumulative contributions cross that cap. Returns 0 unless
// all three match inputs are set (> 0). Deliberately UNROUNDED so per-step accrual
// telescopes exactly to the annual figure (callers round the value, per
// PRECISION.md): min() is piecewise-linear, so summing the match over many small
// steps equals computing it over one large step, which keeps the monthly forecast
// and the period growth engine consistent regardless of contribution/compounding
// granularity.
export const employerMatchOnContribution = (
  priorCumulativeThisYear: number,
  contributionThisStep: number,
  investment: Investment
): number => {
  const rate = investment.EmployerMatchRate ?? 0;
  const limitPct = investment.EmployerMatchLimitPct ?? 0;
  const salary = investment.AnnualSalary ?? 0;
  if (
    !(rate > 0) ||
    !(limitPct > 0) ||
    !(salary > 0) ||
    !(contributionThisStep > 0)
  ) {
    return 0;
  }
  const cap = (limitPct / 100) * salary;
  const matchedBefore = Math.min(priorCumulativeThisYear, cap);
  const matchedAfter = Math.min(
    priorCumulativeThisYear + contributionThisStep,
    cap
  );
  return (rate / 100) * (matchedAfter - matchedBefore);
};

// Calculate the investment year number (1-indexed) based on how many years have passed since start
export const getInvestmentYear = (
  currentDate: Date,
  startDate: Date
): number => {
  // If currentDate is before startDate, return 1 (investment hasn't started yet, treat as year 1)
  if (currentDate < startDate) {
    return 1;
  }

  // Calculate years elapsed since start
  const yearsElapsed = currentDate.getFullYear() - startDate.getFullYear();

  // Use shared helper to check if we've passed the anniversary this calendar year
  if (hasPassedAnniversary(currentDate, startDate)) {
    return yearsElapsed + 1;
  } else {
    return yearsElapsed;
  }
};

// Calculate total contributions in a period, accounting for step-up at year boundaries
export const getContributionsWithStepUp = (
  startDate: Date,
  endDate: Date,
  investmentStartDate: Date,
  baseContribution: number,
  contributionFrequency: CompoundingFrequency,
  stepUpAmount?: number,
  stepUpType?: StepUpType
): number => {
  let totalContribution = 0;

  // Contribution dates sit on the cadence anchored to investmentStartDate, so
  // timing stays consistent across compounding periods — without this, each
  // period would treat its own start as a contribution date, over-counting when
  // compounding is more frequent than contributions. Each date is measured from
  // the anchor, never from the previous (possibly month-end-clamped) date. (#199)
  let k = 0;
  let currentDate = investmentStartDate;
  while (currentDate < startDate) {
    k++;
    currentDate = getCadenceDate(investmentStartDate, k, contributionFrequency);
  }

  while (currentDate < endDate) {
    // Determine which year this contribution falls in
    const yearNumber = getInvestmentYear(currentDate, investmentStartDate);

    // Get the contribution amount for this year
    const contributionAmount = getContributionForYear(
      baseContribution,
      yearNumber,
      stepUpAmount,
      stepUpType
    );

    totalContribution += contributionAmount;
    k++;
    currentDate = getCadenceDate(investmentStartDate, k, contributionFrequency);
  }

  return roundToCents(totalContribution);
};

// Extra money-in on top of the recurring contribution (an optimizer/scenario
// extra or a one-time lump sum). Matched and compounded exactly like a
// recurring contribution dated on the same day.
export interface InvestmentContributionEvent {
  Date: Date;
  Amount: number;
}

export interface InvestmentEngineOptions {
  // Additional dated contributions, merged with the recurring schedule.
  extras?: InvestmentContributionEvent[];
  // Dates (ascending, each <= the engine's end date) to report the value at.
  sampleDates?: Date[];
  // Recurring contributions dated on/after this date are skipped (extras are
  // never added when it is set). Used to isolate money already in the account.
  contributionCutoff?: Date;
  // Report, per sample date, the growth factor of $1 present from this date on.
  lumpDate?: Date;
  // A sample in the same compounding period as this date credits the money
  // dated before it the pro-rated slice r·(elapsed/period) up to it — so a
  // sample AT this date equals generateInvestmentGrowth(investment, date).
  accrueAt?: Date;
}

export interface InvestmentEngineResult {
  growth: InvestmentGrowthEntry[];
  // Value at each sample date.
  samples: number[];
  // Growth factor from `lumpDate` to each sample date (1 when no lumpDate).
  lumpFactors: number[];
}

// The single investment growth engine. Compounding boundaries and contribution
// dates are both anchored to StartDate (k·interval months from it, clamped to
// month end). Money dated inside a compounding period [b, b') is credited at the
// period's start and earns the full period rate at b'; the schedule's final
// partial period earns the linearly pro-rated slice r·(elapsed/period)
// (PRECISION.md). A sample read part-way through a period holds the value at
// the period's last boundary plus the money added since (the forecast chart's
// step between compounding dates), except that money dated before `accrueAt`
// also carries its pro-rated slice to that date. The per-period growth factor is
// floored at zero, so a return at or below −100%/period decays the balance to
// zero instead of flipping its sign. (#221)
//
// generateInvestmentGrowth and forecastInvestment are both thin reads of this
// engine, so the schedule, PIT view, dashboard and forecast chart agree at
// every date by construction (#165, #187, #217).
export const runInvestmentEngine = (
  investment: Investment,
  end: Date,
  options: InvestmentEngineOptions = {}
): InvestmentEngineResult => {
  const start = investment.StartDate;
  const sampleDates = options.sampleDates ?? [];
  if (!start) {
    return {
      growth: [],
      samples: sampleDates.map(() => investment.StartingBalance),
      lumpFactors: sampleDates.map(() => 1),
    };
  }
  const periodRate =
    investment.AverageReturnRate /
    100 /
    getPeriodsPerYear(investment.CompoundingPeriod);
  const growthFactor = (fraction: number): number =>
    Math.max(0, 1 + periodRate * fraction);

  const samples: number[] = new Array<number>(sampleDates.length);
  const lumpFactors: number[] = new Array<number>(sampleDates.length).fill(1);
  const lumpDate = options.lumpDate;
  const cutoff = options.contributionCutoff;

  // Merged, date-ordered money-in: the recurring schedule plus any extras.
  const baseContribution =
    investment.ContributionFrequency &&
    (investment.RecurringContribution ?? 0) > 0
      ? (investment.RecurringContribution as number)
      : 0;
  const extras = cutoff
    ? []
    : [...(options.extras ?? [])]
        .filter((event) => event.Amount > 0)
        .sort((a, b) => a.Date.getTime() - b.Date.getTime());
  let extraIndex = 0;
  let contributionIndex = 0;
  const nextRecurringDate = (): Date | undefined => {
    if (baseContribution <= 0) return undefined;
    const date = getCadenceDate(
      start,
      contributionIndex,
      investment.ContributionFrequency as CompoundingFrequency
    );
    return cutoff && date >= cutoff ? undefined : date;
  };
  // Pop every money-in event dated before `before`, in date order.
  const takeEventsBefore = (before: Date): InvestmentContributionEvent[] => {
    const events: InvestmentContributionEvent[] = [];
    for (;;) {
      const recurringDate = nextRecurringDate();
      const extra = extras[extraIndex];
      const recurringDue =
        recurringDate !== undefined && recurringDate < before;
      const extraDue = extra !== undefined && extra.Date < before;
      if (!recurringDue && !extraDue) return events;
      if (
        recurringDue &&
        (!extraDue || (recurringDate as Date) <= extra.Date)
      ) {
        const date = recurringDate as Date;
        events.push({
          Date: date,
          Amount: getContributionForYear(
            baseContribution,
            getInvestmentYear(date, start),
            investment.ContributionStepUpAmount,
            investment.ContributionStepUpType
          ),
        });
        contributionIndex++;
      } else {
        events.push(extra);
        extraIndex++;
      }
    }
  };
  const sumBefore = (
    events: InvestmentContributionEvent[],
    before: Date
  ): number =>
    roundToCents(
      events.reduce(
        (sum, event) => (event.Date < before ? sum + event.Amount : sum),
        0
      )
    );

  const growth: InvestmentGrowthEntry[] = [];
  let value = investment.StartingBalance;
  let sampleIndex = 0;

  // Money dated before StartDate (an extra on a not-yet-started investment)
  // waits uninvested and joins the first period at StartDate.
  const preStart = takeEventsBefore(start);
  while (
    sampleIndex < sampleDates.length &&
    sampleDates[sampleIndex] <= start
  ) {
    samples[sampleIndex] =
      value + sumBefore(preStart, sampleDates[sampleIndex]);
    sampleIndex++;
  }

  if (end <= start) {
    return { growth, samples, lumpFactors };
  }

  growth.push({
    Period: 0,
    ContributionAmount: 0,
    InterestEarned: 0,
    TotalValue: roundToCents(value),
  });

  // Employer-match accrual state (ROADMAP 8.1): the matchable contribution used
  // this investment-year, reset at each year boundary so the annual cap holds.
  // A compounding period never crosses a year boundary (the period count
  // divides the year evenly), so the whole period belongs to one year.
  let matchYear = 0;
  let matchCumThisYear = 0;
  // Growth of $1 present from lumpDate, accrued to the current period start.
  let lumpAccrued = lumpDate && lumpDate <= start ? 1 : undefined;

  for (let period = 1; ; period++) {
    const periodStart = getCadenceDate(
      start,
      period - 1,
      investment.CompoundingPeriod
    );
    if (periodStart >= end) break;
    const periodEnd = getCadenceDate(
      start,
      period,
      investment.CompoundingPeriod
    );
    const periodMs = periodEnd.getTime() - periodStart.getTime();
    const fractionAt = (date: Date): number =>
      (date.getTime() - periodStart.getTime()) / periodMs;

    const events = takeEventsBefore(periodEnd);
    if (period === 1) events.unshift(...preStart);

    const periodYear = getInvestmentYear(periodStart, start);
    if (periodYear !== matchYear) {
      matchYear = periodYear;
      matchCumThisYear = 0;
    }
    const matchOn = (money: number): number =>
      employerMatchOnContribution(matchCumThisYear, money, investment);

    // The lump enters part-way through this period: it earns only the slice
    // of the period remaining after lumpDate (1 + r·(1 − f)). (#103)
    let lumpStartFraction = 0;
    if (lumpAccrued === undefined && lumpDate && lumpDate < periodEnd) {
      lumpAccrued = 1;
      lumpStartFraction = fractionAt(lumpDate);
    }

    // Samples inside (periodStart, periodEnd].
    const accrueAt = options.accrueAt;
    while (
      sampleIndex < sampleDates.length &&
      sampleDates[sampleIndex] <= periodEnd
    ) {
      const date = sampleDates[sampleIndex];
      const closesPeriod = date.getTime() === periodEnd.getTime();
      // The read point that earns interest: the period end when the sample
      // closes the period, `accrueAt` when it falls in (periodStart, date],
      // else the period start (no interest yet).
      const accrual = closesPeriod
        ? periodEnd
        : accrueAt && accrueAt > periodStart && accrueAt <= date
          ? accrueAt
          : periodStart;
      const accruedMoney = sumBefore(events, accrual);
      const money = sumBefore(events, date);
      samples[sampleIndex] =
        (value + accruedMoney + matchOn(accruedMoney)) *
          growthFactor(fractionAt(accrual)) +
        (money - accruedMoney) +
        (matchOn(money) - matchOn(accruedMoney));
      if (lumpAccrued !== undefined && closesPeriod) {
        lumpFactors[sampleIndex] =
          lumpAccrued * growthFactor(1 - lumpStartFraction);
      } else if (lumpAccrued !== undefined) {
        lumpFactors[sampleIndex] = lumpAccrued;
      }
      sampleIndex++;
    }

    // Advance the schedule: a full period, or the partial period ending at `end`.
    const isPartial = periodEnd > end;
    const closeAt = isPartial ? end : periodEnd;
    const money = sumBefore(events, closeAt);
    const employerMatch = matchOn(money);
    matchCumThisYear += money;
    const valueBeforeInterest = value + money + employerMatch;
    value = valueBeforeInterest * growthFactor(isPartial ? fractionAt(end) : 1);
    if (lumpAccrued !== undefined) {
      lumpAccrued *= growthFactor(1 - lumpStartFraction);
    }

    growth.push({
      Period: period,
      // Total money in this period — your contribution plus any employer match.
      ContributionAmount: roundToCents(money + employerMatch),
      EmployerMatchAmount: roundToCents(employerMatch),
      InterestEarned: roundToCents(value - valueBeforeInterest),
      TotalValue: roundToCents(value),
    });
    if (isPartial) break;
  }

  return { growth, samples, lumpFactors };
};

// Generate growth projection for an investment using date-based calculations
export const generateInvestmentGrowth = (
  investment: Investment,
  endDate?: Date
): InvestmentGrowthEntry[] =>
  runInvestmentEngine(investment, endDate ?? new Date()).growth;

// Point-in-time view of an investment at an arbitrary date along its timeline.
//
// This is deliberately a THEORETICAL projection from the investment's original
// inputs (StartingBalance + contributions + compounding) and intentionally does
// NOT consult the `CurrentValue` actual-balance anchor. It backs the PIT popout,
// whose "Projection Date" ranges over the whole life of the investment
// ([StartDate, ∞)), so there is no single "today" at which an anchor would even
// apply — applying CurrentValue uniformly across past and future projection
// dates would be wrong.
//
// The dashboard, investment table, and chart instead report the actual-anchored
// value as of today via `currentInvestmentValue` (= CurrentValue when set) — the
// single source of truth for "what it's worth now". The two figures can
// legitimately differ for an investment whose real balance has drifted from the
// modeled curve; that divergence is by design. (A correct anchored projection
// here would also have to duplicate forecastInvestment's off-boundary
// compounding reconciliation (#88/#103), or import it and create an
// investment-helpers <-> forecast-helpers dependency cycle.) (#135)
export const getPitInvestmentCalculation = (
  investment: Investment,
  date?: Date
): PitInvestment => {
  const endDate = date ?? new Date();
  const currentPeriods = getInvestmentPeriods(investment, endDate);
  const growthEntries = generateInvestmentGrowth(investment, endDate);

  const totalContributions =
    investment.StartingBalance +
    growthEntries.reduce((sum, entry) => sum + entry.ContributionAmount, 0);

  const currentValue =
    growthEntries.length > 0
      ? growthEntries[growthEntries.length - 1].TotalValue
      : investment.StartingBalance;

  const totalInterestEarned = currentValue - totalContributions;

  // Annualized (compound) return, not the cumulative total. Deriving years from
  // the period count / compounding frequency, the figure is the constant annual
  // rate that grows total contributions to the current value — dimensionally an
  // annual %, comparable to AverageReturnRate. (Approximate when contributions
  // arrive mid-period.) The previous (total ÷ contributions) figure overstated
  // the annual return on any multi-year holding. (#57)
  const years =
    currentPeriods / getPeriodsPerYear(investment.CompoundingPeriod);
  const projectedAnnualReturn =
    years > 0 && totalContributions > 0 && currentValue > 0
      ? (Math.pow(currentValue / totalContributions, 1 / years) - 1) * 100
      : 0;

  return {
    CurrentPeriods: currentPeriods,
    TotalContributions: Math.round(totalContributions * 100) / 100,
    TotalInterestEarned: Math.round(totalInterestEarned * 100) / 100,
    CurrentValue: Math.round(currentValue * 100) / 100,
    ProjectedAnnualReturn: Math.round(projectedAnnualReturn * 100) / 100,
  };
};
