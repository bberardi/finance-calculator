import { describe, it, expect } from 'vitest';
import dayjs from 'dayjs';
import {
  forecastLoan,
  forecastInvestment,
  forecastNetWorth,
  getDefaultHorizon,
  getMonthlyPaymentBreakdown,
  getPayoffDate,
  getPmiEndDate,
} from './forecast-helpers';
import { Loan } from '../models/loan-model';
import {
  CompoundingFrequency,
  Investment,
  StepUpType,
} from '../models/investment-model';
import { generateInvestmentGrowth } from './investment-helpers';

// Fixed reference date so every test is deterministic.
const today = new Date(2026, 5, 1); // June 1, 2026

const monthsFromToday = (months: number): Date =>
  dayjs(today).add(months, 'month').toDate();

const makeLoan = (overrides: Partial<Loan> = {}): Loan => ({
  Id: 'loan-1',
  Provider: 'Test Bank',
  Name: 'Test Loan',
  InterestRate: 0,
  StartDate: new Date(2024, 5, 1),
  EndDate: new Date(2034, 5, 1),
  Principal: 10000,
  CurrentAmount: 10000,
  MonthlyPayment: 500,
  ...overrides,
});

const makeInvestment = (overrides: Partial<Investment> = {}): Investment => ({
  Id: 'inv-1',
  Provider: 'Test Fund',
  Name: 'Test Investment',
  StartDate: today,
  StartingBalance: 1000,
  AverageReturnRate: 0,
  CompoundingPeriod: CompoundingFrequency.Monthly,
  ...overrides,
});

