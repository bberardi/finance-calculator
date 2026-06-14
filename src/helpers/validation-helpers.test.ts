import { describe, it, expect } from 'vitest';
import { Loan } from '../models/loan-model';
import {
  CompoundingFrequency,
  Investment,
  StepUpType,
} from '../models/investment-model';
import {
  INVESTMENT_RETURN_WARNING_THRESHOLD,
  isInvestmentValid,
  isLoanValid,
  LOAN_RATE_WARNING_THRESHOLD,
  validateInvestment,
  validateLoan,
} from './validation-helpers';

// A fully valid loan: every error rule passes, no warnings triggered.
const validLoan = (): Loan => ({
  Id: '1',
  Provider: 'Acme Bank',
  Name: 'Car loan',
  InterestRate: 5,
  StartDate: new Date('2024-01-01'),
  EndDate: new Date('2029-01-01'),
  Principal: 20000,
  CurrentAmount: 15000,
  MonthlyPayment: 380,
});

// A fully valid investment: every error rule passes, no warnings triggered.
const validInvestment = (): Investment => ({
  Id: '1',
  Provider: 'Vanguard',
  Name: 'Index fund',
  StartDate: new Date('2024-01-01'),
  StartingBalance: 10000,
  AverageReturnRate: 7,
  CompoundingPeriod: CompoundingFrequency.Monthly,
});

describe('validateLoan — errors', () => {
  it('returns no errors for a fully valid loan', () => {
    const result = validateLoan(validLoan());
    expect(result.errors).toEqual({});
    expect(isLoanValid(validLoan())).toBe(true);
  });

  it('requires a non-empty Name (and treats whitespace as empty)', () => {
    expect(
      validateLoan({ ...validLoan(), Name: '' }).errors.Name
    ).toBeDefined();
    expect(
      validateLoan({ ...validLoan(), Name: '   ' }).errors.Name
    ).toBeDefined();
  });

  it('requires a non-empty Provider', () => {
    expect(
      validateLoan({ ...validLoan(), Provider: '' }).errors.Provider
    ).toBeDefined();
    expect(
      validateLoan({ ...validLoan(), Provider: '  ' }).errors.Provider
    ).toBeDefined();
  });

  it('requires Principal > 0 (boundary: 0 fails, 0.01 passes, negative fails)', () => {
    expect(
      validateLoan({ ...validLoan(), Principal: 0 }).errors.Principal
    ).toBeDefined();
    expect(
      validateLoan({ ...validLoan(), Principal: -1 }).errors.Principal
    ).toBeDefined();
    expect(
      validateLoan({ ...validLoan(), Principal: 0.01, CurrentAmount: 0.01 })
        .errors.Principal
    ).toBeUndefined();
  });

  it('requires CurrentAmount > 0 (boundary: 0 fails, 0.01 passes)', () => {
    expect(
      validateLoan({ ...validLoan(), CurrentAmount: 0 }).errors.CurrentAmount
    ).toBeDefined();
    expect(
      validateLoan({ ...validLoan(), CurrentAmount: 0.01 }).errors.CurrentAmount
    ).toBeUndefined();
  });

  it('requires InterestRate > 0 (boundary: 0 fails, 0.001 passes)', () => {
    expect(
      validateLoan({ ...validLoan(), InterestRate: 0 }).errors.InterestRate
    ).toBeDefined();
    expect(
      validateLoan({ ...validLoan(), InterestRate: 0.001 }).errors.InterestRate
    ).toBeUndefined();
  });

  it('requires EndDate strictly after StartDate (equal dates fail)', () => {
    const sameDay = new Date('2024-01-01');
    const loan = { ...validLoan(), StartDate: sameDay, EndDate: sameDay };
    expect(validateLoan(loan).errors.EndDate).toBeDefined();

    const reversed = {
      ...validLoan(),
      StartDate: new Date('2029-01-01'),
      EndDate: new Date('2024-01-01'),
    };
    expect(validateLoan(reversed).errors.EndDate).toBeDefined();

    // One day apart is valid.
    const valid = {
      ...validLoan(),
      StartDate: new Date('2024-01-01'),
      EndDate: new Date('2024-01-02'),
    };
    expect(validateLoan(valid).errors.EndDate).toBeUndefined();
  });

  it('requires MonthlyPayment > 0 (0, negative, and missing all fail; 0.01 passes)', () => {
    // Regression for #51: a non-positive payment never amortizes the loan.
    expect(
      validateLoan({ ...validLoan(), MonthlyPayment: 0 }).errors.MonthlyPayment
    ).toBeDefined();
    expect(
      validateLoan({ ...validLoan(), MonthlyPayment: -5 }).errors.MonthlyPayment
    ).toBeDefined();
    expect(
      validateLoan({ ...validLoan(), MonthlyPayment: undefined }).errors
        .MonthlyPayment
    ).toBeDefined();
    expect(
      validateLoan({ ...validLoan(), MonthlyPayment: 0.01 }).errors
        .MonthlyPayment
    ).toBeUndefined();
  });

  it('isLoanValid is false whenever any error is present', () => {
    expect(isLoanValid({ ...validLoan(), Name: '' })).toBe(false);
    expect(isLoanValid({ ...validLoan(), Principal: 0 })).toBe(false);
  });
});

