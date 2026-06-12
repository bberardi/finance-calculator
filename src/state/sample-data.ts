import { Loan } from '../models/loan-model';
import { CompoundingFrequency, Investment } from '../models/investment-model';

// Sample data for the onboarding empty state (roadmap 0.9).
//
// These are realistic, pedagogically useful examples — a mortgage, a car loan,
// and a couple of investments — so a first-time visitor can see what PathWise
// does without typing anything. Each Name is prefixed with "Sample:" so the
// rows are unmistakably demo data, and the in-app banner offers a one-click
// "Clear sample data". The reducer stashes any real user data while these are
// loaded, so nothing the user typed is ever lost (see finance-reducer.ts).
//
// This is a plain UI seed, not state: the provider copies it into the reducer
// via LoadSampleData. Stable Ids keep load/clear idempotent.

export const sampleLoans: Loan[] = [
  {
    Id: '00000000-0000-0000-0000-000000000001',
    Name: 'Sample: Mortgage',
    Provider: 'Sample Bank',
    InterestRate: 6.25,
    Principal: 350000,
    CurrentAmount: 332500,
    MonthlyPayment: 2155.18,
    StartDate: new Date('2023-05-01'),
    EndDate: new Date('2053-05-01'),
  },
  {
    Id: '00000000-0000-0000-0000-000000000002',
    Name: 'Sample: Car Loan',
    Provider: 'Sample Credit Union',
    InterestRate: 4.9,
    Principal: 28000,
    CurrentAmount: 19500,
    MonthlyPayment: 527.63,
    StartDate: new Date('2024-02-15'),
    EndDate: new Date('2029-02-15'),
  },
];

export const sampleInvestments: Investment[] = [
  {
    Id: '00000000-0000-0000-0000-000000000003',
    Name: 'Sample: Index Fund (brokerage)',
    Provider: 'Sample Brokerage',
    StartingBalance: 15000,
    CurrentValue: 22000,
    AverageReturnRate: 7,
    CompoundingPeriod: CompoundingFrequency.Monthly,
    StartDate: new Date('2021-01-01'),
    RecurringContribution: 500,
    ContributionFrequency: CompoundingFrequency.Monthly,
  },
  {
    Id: '00000000-0000-0000-0000-000000000004',
    Name: 'Sample: 401(k)',
    Provider: 'Sample Retirement',
    StartingBalance: 40000,
    CurrentValue: 58000,
    AverageReturnRate: 6.5,
    CompoundingPeriod: CompoundingFrequency.Monthly,
    StartDate: new Date('2019-06-01'),
    RecurringContribution: 800,
    ContributionFrequency: CompoundingFrequency.Monthly,
  },
];
