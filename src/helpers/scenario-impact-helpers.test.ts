import { describe, it, expect } from 'vitest';
import dayjs from 'dayjs';
import {
  computeScenarioBaseline,
  computeScenarioImpact,
  computeScenarioImpactWithBaseline,
} from './scenario-impact-helpers';
import { Loan } from '../models/loan-model';
import { CompoundingFrequency, Investment } from '../models/investment-model';
import { Asset, AssetType } from '../models/asset-model';

const TODAY = new Date(2025, 0, 1);

const loan: Loan = {
  Id: 'loan-1',
  Provider: 'Bank',
  Name: 'Car Loan',
  InterestRate: 6,
  Principal: 20000,
  CurrentAmount: 12000,
  MonthlyPayment: 400,
  StartDate: new Date(2023, 0, 1),
  EndDate: new Date(2028, 0, 1),
};

const investment: Investment = {
  Id: 'inv-1',
  Provider: 'Brokerage',
  Name: 'Index Fund',
  StartDate: new Date(2024, 0, 1),
  StartingBalance: 10000,
  AverageReturnRate: 6,
  CompoundingPeriod: CompoundingFrequency.Monthly,
  CurrentValue: 10000,
};

describe('computeScenarioImpact', () => {
  it('an extra loan payment saves interest and moves up the payoff date', () => {
    const impact = computeScenarioImpact(
      [loan],
      [],
      { ExtraLoanPayments: { 'loan-1': 300 } },
      TODAY
    );
    expect(impact.interestSaved).toBeGreaterThan(0);
    expect(impact.payoffMonthsEarlier).toBeGreaterThan(0);
    // Net worth at the horizon is never worse (both loans are paid off by then,
    // and freed payments aren't redirected in v1 — so the gain shows as interest
    // saved + earlier payoff, not a horizon net-worth jump).
    expect(impact.netWorthDelta).toBeGreaterThanOrEqual(0);
  });

  it('an extra contribution raises net worth without touching loan metrics', () => {
    const impact = computeScenarioImpact(
      [loan],
      [investment],
      { ExtraContributions: { 'inv-1': 200 } },
      TODAY
    );
    expect(impact.netWorthDelta).toBeGreaterThan(0);
    expect(impact.interestSaved).toBe(0);
    expect(impact.payoffMonthsEarlier).toBe(0);
  });

  it('a one-time loan lump saves interest and moves up the payoff date (#8.2)', () => {
    const impact = computeScenarioImpact(
      [loan],
      [],
      { OneTimeLoanPayments: { 'loan-1': 4000 } },
      TODAY
    );
    expect(impact.interestSaved).toBeGreaterThan(0);
    expect(impact.payoffMonthsEarlier).toBeGreaterThan(0);
    expect(impact.netWorthDelta).toBeGreaterThanOrEqual(0);
  });

  it('a smaller one-time lump saves less interest than a larger one (#8.2)', () => {
    const small = computeScenarioImpact(
      [loan],
      [],
      { OneTimeLoanPayments: { 'loan-1': 1000 } },
      TODAY
    );
    const big = computeScenarioImpact(
      [loan],
      [],
      { OneTimeLoanPayments: { 'loan-1': 5000 } },
      TODAY
    );
    expect(big.interestSaved).toBeGreaterThan(small.interestSaved);
  });

  it('a one-time contribution raises net worth without touching loan metrics (#8.2)', () => {
    const impact = computeScenarioImpact(
      [loan],
      [investment],
      { OneTimeContributions: { 'inv-1': 3000 } },
      TODAY
    );
    expect(impact.netWorthDelta).toBeGreaterThan(0);
    expect(impact.interestSaved).toBe(0);
    expect(impact.payoffMonthsEarlier).toBe(0);
  });

  it('an empty scenario has no impact', () => {
    const impact = computeScenarioImpact([loan], [investment], {}, TODAY);
    expect(impact.netWorthDelta).toBe(0);
    expect(impact.interestSaved).toBe(0);
    expect(impact.payoffMonthsEarlier).toBe(0);
  });

  it('measures net worth at an explicit horizon override', () => {
    const near = computeScenarioImpact(
      [loan],
      [investment],
      { ExtraContributions: { 'inv-1': 200 } },
      TODAY,
      dayjs(TODAY).add(2, 'year').toDate()
    );
    const far = computeScenarioImpact(
      [loan],
      [investment],
      { ExtraContributions: { 'inv-1': 200 } },
      TODAY,
      dayjs(TODAY).add(20, 'year').toDate()
    );
    expect(far.netWorthDelta).toBeGreaterThan(near.netWorthDelta);
  });

  it('reports no payoff change when there are no loans', () => {
    const impact = computeScenarioImpact(
      [],
      [investment],
      { ExtraContributions: { 'inv-1': 100 } },
      TODAY
    );
    expect(impact.payoffMonthsEarlier).toBe(0);
    expect(impact.interestSaved).toBe(0);
  });

  it('folds assets into the baseline net worth without changing the delta', () => {
    const cash: Asset = {
      Id: 'asset-1',
      Provider: 'Bank',
      Name: 'Savings',
      AssetType: AssetType.Cash,
      Balance: 50000,
      GrowthRate: 0,
      CompoundingPeriod: CompoundingFrequency.Monthly,
    };
    const scenario = { ExtraLoanPayments: { 'loan-1': 300 } };

    // The absolute baseline net worth at the horizon rises by the asset's value.
    const withoutAssets = computeScenarioBaseline([loan], [investment], TODAY);
    const withAssets = computeScenarioBaseline(
      [loan],
      [investment],
      TODAY,
      undefined,
      [cash]
    );
    expect(
      withAssets.netWorthAtHorizon - withoutAssets.netWorthAtHorizon
    ).toBeCloseTo(50000, 2);

    // ...but the scenario delta is asset-invariant (a passive holding cancels
    // between the baseline and the scenario net worth).
    const deltaNoAssets = computeScenarioImpact(
      [loan],
      [investment],
      scenario,
      TODAY
    );
    const deltaWithAssets = computeScenarioImpact(
      [loan],
      [investment],
      scenario,
      TODAY,
      undefined,
      [cash]
    );
    expect(deltaWithAssets).toEqual(deltaNoAssets);
  });
});

