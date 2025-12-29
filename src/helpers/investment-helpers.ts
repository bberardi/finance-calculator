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
    // Quarterly
    const startQuarter = Math.floor(start.getMonth() / 3);
    const endQuarter = Math.floor(end.getMonth() / 3);
    periods =
      (end.getFullYear() - start.getFullYear()) * 4 +
      (endQuarter - startQuarter);
    // Add partial quarter if we've passed the quarter start
    const quarterStartMonth = endQuarter * 3;
    const quarterStartDate = new Date(
      end.getFullYear(),
      quarterStartMonth,
      start.getDate()
    );
    if (end >= quarterStartDate) {
      periods += 1;
    }
  } else {
    // Annually
    periods = end.getFullYear() - start.getFullYear();
    // Add partial year if we've passed the anniversary
    const anniversary = new Date(
      end.getFullYear(),
      start.getMonth(),
      start.getDate()
    );
    if (end >= anniversary) {
      periods += 1;
    }
  }

  // Return at least 1 period if the start date is today or in the past
  return Math.max(periods, start <= end ? 1 : 0);
};

// Get the next compounding date based on frequency
export const getNextCompoundingDate = (
  currentDate: Date,
  frequency: CompoundingFrequency
): Date => {
  const nextDate = new Date(currentDate.getTime());

  switch (frequency) {
    case CompoundingFrequency.Monthly:
      nextDate.setMonth(nextDate.getMonth() + 1);
      break;
    case CompoundingFrequency.Quarterly:
      nextDate.setMonth(nextDate.getMonth() + 3);
      break;
    case CompoundingFrequency.Annually:
      nextDate.setFullYear(nextDate.getFullYear() + 1);
      break;
  }

  return nextDate;
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
    return baseContribution;
  }

  // Number of step-ups applied (first year has no step-up)
  const stepUpsApplied = yearNumber - 1;

  if (stepUpType === StepUpType.Flat) {
    // Flat: add step-up amount for each year after the first
    return baseContribution + stepUpAmount * stepUpsApplied;
  } else {
    // Percentage: compound the step-up for each year after the first
    return baseContribution * Math.pow(1 + stepUpAmount / 100, stepUpsApplied);
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

  // Handle leap year edge case: if start date is Feb 29, use Feb 28 for non-leap years
  const anniversaryMonth = startDate.getMonth();
  let anniversaryDay = startDate.getDate();

  // Check if start date is Feb 29 (leap day)
  if (anniversaryMonth === 1 && anniversaryDay === 29) {
    // Check if current year is a leap year
    const currentYear = currentDate.getFullYear();
    const isLeapYear =
      (currentYear % 4 === 0 && currentYear % 100 !== 0) ||
      currentYear % 400 === 0;
    if (!isLeapYear) {
      // Use Feb 28 for non-leap years
      anniversaryDay = 28;
    }
  }

  // Check if we've passed the anniversary this calendar year
  const anniversaryThisYear = new Date(
    currentDate.getFullYear(),
    anniversaryMonth,
    anniversaryDay
  );

  if (currentDate >= anniversaryThisYear) {
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
  let currentDate = new Date(startDate.getTime());

  // Iterate through each contribution date in the period
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

  return totalContribution;
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
    if (
      (investment.RecurringContribution || 0) > 0 &&
      investment.ContributionFrequency
    ) {
      contributionThisPeriod = getContributionsWithStepUp(
        currentDate,
        periodEndDate,
        investment.StartDate,
        investment.RecurringContribution || 0,
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

  const projectedAnnualReturn =
    totalContributions > 0
      ? (totalInterestEarned / totalContributions) * 100
      : 0;

  return {
    CurrentPeriods: currentPeriods,
    TotalContributions: Math.round(totalContributions * 100) / 100,
    TotalInterestEarned: Math.round(totalInterestEarned * 100) / 100,
    CurrentValue: Math.round(currentValue * 100) / 100,
    ProjectedAnnualReturn: Math.round(projectedAnnualReturn * 100) / 100,
  };
};