describe('validateLoan — warnings (non-blocking)', () => {
  it('warns when CurrentAmount exceeds Principal but does not block saving', () => {
    const loan = { ...validLoan(), Principal: 10000, CurrentAmount: 15000 };
    const result = validateLoan(loan);
    expect(result.warnings.CurrentAmount).toBeDefined();
    expect(result.errors.CurrentAmount).toBeUndefined();
    expect(isLoanValid(loan)).toBe(true);
  });

  it('does not warn when CurrentAmount equals Principal (boundary)', () => {
    const loan = { ...validLoan(), Principal: 10000, CurrentAmount: 10000 };
    expect(validateLoan(loan).warnings.CurrentAmount).toBeUndefined();
  });

  it(`warns on interest rate above ${LOAN_RATE_WARNING_THRESHOLD}% (boundary: threshold itself does not warn)`, () => {
    expect(
      validateLoan({
        ...validLoan(),
        InterestRate: LOAN_RATE_WARNING_THRESHOLD,
      }).warnings.InterestRate
    ).toBeUndefined();
    const high = {
      ...validLoan(),
      InterestRate: LOAN_RATE_WARNING_THRESHOLD + 0.01,
    };
    expect(validateLoan(high).warnings.InterestRate).toBeDefined();
    expect(isLoanValid(high)).toBe(true);
  });
});

describe('validateInvestment — errors', () => {
  it('returns no errors for a fully valid investment', () => {
    const result = validateInvestment(validInvestment());
    expect(result.errors).toEqual({});
    expect(isInvestmentValid(validInvestment())).toBe(true);
  });

  it('requires a non-empty Name and Provider', () => {
    expect(
      validateInvestment({ ...validInvestment(), Name: '  ' }).errors.Name
    ).toBeDefined();
    expect(
      validateInvestment({ ...validInvestment(), Provider: '' }).errors.Provider
    ).toBeDefined();
  });

  it('requires StartingBalance > 0 (boundary: 0 fails, 0.01 passes)', () => {
    expect(
      validateInvestment({ ...validInvestment(), StartingBalance: 0 }).errors
        .StartingBalance
    ).toBeDefined();
    expect(
      validateInvestment({ ...validInvestment(), StartingBalance: 0.01 }).errors
        .StartingBalance
    ).toBeUndefined();
  });

  it('allows AverageReturnRate of 0 but rejects negative (boundary)', () => {
    expect(
      validateInvestment({ ...validInvestment(), AverageReturnRate: 0 }).errors
        .AverageReturnRate
    ).toBeUndefined();
    expect(
      validateInvestment({ ...validInvestment(), AverageReturnRate: -0.01 })
        .errors.AverageReturnRate
    ).toBeDefined();
  });

  it('isInvestmentValid is false whenever any error is present', () => {
    expect(isInvestmentValid({ ...validInvestment(), Name: '' })).toBe(false);
    expect(
      isInvestmentValid({ ...validInvestment(), StartingBalance: 0 })
    ).toBe(false);
  });
});

