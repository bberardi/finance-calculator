import { describe, it, expect } from 'vitest';
import {
  getMonthlyPayment,
  generateAmortizationSchedule,
} from './loan-helpers';
import {
  generateInvestmentGrowth,
  getContributionForYear,
} from './investment-helpers';
import { Loan } from '../models/loan-model';
import {
  CompoundingFrequency,
  Investment,
  StepUpType,
} from '../models/investment-model';

// Math Correctness Charter §4, layer 1 — Reference (oracle) tests.
//
// Every formula is asserted against externally computed values: spreadsheet
// functions (PMT/IPMT/CUMIPMT/FV) and closed-form hand derivations, with at
// least two independent reference points per formula and the source cited next
// to each. Rounding follows PRECISION.md (cents, round-half-up).

const makeLoan = (over: Partial<Loan>): Loan => ({
  Id: 'L',
  Provider: '',
  Name: '',
  InterestRate: 0,
  StartDate: new Date(2020, 0, 1),
  EndDate: new Date(2020, 0, 1),
  Principal: 0,
  CurrentAmount: 0,
  ...over,
});

const makeInvestment = (over: Partial<Investment>): Investment => ({
  Id: 'I',
  Provider: '',
  Name: '',
  StartDate: new Date(2020, 0, 1),
  StartingBalance: 0,
  AverageReturnRate: 0,
  CompoundingPeriod: CompoundingFrequency.Monthly,
  ...over,
});

describe('Reference: loan monthly payment (Excel PMT)', () => {
  // PMT = P · r / (1 − (1+r)^−n), r = annualRate/12. Independent re-derivation
  // of the canonical fully-amortizing payment, cross-checked to spreadsheet PMT.
  const pmtClosedForm = (P: number, annualPct: number, n: number): number => {
    const r = annualPct / 100 / 12;
    if (r === 0) return Math.round((P / n) * 100) / 100;
    const factor = Math.pow(1 + r, n);
    return Math.round(((P * (r * factor)) / (factor - 1)) * 100) / 100;
  };

  it('matches Excel PMT(0.035/12, 360, -100000) = 449.04', () => {
    // Source: Excel/Google Sheets =PMT(0.035/12,360,-100000) → 449.0387… → 449.04
    expect(getMonthlyPayment(100000, 3.5, 360)).toBe(449.04);
    expect(getMonthlyPayment(100000, 3.5, 360)).toBe(
      pmtClosedForm(100000, 3.5, 360)
    );
  });

  it('matches Excel PMT(0.06/12, 360, -200000) = 1199.10', () => {
    // Source: Excel =PMT(0.06/12,360,-200000) → 1199.101… → 1199.10
    expect(getMonthlyPayment(200000, 6, 360)).toBe(1199.1);
    expect(getMonthlyPayment(200000, 6, 360)).toBe(
      pmtClosedForm(200000, 6, 360)
    );
  });

  it('matches Excel PMT(0.045/12, 60, -25000) = 466.08 (auto loan)', () => {
    // Source: Excel =PMT(0.045/12,60,-25000) → 466.076… → 466.08
    expect(getMonthlyPayment(25000, 4.5, 60)).toBe(466.08);
    expect(getMonthlyPayment(25000, 4.5, 60)).toBe(
      pmtClosedForm(25000, 4.5, 60)
    );
  });

  it('reduces to principal/terms for a 0% loan', () => {
    // Closed form: 12000 / 60 = 200.00 exactly (no interest term).
    expect(getMonthlyPayment(12000, 0, 60)).toBe(200);
    expect(getMonthlyPayment(12000, 0, 60)).toBe(pmtClosedForm(12000, 0, 60));
  });
});