describe('computeScenarioImpactWithBaseline', () => {
  // The split baseline/scenario API must be a faithful decomposition of
  // computeScenarioImpact: a baseline computed once and reused per scenario has
  // to reproduce the all-in-one result exactly.
  const cases: {
    name: string;
    scenario: Parameters<typeof computeScenarioImpact>[2];
  }[] = [
    {
      name: 'an extra loan payment',
      scenario: { ExtraLoanPayments: { 'loan-1': 300 } },
    },
    {
      name: 'an extra contribution',
      scenario: { ExtraContributions: { 'inv-1': 200 } },
    },
    {
      name: 'a one-time loan lump',
      scenario: { OneTimeLoanPayments: { 'loan-1': 4000 } },
    },
    {
      name: 'a one-time contribution',
      scenario: { OneTimeContributions: { 'inv-1': 3000 } },
    },
    { name: 'an empty scenario', scenario: {} },
  ];

  for (const { name, scenario } of cases) {
    it(`reproduces computeScenarioImpact for ${name}`, () => {
      const baseline = computeScenarioBaseline([loan], [investment], TODAY);
      const viaBaseline = computeScenarioImpactWithBaseline(
        [loan],
        [investment],
        scenario,
        baseline,
        TODAY
      );
      const direct = computeScenarioImpact(
        [loan],
        [investment],
        scenario,
        TODAY
      );
      expect(viaBaseline).toEqual(direct);
    });
  }

  it('honours a horizon override carried on the baseline', () => {
    const horizon = dayjs(TODAY).add(2, 'year').toDate();
    const baseline = computeScenarioBaseline(
      [loan],
      [investment],
      TODAY,
      horizon
    );
    const viaBaseline = computeScenarioImpactWithBaseline(
      [loan],
      [investment],
      { ExtraContributions: { 'inv-1': 200 } },
      baseline,
      TODAY
    );
    const direct = computeScenarioImpact(
      [loan],
      [investment],
      { ExtraContributions: { 'inv-1': 200 } },
      TODAY,
      horizon
    );
    expect(viaBaseline).toEqual(direct);
  });

  it('reuses one baseline across multiple scenarios', () => {
    const baseline = computeScenarioBaseline([loan], [], TODAY);
    const small = computeScenarioImpactWithBaseline(
      [loan],
      [],
      { ExtraLoanPayments: { 'loan-1': 100 } },
      baseline,
      TODAY
    );
    const big = computeScenarioImpactWithBaseline(
      [loan],
      [],
      { ExtraLoanPayments: { 'loan-1': 400 } },
      baseline,
      TODAY
    );
    // A bigger extra payment saves strictly more interest off the same baseline.
    expect(big.interestSaved).toBeGreaterThan(small.interestSaved);
  });

  it('reports no payoff change when the baseline has no loans', () => {
    const baseline = computeScenarioBaseline([], [investment], TODAY);
    expect(baseline.payoffMonth).toBeUndefined();
    const impact = computeScenarioImpactWithBaseline(
      [],
      [investment],
      { ExtraContributions: { 'inv-1': 100 } },
      baseline,
      TODAY
    );
    expect(impact.payoffMonthsEarlier).toBe(0);
  });
});
