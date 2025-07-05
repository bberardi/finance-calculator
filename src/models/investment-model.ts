export interface Investment {
  Provider: string;
  Name: string;
  StartDate: Date;
  StartingBalance: number;
  AverageReturnRate: number; // Annual percentage
  CompoundingPeriod: 'monthly' | 'quarterly' | 'annually';
  RecurringContribution?: number;
  ContributionFrequency?: 'monthly' | 'quarterly' | 'annually';
  CurrentValue?: number; // Calculated field
  ProjectedGrowth?: InvestmentGrowthEntry[]; // Calculated field
}

export const emptyInvestment: Investment = {
  Provider: '',
  Name: '',
  StartDate: new Date(),
  StartingBalance: 0,
  AverageReturnRate: 0,
  CompoundingPeriod: 'annually',
  RecurringContribution: 0,
  ContributionFrequency: 'monthly',
};

export type InvestmentGrowthEntry = {
  Period: number;
  ContributionAmount: number;
  InterestEarned: number;
  TotalValue: number;
};

export type PitInvestment = {
  CurrentPeriods: number;
  TotalContributions: number;
  TotalInterestEarned: number;
  CurrentValue: number;
  ProjectedAnnualReturn: number;
};

export const defaultPitInvestment: PitInvestment = {
  CurrentPeriods: 0,
  TotalContributions: 0,
  TotalInterestEarned: 0,
  CurrentValue: 0,
  ProjectedAnnualReturn: 0,
};