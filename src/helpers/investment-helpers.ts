import { Investment, InvestmentGrowthEntry, PitInvestment, CompoundingFrequency } from '../models/investment-model';

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
export const getInvestmentPeriods = (investment: Investment, endDate?: Date): number => {
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
  
  if (periodsPerYear === 12) { // Monthly
    periods = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
    // Add partial month if we've passed the start day
    if (end.getDate() >= start.getDate()) {
      periods += 1;
    }
  } else if (periodsPerYear === 4) { // Quarterly
    const startQuarter = Math.floor(start.getMonth() / 3);
    const endQuarter = Math.floor(end.getMonth() / 3);
    periods = (end.getFullYear() - start.getFullYear()) * 4 + (endQuarter - startQuarter);
    // Add partial quarter if we've passed the quarter start
    const quarterStartMonth = endQuarter * 3;
    const quarterStartDate = new Date(end.getFullYear(), quarterStartMonth, start.getDate());
    if (end >= quarterStartDate) {
      periods += 1;
    }
  } else { // Annually
    periods = end.getFullYear() - start.getFullYear();
    // Add partial year if we've passed the anniversary
    const anniversary = new Date(end.getFullYear(), start.getMonth(), start.getDate());
    if (end >= anniversary) {
      periods += 1;
    }
  }
  
  // Return at least 1 period if the start date is today or in the past
  return Math.max(periods, start <= end ? 1 : 0);
};

// Calculate compound interest with optional recurring contributions
export const calculateInvestmentValue = (
  principal: number,
  annualRate: number,
  compoundingPeriod: CompoundingFrequency,
  periods: number,
  recurringContribution: number = 0,
  contributionFrequency: CompoundingFrequency = CompoundingFrequency.Monthly
): number => {
  if (principal <= 0 || annualRate < 0 || periods <= 0) {
    return principal;
  }

  const periodsPerYear = getPeriodsPerYear(compoundingPeriod);
  const contributionPeriodsPerYear = getPeriodsPerYear(contributionFrequency);
  const periodRate = annualRate / 100 / periodsPerYear;

  let totalValue = principal;

  for (let period = 1; period <= periods; period++) {
    // Apply compound interest
    totalValue *= (1 + periodRate);

    // Add recurring contribution if applicable
    // Check if this period aligns with contribution frequency
    // The contribution should happen based on how many contribution periods have elapsed
    if (recurringContribution > 0) {
      // Calculate how many contribution periods should have occurred by this compounding period
      const contributionPeriodsElapsed = Math.floor((period * periodsPerYear) / contributionPeriodsPerYear);
      const previousContributionPeriodsElapsed = Math.floor(((period - 1) * periodsPerYear) / contributionPeriodsPerYear);
      
      // If we've crossed into a new contribution period, add the contribution
      if (contributionPeriodsElapsed > previousContributionPeriodsElapsed) {
        totalValue += recurringContribution;
      }
    }
  }

  return Math.round(totalValue * 100) / 100;
};

// Generate growth projection for an investment
export const generateInvestmentGrowth = (
  investment: Investment,
  periods?: number
): InvestmentGrowthEntry[] => {
  const growth: InvestmentGrowthEntry[] = [];
  const periodsPerYear = getPeriodsPerYear(investment.CompoundingPeriod);
  const contributionPeriodsPerYear = getPeriodsPerYear(investment.ContributionFrequency || CompoundingFrequency.Monthly);
  const periodRate = investment.AverageReturnRate / 100 / periodsPerYear;
  const totalPeriods = periods ?? getInvestmentPeriods(investment);
  
  let currentValue = investment.StartingBalance;
  let totalContributions = investment.StartingBalance;

  for (let period = 1; period <= totalPeriods; period++) {
    const startingPeriodValue = currentValue;
    
    // Apply compound interest
    currentValue *= (1 + periodRate);
    const interestEarned = currentValue - startingPeriodValue;

    // Add recurring contribution if applicable
    let contributionThisPeriod = 0;
    if ((investment.RecurringContribution || 0) > 0) {
      // Calculate how many contribution periods should have occurred by this compounding period
      const contributionPeriodsElapsed = Math.floor((period * periodsPerYear) / contributionPeriodsPerYear);
      const previousContributionPeriodsElapsed = Math.floor(((period - 1) * periodsPerYear) / contributionPeriodsPerYear);
      
      // If we've crossed into a new contribution period, add the contribution
      if (contributionPeriodsElapsed > previousContributionPeriodsElapsed) {
        contributionThisPeriod = investment.RecurringContribution || 0;
        currentValue += contributionThisPeriod;
        totalContributions += contributionThisPeriod;
      }
    }

    growth.push({
      Period: period,
      ContributionAmount: contributionThisPeriod,
      InterestEarned: Math.round(interestEarned * 100) / 100,
      TotalValue: Math.round(currentValue * 100) / 100,
    });
  }

  return growth;
};

// Returns a point-in-time view of an investment
export const getPitInvestmentCalculation = (investment: Investment, date?: Date): PitInvestment => {
  const currentPeriods = getInvestmentPeriods(investment, date);
  const growthEntries = generateInvestmentGrowth(investment, currentPeriods);
  
  const totalContributions = investment.StartingBalance + 
    (growthEntries.reduce((sum, entry) => sum + entry.ContributionAmount, 0));
  
  const currentValue = growthEntries.length > 0 ? 
    growthEntries[growthEntries.length - 1].TotalValue : 
    investment.StartingBalance;
  
  const totalInterestEarned = currentValue - totalContributions;
  
  const projectedAnnualReturn = totalContributions > 0 ? 
    (totalInterestEarned / totalContributions) * 100 : 0;

  return {
    CurrentPeriods: currentPeriods,
    TotalContributions: Math.round(totalContributions * 100) / 100,
    TotalInterestEarned: Math.round(totalInterestEarned * 100) / 100,
    CurrentValue: Math.round(currentValue * 100) / 100,
    ProjectedAnnualReturn: Math.round(projectedAnnualReturn * 100) / 100,
  };
};