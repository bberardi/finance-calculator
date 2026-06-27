export enum CompoundingFrequency {
  Monthly = 'monthly',
  Quarterly = 'quarterly',
  Annually = 'annually',
}

export enum StepUpType {
  Flat = 'flat',
  Percentage = 'percentage',
}

// Input-only model: derived data (growth schedules, forecasts) is computed
// on demand by helpers, never stored or serialized.
export interface Investment {
  Id: string;
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
  CurrentValue?: number; // Today's actual value when known; forecasts anchor here
  // Employer 401(k) match (ROADMAP 8.1). Active only when all three are set (> 0)
  // and the investment has recurring contributions: the employer adds
  // EmployerMatchRate% of your contributions, on the first
  // (EmployerMatchLimitPct% of AnnualSalary) you contribute each year.
  EmployerMatchRate?: number; // % of your contribution the employer matches
  EmployerMatchLimitPct?: number; // matched up to this % of AnnualSalary per year
  AnnualSalary?: number; // salary basis for the match cap
}

export const emptyInvestment: Investment = {
  Id: '',
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