describe('Forecast Helpers', () => {
  describe('getDefaultHorizon', () => {
    it('should return 30 years from today when there is no data', () => {
      const horizon = getDefaultHorizon([], [], today);
      expect(horizon.getTime()).toBe(dayjs(today).add(30, 'year').valueOf());
    });

    it('should return the latest loan end date when only loans exist', () => {
      const loans = [
        makeLoan({ EndDate: new Date(2040, 0, 1) }),
        makeLoan({ Id: 'loan-2', EndDate: new Date(2035, 0, 1) }),
      ];
      const horizon = getDefaultHorizon(loans, [], today);
      expect(horizon.getTime()).toBe(new Date(2040, 0, 1).getTime());
    });

    it('selects the latest loan end even when it is not first in the list', () => {
      // Mutation guard: the reduce uses `!latest || end.isAfter(latest)`. With
      // the max loan first, flipping `||`→`&&` still returns it, so the previous
      // test can't catch that mutant. Put the latest end in the MIDDLE so the
      // operator actually has to keep scanning to find it.
      const loans = [
        makeLoan({ Id: 'a', EndDate: new Date(2035, 0, 1) }),
        makeLoan({ Id: 'b', EndDate: new Date(2045, 0, 1) }), // latest, not first
        makeLoan({ Id: 'c', EndDate: new Date(2040, 0, 1) }),
      ];
      const horizon = getDefaultHorizon(loans, [], today);
      expect(horizon.getTime()).toBe(new Date(2045, 0, 1).getTime());
    });

    it('should extend to 30 years from today when investments exist', () => {
      const loans = [makeLoan({ EndDate: new Date(2030, 0, 1) })];
      const horizon = getDefaultHorizon(loans, [makeInvestment()], today);
      expect(horizon.getTime()).toBe(dayjs(today).add(30, 'year').valueOf());
    });

    it('should keep a loan end date beyond 30 years even with investments', () => {
      const loans = [makeLoan({ EndDate: new Date(2070, 0, 1) })];
      const horizon = getDefaultHorizon(loans, [makeInvestment()], today);
      expect(horizon.getTime()).toBe(new Date(2070, 0, 1).getTime());
    });

    it('should extend to 30 years when a loans-only portfolio has all EndDates in the past but still owes a balance (#86)', () => {
      const pastDueLoan = makeLoan({
        StartDate: new Date(2018, 0, 1),
        EndDate: new Date(2024, 0, 1), // already in the past relative to `today`
        Principal: 30000,
        CurrentAmount: 8000, // still owes money
        MonthlyPayment: 500,
        InterestRate: 6,
      });

      const horizon = getDefaultHorizon([pastDueLoan], [], today);

      // Must not be earlier than today (which would collapse the chart); falls
      // back to the 30-year default so the payoff can still be projected.
      expect(horizon.getTime()).toBe(dayjs(today).add(30, 'year').valueOf());

      // And the forecast actually projects the remaining payoff rather than
      // degenerating to a single point at today.
      const series = forecastLoan(pastDueLoan, horizon, 0, today);
      expect(series.length).toBeGreaterThan(1);
      expect(getPayoffDate(series)).toBeDefined();
    });
  });

  describe('forecastLoan', () => {
    it('should produce one point per month plus the anchor point', () => {
      const series = forecastLoan(makeLoan(), monthsFromToday(12), 0, today);
      expect(series).toHaveLength(13);
      expect(series[0].Date.getTime()).toBe(today.getTime());
      expect(series[12].Date.getTime()).toBe(monthsFromToday(12).getTime());
    });

    it('should span past a horizon that falls mid-month', () => {
      const horizon = dayjs(today).add(12, 'month').add(10, 'day').toDate();
      const series = forecastLoan(makeLoan(), horizon, 0, today);
      expect(series).toHaveLength(14);
      expect(series[series.length - 1].Date.getTime()).toBeGreaterThanOrEqual(
        horizon.getTime()
      );
    });

    it('should anchor the first point to CurrentAmount, not Principal', () => {
      const loan = makeLoan({ Principal: 10000, CurrentAmount: 6000 });
      const series = forecastLoan(loan, monthsFromToday(12), 0, today);
      expect(series[0].Value).toBe(6000);
    });

    it('should pay off a zero-interest loan in exactly balance/payment months', () => {
      const loan = makeLoan({
        InterestRate: 0,
        CurrentAmount: 1200,
        MonthlyPayment: 100,
      });
      const series = forecastLoan(loan, monthsFromToday(15), 0, today);
      expect(series[11].Value).toBe(100);
      expect(series[12].Value).toBe(0);
    });

    it('should keep the balance at zero after payoff', () => {
      const loan = makeLoan({
        InterestRate: 0,
        CurrentAmount: 1200,
        MonthlyPayment: 100,
      });
      const series = forecastLoan(loan, monthsFromToday(24), 0, today);
      series.slice(12).forEach((point) => expect(point.Value).toBe(0));
    });

    it('should apply monthly interest before the payment', () => {
      const loan = makeLoan({
        InterestRate: 12,
        CurrentAmount: 10000,
        MonthlyPayment: 500,
      });
      const series = forecastLoan(loan, monthsFromToday(1), 0, today);
      // 10000 + 1% interest - 500 payment
      expect(series[1].Value).toBeCloseTo(9600, 2);
    });

    it('should shorten the payoff with an extra monthly payment', () => {
      const loan = makeLoan({
        InterestRate: 5,
        CurrentAmount: 10000,
        MonthlyPayment: 500,
      });
      const horizon = monthsFromToday(36);
      const baseline = forecastLoan(loan, horizon, 0, today);
      const accelerated = forecastLoan(loan, horizon, 500, today);

      const basePayoff = getPayoffDate(baseline);
      const fastPayoff = getPayoffDate(accelerated);
      expect(basePayoff).toBeDefined();
      expect(fastPayoff).toBeDefined();
      expect(fastPayoff!.getTime()).toBeLessThan(basePayoff!.getTime());
    });

    it('applies a one-time lump at month 1 only, leaving the anchor untouched (#8.2)', () => {
      const loan = makeLoan({
        InterestRate: 0,
        CurrentAmount: 1200,
        MonthlyPayment: 100,
      });
      const series = forecastLoan(loan, monthsFromToday(6), 0, today, 300);
      // Anchor (today) is unchanged so baseline and scenario agree at month 0.
      expect(series[0].Value).toBe(1200);
      // Month 1 drops by the regular payment AND the lump: 1200 − 100 − 300.
      expect(series[1].Value).toBe(800);
      // Month 2 onward drops by the regular payment only (the lump never recurs).
      expect(series[2].Value).toBe(700);
    });

    it('a one-time lump pays a loan off sooner than no lump', () => {
      const loan = makeLoan({
        InterestRate: 5,
        CurrentAmount: 10000,
        MonthlyPayment: 500,
      });
      const horizon = monthsFromToday(36);
      const baseline = forecastLoan(loan, horizon, 0, today);
      const withLump = forecastLoan(loan, horizon, 0, today, 3000);
      const basePayoff = getPayoffDate(baseline);
      const lumpPayoff = getPayoffDate(withLump);
      expect(basePayoff).toBeDefined();
      expect(lumpPayoff).toBeDefined();
      expect(lumpPayoff!.getTime()).toBeLessThan(basePayoff!.getTime());
      // The lump never makes any month's balance higher than the baseline.
      withLump.forEach((point, index) =>
        expect(point.Value).toBeLessThanOrEqual(baseline[index].Value)
      );
    });

    it('should return all zeros for an already paid-off loan', () => {
      const loan = makeLoan({ CurrentAmount: 0 });
      const series = forecastLoan(loan, monthsFromToday(12), 0, today);
      series.forEach((point) => expect(point.Value).toBe(0));
    });

    it('treats a stored zero MonthlyPayment as unset and amortizes instead of growing forever (#51)', () => {
      // With the bug, a stored 0 was a real $0/month payment, so the balance
      // grew under interest indefinitely. It must instead derive an amortizing
      // payment from today's balance and remaining term and pay the loan down.
      const loan = makeLoan({
        InterestRate: 5,
        Principal: 100000,
        CurrentAmount: 100000,
        MonthlyPayment: 0,
        EndDate: monthsFromToday(120),
      });

      const series = forecastLoan(loan, monthsFromToday(120), 0, today);
      const start = series[0].Value;
      const end = series[series.length - 1].Value;

      expect(start).toBe(100000);
      expect(end).toBeLessThan(start); // amortizes, never grows
      expect(end).toBeLessThan(1); // effectively paid off by the end date
    });

    it('should grow the balance when the payment does not cover interest', () => {
      const loan = makeLoan({
        InterestRate: 12,
        CurrentAmount: 10000,
        MonthlyPayment: 50,
      });
      const series = forecastLoan(loan, monthsFromToday(12), 0, today);
      expect(series[12].Value).toBeGreaterThan(10000);
    });

    it('should derive a payment from the current balance and remaining term when MonthlyPayment is missing', () => {
      const loan = makeLoan({
        InterestRate: 6,
        Principal: 24000,
        CurrentAmount: 12000,
        StartDate: new Date(2024, 5, 1),
        EndDate: monthsFromToday(12),
        MonthlyPayment: undefined,
      });
      const series = forecastLoan(loan, monthsFromToday(12), 0, today);
      expect(series[1].Value).toBeLessThan(series[0].Value);
      // Derived payment should amortize today's balance by the end date.
      expect(series[12].Value).toBeLessThan(1);
    });

    it('should derive a principal-only payment for a zero-interest loan', () => {
      const loan = makeLoan({
        InterestRate: 0,
        Principal: 12000,
        CurrentAmount: 6000,
        StartDate: new Date(2024, 5, 1),
        EndDate: monthsFromToday(12),
        MonthlyPayment: undefined,
      });
      const series = forecastLoan(loan, monthsFromToday(12), 0, today);
      expect(series[1].Value).toBe(5500);
      expect(series[12].Value).toBe(0);
    });
  });

  describe('forecastInvestment', () => {
    it('should anchor the first point to CurrentValue when present', () => {
      const investment = makeInvestment({ CurrentValue: 2500 });
      const series = forecastInvestment(
        investment,
        monthsFromToday(12),
        0,
        today
      );
      expect(series[0].Value).toBe(2500);
    });

    it('should anchor to the value projected for today when CurrentValue is missing', () => {
      const investment = makeInvestment({
        StartDate: new Date(2020, 0, 1),
        StartingBalance: 5000,
        AverageReturnRate: 5,
        CompoundingPeriod: CompoundingFrequency.Annually,
      });
      const growth = generateInvestmentGrowth(investment, today);
      const expected = growth[growth.length - 1].TotalValue;

      const series = forecastInvestment(
        investment,
        monthsFromToday(12),
        0,
        today
      );
      expect(series[0].Value).toBe(expected);
    });

    it('should compound annually at the end of each year', () => {
      const investment = makeInvestment({
        CurrentValue: 1000,
        AverageReturnRate: 5,
        CompoundingPeriod: CompoundingFrequency.Annually,
      });
      const series = forecastInvestment(
        investment,
        monthsFromToday(12),
        0,
        today
      );
      expect(series[11].Value).toBe(1000);
      expect(series[12].Value).toBeCloseTo(1050, 2);
    });

    it('should compound monthly each month', () => {
      const investment = makeInvestment({
        CurrentValue: 1000,
        AverageReturnRate: 12,
        CompoundingPeriod: CompoundingFrequency.Monthly,
      });
      const series = forecastInvestment(
        investment,
        monthsFromToday(2),
        0,
        today
      );
      expect(series[1].Value).toBeCloseTo(1010, 2);
      expect(series[2].Value).toBeCloseTo(1020.1, 2);
    });

    it('should add monthly contributions', () => {
      const investment = makeInvestment({
        CurrentValue: 1000,
        RecurringContribution: 100,
        ContributionFrequency: CompoundingFrequency.Monthly,
      });
      const series = forecastInvestment(
        investment,
        monthsFromToday(12),
        0,
        today
      );
      expect(series[12].Value).toBe(1000 + 12 * 100);
    });

    it('should add quarterly contributions four times per year', () => {
      const investment = makeInvestment({
        CurrentValue: 1000,
        RecurringContribution: 100,
        ContributionFrequency: CompoundingFrequency.Quarterly,
      });
      const series = forecastInvestment(
        investment,
        monthsFromToday(12),
        0,
        today
      );
      expect(series[12].Value).toBe(1000 + 4 * 100);
    });

    it('holds flat on non-boundary months for a quarterly contribution', () => {
      // Mutation guard: the previous test only checks month 12, so any mutant
      // that leaks contributions into off-cadence months (e.g. weakening the
      // `elapsedMonths % contributionInterval === 0` gate) goes undetected.
      // With 0% return and StartDate = today, quarter boundaries land exactly on
      // months 3/6/9/12, so the months between must hold flat at the anchor.
      const investment = makeInvestment({
        CurrentValue: 1000,
        RecurringContribution: 100,
        ContributionFrequency: CompoundingFrequency.Quarterly,
      });
      const series = forecastInvestment(
        investment,
        monthsFromToday(12),
        0,
        today
      );
      expect(series[1].Value).toBe(1000);
      expect(series[2].Value).toBe(1000);
      expect(series[3].Value).toBe(1100);
      expect(series[4].Value).toBe(1100);
      expect(series[5].Value).toBe(1100);
      expect(series[6].Value).toBe(1200);
    });

    it('should not apply contributions when ContributionFrequency is missing', () => {
      const investment = makeInvestment({
        CurrentValue: 1000,
        RecurringContribution: 100,
        ContributionFrequency: undefined,
      });
      const series = forecastInvestment(
        investment,
        monthsFromToday(12),
        0,
        today
      );
      series.forEach((point) => expect(point.Value).toBe(1000));
    });

    it('should anchor contribution cadence to the investment start date', () => {
      const investment = makeInvestment({
        StartDate: new Date(2026, 3, 1), // April 1, 2026 — off-cycle vs. today
        CurrentValue: 1000,
        RecurringContribution: 100,
        ContributionFrequency: CompoundingFrequency.Quarterly,
      });
      const series = forecastInvestment(
        investment,
        monthsFromToday(12),
        0,
        today
      );
      // Cadence runs Apr/Jul/Oct/Jan regardless of the forecast run date:
      // contributions land at months 1 (Jul), 4 (Oct), 7 (Jan), 10 (Apr).
      expect(series[1].Value).toBe(1100);
      expect(series[3].Value).toBe(1100);
      expect(series[4].Value).toBe(1200);
      expect(series[10].Value).toBe(1400);
      expect(series[12].Value).toBe(1400);
    });

    it('should add extra monthly contributions on top of recurring ones', () => {
      const investment = makeInvestment({
        CurrentValue: 1000,
        RecurringContribution: 100,
        ContributionFrequency: CompoundingFrequency.Monthly,
      });
      const series = forecastInvestment(
        investment,
        monthsFromToday(12),
        50,
        today
      );
      expect(series[12].Value).toBe(1000 + 12 * 100 + 12 * 50);
    });

    it('adds a one-time lump contribution once at month 1 (#8.2)', () => {
      // 0% return, no recurring contribution: the lump lands at month 1 and the
      // value holds flat thereafter — proving it is applied exactly once.
      const investment = makeInvestment({ CurrentValue: 1000 });
      const series = forecastInvestment(
        investment,
        monthsFromToday(12),
        0,
        today,
        500
      );
      expect(series[0].Value).toBe(1000);
      expect(series[1].Value).toBe(1500);
      expect(series[12].Value).toBe(1500);
    });

    it('a one-time 401(k) lump earns the employer match up to the annual cap (#8.2)', () => {
      // 100% match up to 6% of $100k = a $6,000/yr cap. A $3,000 lump is under the
      // cap, so the employer adds another $3,000 in the same month — exactly like
      // the recurring/extra contributions the match already covers (ROADMAP 8.1).
      const base = makeInvestment({ CurrentValue: 1000 });
      const matched: Investment = {
        ...base,
        EmployerMatchRate: 100,
        EmployerMatchLimitPct: 6,
        AnnualSalary: 100000,
      };
      const unmatched = forecastInvestment(
        base,
        monthsFromToday(2),
        0,
        today,
        3000
      );
      const withMatch = forecastInvestment(
        matched,
        monthsFromToday(2),
        0,
        today,
        3000
      );
      expect(unmatched[1].Value).toBe(4000); // 1000 + 3000 lump, no match
      expect(withMatch[1].Value).toBe(7000); // + 3000 employer match
    });

    it('should apply the yearly step-up at the investment anniversary', () => {
      const investment = makeInvestment({
        StartDate: today,
        CurrentValue: 1000,
        RecurringContribution: 100,
        ContributionFrequency: CompoundingFrequency.Monthly,
        ContributionStepUpAmount: 50,
        ContributionStepUpType: StepUpType.Flat,
      });
      const series = forecastInvestment(
        investment,
        monthsFromToday(13),
        0,
        today
      );
      // ROADMAP §8.1 reconciliation: the step-up applies to the contribution
      // made ON the anniversary, matching the canonical generateInvestmentGrowth
      // engine. The 12 contributions through month 12 are all year-one ($100
      // each), so month 12 = 1000 + 12·100. The contribution at month 13 is the
      // first year-two contribution, stepped up to $150. (Previously the grid
      // engine stepped up one month early at month 12 — the off-by-one this
      // fixes.)
      expect(series[12].Value).toBe(1000 + 12 * 100);
      expect(series[13].Value).toBe(1000 + 12 * 100 + 150);
    });

    it('grows a user-supplied CurrentValue by only the remaining partial period at the first boundary (#103)', () => {
      // CurrentValue is today's actual value with NO pro-rated slice baked in
      // (unlike the generateInvestmentGrowth anchor), so at the first boundary it
      // must earn only the remaining (1 − f) of the period — not the
      // (1+r)/(1+r·f) factor, which would divide out a slice that was never added
      // and systematically under-credit it.
      const investment = makeInvestment({
        StartDate: new Date(2020, 0, 1),
        CompoundingPeriod: CompoundingFrequency.Annually,
        AverageReturnRate: 10,
        StartingBalance: 100000,
        CurrentValue: 100000,
      });
      const series = forecastInvestment(
        investment,
        new Date(2030, 0, 1),
        0,
        today
      );

      // today (Jun 1 2026) is f of the way through the 2026 annual period; the
      // first compounding boundary is the grid month that reaches Jan 2027.
      const boundary = new Date(2026, 0, 1);
      const next = new Date(2027, 0, 1);
      const f =
        (today.getTime() - boundary.getTime()) /
        (next.getTime() - boundary.getTime());
      const firstBoundaryMonth = 7; // Jun 2026 + 7 months = Jan 2027
      expect(dayjs(today).add(firstBoundaryMonth, 'month').month()).toBe(0);

      // Linear remaining-fraction growth, matching the engine's partial-period
      // pro-rating.
      const expected =
        Math.round(100000 * (1 + (10 / 100) * (1 - f)) * 100) / 100;
      expect(Math.round(series[firstBoundaryMonth].Value * 100)).toBe(
        Math.round(expected * 100)
      );

      // Strictly exceeds the old (buggy) (1+r)/(1+r·f) value it used to produce.
      const buggy = 100000 * (1.1 / (1 + 0.1 * f));
      expect(series[firstBoundaryMonth].Value).toBeGreaterThan(buggy);
    });
  });

  describe('forecastNetWorth', () => {
    it('should equal investments minus loans at every point', () => {
      const loan = makeLoan({
        InterestRate: 0,
        CurrentAmount: 1200,
        MonthlyPayment: 100,
      });
      const investment = makeInvestment({
        CurrentValue: 5000,
        RecurringContribution: 100,
        ContributionFrequency: CompoundingFrequency.Monthly,
      });
      const horizon = monthsFromToday(12);

      const loanSeries = forecastLoan(loan, horizon, 0, today);
      const investmentSeries = forecastInvestment(
        investment,
        horizon,
        0,
        today
      );
      const netWorth = forecastNetWorth(
        [loan],
        [investment],
        horizon,
        undefined,
        today
      );

      expect(netWorth).toHaveLength(13);
      netWorth.forEach((point, index) => {
        expect(point.Value).toBeCloseTo(
          investmentSeries[index].Value - loanSeries[index].Value,
          2
        );
      });
    });

    it('should improve net worth at the horizon when a scenario adds loan payments', () => {
      const loan = makeLoan({
        InterestRate: 12,
        CurrentAmount: 10000,
        MonthlyPayment: 200,
      });
      const horizon = monthsFromToday(12);

      const baseline = forecastNetWorth([loan], [], horizon, undefined, today);
      const scenario = forecastNetWorth(
        [loan],
        [],
        horizon,
        { ExtraLoanPayments: { 'loan-1': 300 } },
        today
      );

      expect(scenario[12].Value).toBeGreaterThan(baseline[12].Value);
    });

    it('applies a one-time loan payment from a scenario (#8.2)', () => {
      const loan = makeLoan({
        InterestRate: 12,
        CurrentAmount: 10000,
        MonthlyPayment: 200,
      });
      const horizon = monthsFromToday(12);

      const baseline = forecastNetWorth([loan], [], horizon, undefined, today);
      const scenario = forecastNetWorth(
        [loan],
        [],
        horizon,
        { OneTimeLoanPayments: { 'loan-1': 3000 } },
        today
      );

      // Anchors agree (the lump lands at month 1, not month 0).
      expect(scenario[0].Value).toBe(baseline[0].Value);
      // Less debt from month 1 on → higher (less negative) net worth at horizon.
      expect(scenario[12].Value).toBeGreaterThan(baseline[12].Value);
    });

    it('applies a one-time contribution from a scenario (#8.2)', () => {
      const investment = makeInvestment({ CurrentValue: 5000 });
      const horizon = monthsFromToday(12);

      const baseline = forecastNetWorth(
        [],
        [investment],
        horizon,
        undefined,
        today
      );
      const scenario = forecastNetWorth(
        [],
        [investment],
        horizon,
        { OneTimeContributions: { 'inv-1': 2000 } },
        today
      );

      expect(scenario[0].Value).toBe(baseline[0].Value);
      expect(scenario[12].Value).toBeCloseTo(baseline[12].Value + 2000, 2);
    });

    it('should ignore scenario entries whose IDs match nothing', () => {
      const loan = makeLoan();
      const horizon = monthsFromToday(12);

      const baseline = forecastNetWorth([loan], [], horizon, undefined, today);
      const scenario = forecastNetWorth(
        [loan],
        [],
        horizon,
        { ExtraLoanPayments: { 'no-such-loan': 300 } },
        today
      );

      baseline.forEach((point, index) => {
        expect(scenario[index].Value).toBe(point.Value);
      });
    });
  });

  describe('getPayoffDate', () => {
    it('should return the first date the series reaches zero', () => {
      const loan = makeLoan({
        InterestRate: 0,
        CurrentAmount: 1200,
        MonthlyPayment: 100,
      });
      const series = forecastLoan(loan, monthsFromToday(24), 0, today);
      expect(getPayoffDate(series)!.getTime()).toBe(
        monthsFromToday(12).getTime()
      );
    });

    it('should return undefined when the loan outlives the horizon', () => {
      const loan = makeLoan({
        InterestRate: 0,
        CurrentAmount: 100000,
        MonthlyPayment: 100,
      });
      const series = forecastLoan(loan, monthsFromToday(12), 0, today);
      expect(getPayoffDate(series)).toBeUndefined();
    });
  });

  describe('getMonthlyPaymentBreakdown (#8.3)', () => {
    it('is principal & interest alone for a loan with no escrow/PMI (backward compatible)', () => {
      const breakdown = getMonthlyPaymentBreakdown(makeLoan(), today);
      expect(breakdown).toEqual({
        principalAndInterest: 500,
        escrow: 0,
        pmi: 0,
        total: 500,
      });
    });

    it('adds escrow and active PMI to the true monthly payment', () => {
      // LTV 9000/10000 = 0.9 > 0.8 → PMI applies; escrow = (1200+600)/12 = 150.
      const loan = makeLoan({
        CurrentAmount: 9000,
        HomeValue: 10000,
        PropertyTaxAnnual: 1200,
        HomeInsuranceAnnual: 600,
        MonthlyPmi: 80,
      });
      expect(getMonthlyPaymentBreakdown(loan, today)).toEqual({
        principalAndInterest: 500,
        escrow: 150,
        pmi: 80,
        total: 730,
      });
    });

    it('drops PMI from the total once LTV is at/below 80%', () => {
      const loan = makeLoan({
        CurrentAmount: 8000, // 8000/10000 = 0.8, at the line
        HomeValue: 10000,
        MonthlyPmi: 80,
      });
      const breakdown = getMonthlyPaymentBreakdown(loan, today);
      expect(breakdown.pmi).toBe(0);
      expect(breakdown.total).toBe(500);
    });
  });

  describe('getPmiEndDate (#8.3)', () => {
    it('is undefined when the loan has no PMI or no home value', () => {
      expect(getPmiEndDate(makeLoan(), today)).toBeUndefined();
      expect(
        getPmiEndDate(makeLoan({ MonthlyPmi: 80 }), today)
      ).toBeUndefined();
    });

    it('returns the first month the balance reaches 80% of home value', () => {
      // 0% interest, $500/mo: 90000 → 80000 takes exactly 20 months.
      const loan = makeLoan({
        InterestRate: 0,
        CurrentAmount: 90000,
        Principal: 100000,
        MonthlyPayment: 500,
        HomeValue: 100000,
        MonthlyPmi: 80,
      });
      expect(getPmiEndDate(loan, today)!.getTime()).toBe(
        monthsFromToday(20).getTime()
      );
    });

    it('returns today when the balance is already at/below 80% LTV', () => {
      const loan = makeLoan({
        CurrentAmount: 70000,
        Principal: 100000,
        HomeValue: 100000,
        MonthlyPmi: 80,
      });
      expect(getPmiEndDate(loan, today)!.getTime()).toBe(today.getTime());
    });

    it('is undefined when an under-amortizing loan never builds 20% equity', () => {
      // Payment below the monthly interest → balance grows, never crossing 80%.
      const loan = makeLoan({
        InterestRate: 12,
        CurrentAmount: 90000,
        Principal: 100000,
        MonthlyPayment: 50,
        HomeValue: 100000,
        MonthlyPmi: 80,
      });
      expect(getPmiEndDate(loan, today)).toBeUndefined();
    });
  });
});
