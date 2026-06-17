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
  let periods = 0;

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

// Count how many contributions occur between two dates (exclusive of end date)
export const getContributionsInPeriod = (
  startDate: Date,
  endDate: Date,
  contributionFrequency: CompoundingFrequency
): number => {
  let count = 0;
  let currentDate = new Date(startDate.getTime());

  // Count contributions that occur on or after start date and before end date
  while (currentDate < endDate) {
    count++;
    currentDate = getNextCompoundingDate(currentDate, contributionFrequency);
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

  // Anchor to investmentStartDate and advance to first contribution date on or after startDate.
  // This keeps contribution timing consistent across compounding periods — without this,
  // each period would treat its own start as a contribution date, over-counting when
  // compounding is more frequent than contributions (e.g. monthly compounding + quarterly contributions).
  let currentDate = new Date(investmentStartDate.getTime());
  while (currentDate < startDate) {
    currentDate = getNextCompoundingDate(currentDate, contributionFrequency);
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
    currentDate = getNextCompoundingDate(currentDate, contributionFrequency);
  }

  return roundToCents(totalContribution);
};

// Generate growth projection for an investment using date-based calculations
export const generateInvestmentGrowth = (
  investment: Investment,
  endDate?: Date
): InvestmentGrowthEntry[] => {
  const growth: InvestmentGrowthEntry[] = [];
  const end = endDate ?? new Date();

  if (!investment.StartDate || end <= investment.StartDate) {
    return growth;
  }

  const periodsPerYear = getPeriodsPerYear(investment.CompoundingPeriod);
  const periodRate = investment.AverageReturnRate / 100 / periodsPerYear;

  let currentValue = investment.StartingBalance;
  let currentDate = new Date(investment.StartDate.getTime());
  let period = 0;

  // Add Period 0 - the initial state with no interest accrued
  growth.push({
    Period: 0,
    ContributionAmount: 0,
    InterestEarned: 0,
    TotalValue: Math.round(currentValue * 100) / 100,
  });

  // Process each compounding period
  while (currentDate < end) {
    const nextCompoundDate = getNextCompoundingDate(
      currentDate,
      investment.CompoundingPeriod
    );
    const periodEndDate = nextCompoundDate > end ? end : nextCompoundDate;

    period++;

    // Calculate contributions in this period (with step-up if configured)
    let contributionThisPeriod = 0;
    const recurringContribution = investment.RecurringContribution ?? 0;
    if (recurringContribution > 0 && investment.ContributionFrequency) {
      contributionThisPeriod = getContributionsWithStepUp(
        currentDate,
        periodEndDate,
        investment.StartDate,
        recurringContribution,
        investment.ContributionFrequency,
        investment.ContributionStepUpAmount,
        investment.ContributionStepUpType
      );

      currentValue += contributionThisPeriod;
    }

    // Apply compound interest (full period or pro-rated)
    let interestEarned = 0;
    if (nextCompoundDate <= end) {
      // Full compounding period
      const valueBeforeInterest = currentValue;
      currentValue *= 1 + periodRate;
      interestEarned = currentValue - valueBeforeInterest;
    } else {
      // Partial compounding period
      const totalDays = nextCompoundDate.getTime() - currentDate.getTime();
      const actualDays = end.getTime() - currentDate.getTime();
      const partialRate = periodRate * (actualDays / totalDays);
      const valueBeforeInterest = currentValue;
      currentValue *= 1 + partialRate;
      interestEarned = currentValue - valueBeforeInterest;
    }

    growth.push({
      Period: period,
      ContributionAmount: contributionThisPeriod,
      InterestEarned: Math.round(interestEarned * 100) / 100,
      TotalValue: Math.round(currentValue * 100) / 100,
    });

    currentDate = nextCompoundDate;
  }

  return growth;
};

// Returns a point-in-time view of an investment using date-based calculations
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