describe('validateInvestment — warnings (non-blocking)', () => {
  it(`warns on return above ${INVESTMENT_RETURN_WARNING_THRESHOLD}% (boundary: threshold itself does not warn)`, () => {
    expect(
      validateInvestment({
        ...validInvestment(),
        AverageReturnRate: INVESTMENT_RETURN_WARNING_THRESHOLD,
      }).warnings.AverageReturnRate
    ).toBeUndefined();
    const high = {
      ...validInvestment(),
      AverageReturnRate: INVESTMENT_RETURN_WARNING_THRESHOLD + 0.01,
    };
    expect(validateInvestment(high).warnings.AverageReturnRate).toBeDefined();
    expect(isInvestmentValid(high)).toBe(true);
  });

  it('warns when contribution cadence is finer than the compounding period', () => {
    // Monthly contributions, annual compounding -> finer cadence -> warn.
    const inv = {
      ...validInvestment(),
      CompoundingPeriod: CompoundingFrequency.Annually,
      RecurringContribution: 100,
      ContributionFrequency: CompoundingFrequency.Monthly,
    };
    const result = validateInvestment(inv);
    expect(result.warnings.ContributionFrequency).toBeDefined();
    expect(isInvestmentValid(inv)).toBe(true);
  });

  it('warns when cadence is quarterly and compounding is annual', () => {
    const inv = {
      ...validInvestment(),
      CompoundingPeriod: CompoundingFrequency.Annually,
      RecurringContribution: 100,
      ContributionFrequency: CompoundingFrequency.Quarterly,
    };
    expect(
      validateInvestment(inv).warnings.ContributionFrequency
    ).toBeDefined();
  });

  it('does not warn when cadence matches or is coarser than compounding', () => {
    const matching = {
      ...validInvestment(),
      CompoundingPeriod: CompoundingFrequency.Monthly,
      RecurringContribution: 100,
      ContributionFrequency: CompoundingFrequency.Monthly,
    };
    expect(
      validateInvestment(matching).warnings.ContributionFrequency
    ).toBeUndefined();

    const coarser = {
      ...validInvestment(),
      CompoundingPeriod: CompoundingFrequency.Monthly,
      RecurringContribution: 100,
      ContributionFrequency: CompoundingFrequency.Annually,
    };
    expect(
      validateInvestment(coarser).warnings.ContributionFrequency
    ).toBeUndefined();
  });

  it('does not warn about cadence when there is no recurring contribution', () => {
    const inv = {
      ...validInvestment(),
      CompoundingPeriod: CompoundingFrequency.Annually,
      RecurringContribution: 0,
      ContributionFrequency: CompoundingFrequency.Monthly,
    };
    expect(
      validateInvestment(inv).warnings.ContributionFrequency
    ).toBeUndefined();
  });

  it('warns when a step-up type is set but the amount is zero/missing', () => {
    const flat = {
      ...validInvestment(),
      RecurringContribution: 100,
      ContributionStepUpType: StepUpType.Flat,
      ContributionStepUpAmount: 0,
    };
    expect(
      validateInvestment(flat).warnings.ContributionStepUpAmount
    ).toBeDefined();

    const pct = {
      ...validInvestment(),
      RecurringContribution: 100,
      ContributionStepUpType: StepUpType.Percentage,
      ContributionStepUpAmount: undefined,
    };
    expect(
      validateInvestment(pct).warnings.ContributionStepUpAmount
    ).toBeDefined();
  });

  it('does not warn about step-up when an amount is provided', () => {
    const inv = {
      ...validInvestment(),
      RecurringContribution: 100,
      ContributionStepUpType: StepUpType.Flat,
      ContributionStepUpAmount: 50,
    };
    expect(
      validateInvestment(inv).warnings.ContributionStepUpAmount
    ).toBeUndefined();
  });

  it('does not warn about step-up when there is no recurring contribution', () => {
    const inv = {
      ...validInvestment(),
      RecurringContribution: 0,
      ContributionStepUpType: StepUpType.Flat,
      ContributionStepUpAmount: 0,
    };
    expect(
      validateInvestment(inv).warnings.ContributionStepUpAmount
    ).toBeUndefined();
  });
});
