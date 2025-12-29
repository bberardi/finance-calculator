export enum CompoundingFrequency {
  Monthly = 'monthly',
  Quarterly = 'quarterly',
  Annually = 'annually',
}

export enum StepUpType {
  Flat = 'flat',
  Percentage = 'percentage',
}

export interface Investment {
  Provider: string;
  Name: string;
  StartDate: Date;
  StartingBalance: number;
  AverageReturnRate: number; // Annual percentage
  CompoundingPeriod: CompoundingFrequency;
  RecurringContribution?: number;
  ContributionFrequency?: CompoundingFrequency;
  ContributionStepUpAmount?: number; // Yearly step-up: flat dollar amount or percentage value
  ContributionStepUpType?: StepUpType; // Type of step-up: flat or percentage
  CurrentValue?: number; // Calculated field
  ProjectedGrowth?: InvestmentGrowthEntry[]; // Calculated field
}

export const emptyInvestment: Investment = {
  Provider: '',
  Name: '',
  StartDate: new Date(),
  StartingBalance: 0,
  AverageReturnRate: 0,
  CompoundingPeriod: CompoundingFrequency.Annually,
  RecurringContribution: 0,
  ContributionFrequency: CompoundingFrequency.Monthly,
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