describe('Reference: amortization schedule (hand-derived, IPMT/CUMIPMT)', () => {
  // A fully hand-derivable loan: $1,000 at 12%/yr (1%/mo) over 3 months.
  // PMT = =PMT(0.01,3,-1000) = 340.02. Month-by-month by hand:
  //   m1: interest 1000·0.01 = 10.00, principal 340.02−10.00 = 330.02, bal 669.98
  //   m2: interest 669.98·0.01 = 6.70,  principal 340.02−6.70 = 333.32, bal 336.66
  //   m3: interest 336.66·0.01 = 3.37,  principal = remaining 336.66 (final), bal 0.00
  const loan = makeLoan({
    InterestRate: 12,
    StartDate: new Date(2020, 0, 1),
    EndDate: new Date(2020, 2, 1), // 3 terms
    Principal: 1000,
    CurrentAmount: 1000,
    MonthlyPayment: getMonthlyPayment(1000, 12, 3),
  });
  const schedule = generateAmortizationSchedule(loan);

  it('payment equals Excel PMT(0.01, 3, -1000) = 340.02', () => {
    expect(loan.MonthlyPayment).toBe(340.02);
  });

  it('reproduces the hand-derived month-by-month schedule exactly', () => {
    expect(schedule).toEqual([
      {
        Term: 1,
        PrincipalPayment: 330.02,
        InterestPayment: 10,
        RemainingBalance: 669.98,
      },
      {
        Term: 2,
        PrincipalPayment: 333.32,
        InterestPayment: 6.7,
        RemainingBalance: 336.66,
      },
      {
        Term: 3,
        PrincipalPayment: 336.66,
        InterestPayment: 3.37,
        RemainingBalance: 0,
      },
    ]);
  });

  it('first-term interest equals IPMT period 1 (= balance × monthly rate)', () => {
    // Independent reference: =IPMT(0.035/12,1,360,-100000) = 291.67 (= 100000·0.035/12).
    const m = makeLoan({
      InterestRate: 3.5,
      StartDate: new Date(2020, 0, 1),
      EndDate: new Date(2050, 0, 1),
      Principal: 100000,
      CurrentAmount: 100000,
      MonthlyPayment: getMonthlyPayment(100000, 3.5, 360),
    });
    expect(generateAmortizationSchedule(m)[0].InterestPayment).toBe(291.67);
  });

  it('total interest matches CUMIPMT within last-term rounding', () => {
    // CUMIPMT closed form for a level-payment loan: n·PMT − P.
    //   3 · 340.02 − 1000 = 20.06. Our schedule sets the final term to the exact
    //   remaining balance (PRECISION.md §2), so the lifetime total is 20.07 —
    //   one cent above the level-payment ideal. Tolerance = that final-term cent.
    const totalInterest = schedule.reduce((a, e) => a + e.InterestPayment, 0);
    expect(totalInterest).toBeCloseTo(3 * 340.02 - 1000, 1); // within $0.05
    expect(Math.round(totalInterest * 100) / 100).toBe(20.07);
  });
});

describe('Reference: investment compound growth (Excel FV)', () => {
  it('lump sum, annual compounding: FV(0.07, 10, 0, -10000) = 19,671.51', () => {
    // Source: Excel =FV(0.07,10,0,-10000) → 19671.5136… → 19671.51
    const inv = makeInvestment({
      StartingBalance: 10000,
      AverageReturnRate: 7,
      CompoundingPeriod: CompoundingFrequency.Annually,
    });
    const g = generateInvestmentGrowth(inv, new Date(2030, 0, 1));
    expect(g[g.length - 1].TotalValue).toBe(19671.51);
    // Closed form cross-check: 10000 · 1.07^10.
    expect(g[g.length - 1].TotalValue).toBe(
      Math.round(10000 * Math.pow(1.07, 10) * 100) / 100
    );
  });

  it('lump sum, monthly compounding: FV(0.06/12, 12, 0, -10000) = 10,616.78', () => {
    // Source: Excel =FV(0.06/12,12,0,-10000) → 10616.778… → 10616.78
    const inv = makeInvestment({
      StartingBalance: 10000,
      AverageReturnRate: 6,
      CompoundingPeriod: CompoundingFrequency.Monthly,
    });
    const g = generateInvestmentGrowth(inv, new Date(2021, 0, 1));
    expect(g[g.length - 1].TotalValue).toBe(10616.78);
  });

  it('annuity-due, annual: FV(0.05, 3, -1000, 0, 1) = 3,310.13', () => {
    // Recurring contributions land at the start of each period (annuity due).
    // Source: Excel =FV(0.05,3,-1000,0,1) → 3310.125 → 3310.13. Hand check:
    //   y1: 1000·1.05 = 1050; y2: (1050+1000)·1.05 = 2152.50; y3: (2152.50+1000)·1.05 = 3310.13
    const inv = makeInvestment({
      StartingBalance: 0,
      AverageReturnRate: 5,
      CompoundingPeriod: CompoundingFrequency.Annually,
      RecurringContribution: 1000,
      ContributionFrequency: CompoundingFrequency.Annually,
    });
    const g = generateInvestmentGrowth(inv, new Date(2023, 0, 1));
    expect(g.map((e) => e.TotalValue)).toEqual([0, 1050, 2152.5, 3310.13]);
  });
});

describe('Reference: contribution step-ups (closed form)', () => {
  it('flat step-up adds a fixed amount per elapsed year', () => {
    // Year 3 of $500 base with $100/yr flat step-up: 500 + 100·(3−1) = 700.
    expect(getContributionForYear(500, 3, 100, StepUpType.Flat)).toBe(700);
    // Year 1 never steps up.
    expect(getContributionForYear(500, 1, 100, StepUpType.Flat)).toBe(500);
  });

  it('percentage step-up compounds per elapsed year', () => {
    // Year 3 of $1000 base with 10%/yr step-up: 1000 · 1.10^(3−1) = 1210.
    expect(getContributionForYear(1000, 3, 10, StepUpType.Percentage)).toBe(
      1210
    );
    // Year 2: 1000 · 1.10^1 = 1100.
    expect(getContributionForYear(1000, 2, 10, StepUpType.Percentage)).toBe(
      1100
    );
  });
});
