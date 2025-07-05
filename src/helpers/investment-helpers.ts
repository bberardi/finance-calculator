import { Investment, InvestmentGrowthEntry, PitInvestment } from '../models/investment-model';

// Returns the number of compounding periods per year based on frequency
export const getPeriodsPerYear = (frequency: 'monthly' | 'quarterly' | 'annually'): number => {
  switch (frequency) {
    case 'monthly':
      return 12;
    case 'quarterly':
      return 4;
    case 'annually':
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
  const yearsDiff = (end.getFullYear() - start.getFullYear()) + 
                   (end.getMonth() - start.getMonth()) / 12 +
                   (end.getDate() - start.getDate()) / 365;
  
  // Return at least 1 period if the start date is today or in the past
  const periods = Math.floor(yearsDiff * periodsPerYear);
  return Math.max(periods, start <= end ? 1 : 0);
};

// Calculate compound interest with optional recurring contributions
export const calculateInvestmentValue = (
  principal: number,
  annualRate: number,
  compoundingPeriod: 'monthly' | 'quarterly' | 'annually',
  periods: number,
  recurringContribution: number = 0,
  contributionFrequency: 'monthly' | 'quarterly' | 'annually' = 'monthly'
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
    const contributionPeriodRatio = periodsPerYear / contributionPeriodsPerYear;
    if (recurringContribution > 0 && period % contributionPeriodRatio === 0) {
      totalValue += recurringContribution;
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
  const contributionPeriodsPerYear = getPeriodsPerYear(investment.ContributionFrequency || 'monthly');
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
    const contributionPeriodRatio = periodsPerYear / contributionPeriodsPerYear;
    if ((investment.RecurringContribution || 0) > 0 && period % contributionPeriodRatio === 0) {
      contributionThisPeriod = investment.RecurringContribution || 0;
      currentValue += contributionThisPeriod;
      totalContributions += contributionThisPeriod;
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