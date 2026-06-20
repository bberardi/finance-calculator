import { Loan } from '../models/loan-model';
import { CompoundingFrequency, Investment } from '../models/investment-model';
import { Asset, AssetType } from '../models/asset-model';

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
    // Local-time constructors (year, month-index, day) so these match how the
    // rest of the app builds dates. A bare 'YYYY-MM-DD' string parses as UTC
    // midnight, which reads back as the previous day west of UTC. (#68)
    StartDate: new Date(2023, 4, 1),
    EndDate: new Date(2053, 4, 1),
  },
  {
    Id: '00000000-0000-0000-0000-000000000002',
    Name: 'Sample: Car Loan',
    Provider: 'Sample Credit Union',
    InterestRate: 4.9,
    Principal: 28000,
    CurrentAmount: 19500,
    MonthlyPayment: 527.63,
    StartDate: new Date(2024, 1, 15),
    EndDate: new Date(2029, 1, 15),
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
    StartDate: new Date(2021, 0, 1),
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
    StartDate: new Date(2019, 5, 1),
    RecurringContribution: 800,
    ContributionFrequency: CompoundingFrequency.Monthly,
  },
];

// Phase 7 sample holdings: a high-yield savings account (7.1), the home whose
// value backs the sample mortgage above (7.2, linked by LinkedLoanId so net
// worth reflects home equity), and a depreciating car (7.3, a custom asset with
// a negative growth rate). Stable Ids keep load/clear idempotent.
export const sampleAssets: Asset[] = [
  {
    Id: '00000000-0000-0000-0000-000000000005',
    Name: 'Sample: High-Yield Savings',
    Provider: 'Sample Bank',
    AssetType: AssetType.Cash,
    Balance: 25000,
    GrowthRate: 4.25,
    CompoundingPeriod: CompoundingFrequency.Monthly,
  },
  {
    Id: '00000000-0000-0000-0000-000000000006',
    Name: 'Sample: Home',
    Provider: 'Primary Residence',
    AssetType: AssetType.Property,
    Balance: 410000,
    GrowthRate: 3,
    // Paired with "Sample: Mortgage" so the app can show home equity.
    LinkedLoanId: '00000000-0000-0000-0000-000000000001',
    CompoundingPeriod: CompoundingFrequency.Monthly,
  },
  {
    Id: '00000000-0000-0000-0000-000000000007',
    Name: 'Sample: Car',
    Provider: 'Personal',
    AssetType: AssetType.CustomAsset,
    Balance: 22000,
    GrowthRate: -12,
    CompoundingPeriod: CompoundingFrequency.Monthly,
  },
];
