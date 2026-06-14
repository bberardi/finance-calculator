import { describe, it, expect } from 'vitest';
import dayjs from 'dayjs';
import {
  forecastLoan,
  forecastInvestment,
  forecastNetWorth,
  getDefaultHorizon,
  getPayoffDate,
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
        monthsFromToday(12),
        0,
        today
      );
      // Months 1-11 fall in year one (100 each); month 12 lands on the
      // anniversary and steps up to 150.
      expect(series[12].Value).toBe(1000 + 11 * 100 + 150);
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
});
