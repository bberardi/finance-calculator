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

  it('allows InterestRate of 0 (interest-free) but rejects negative (#72)', () => {
    // 0% is engine- and import-supported, so the form must accept it too —
    // otherwise an imported 0% loan is uneditable.
    expect(
      validateLoan({ ...validLoan(), InterestRate: 0 }).errors.InterestRate
    ).toBeUndefined();
    expect(
      validateLoan({ ...validLoan(), InterestRate: -0.01 }).errors.InterestRate
    ).toBeDefined();
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
    expect(result.warnings.CurrentAmount).toContain('greater than');
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
    expect(validateLoan(high).warnings.InterestRate).toContain(
      'unusually high'
    );
    expect(isLoanValid(high)).toBe(true);
  });

  it('warns when MonthlyPayment cannot cover the first month’s interest (#70)', () => {
    // 100k @ 12% => 1000 first-month interest; a 500 payment never amortizes.
    const underwater = {
      ...validLoan(),
      Principal: 100000,
      CurrentAmount: 100000,
      InterestRate: 12,
      MonthlyPayment: 500,
    };
    const result = validateLoan(underwater);
    expect(result.warnings.MonthlyPayment).toContain('interest');
    // Non-blocking: the value is type-valid, so saving is still allowed.
    expect(result.errors.MonthlyPayment).toBeUndefined();
    expect(isLoanValid(underwater)).toBe(true);
  });

  it('does not warn when MonthlyPayment exactly covers the interest (boundary)', () => {
    // A payment equal to the first month's interest is not strictly below it.
    const breakEven = {
      ...validLoan(),
      Principal: 100000,
      CurrentAmount: 100000,
      InterestRate: 12,
      MonthlyPayment: 1000,
    };
    expect(validateLoan(breakEven).warnings.MonthlyPayment).toBeUndefined();
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

  it('allows StartingBalance of 0 but rejects negative (#72)', () => {
    // $0 is engine- and import-supported (a new account funded only by
    // contributions), so the form must accept it too — otherwise an imported
    // $0-balance investment is uneditable. (The warning is asserted separately.)
    expect(
      validateInvestment({ ...validInvestment(), StartingBalance: 0 }).errors
        .StartingBalance
    ).toBeUndefined();
    expect(
      validateInvestment({ ...validInvestment(), StartingBalance: -0.01 })
        .errors.StartingBalance
    ).toBeDefined();
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
      isInvestmentValid({ ...validInvestment(), StartingBalance: -1 })
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
    expect(validateInvestment(high).warnings.AverageReturnRate).toContain(
      'beats every broad index'
    );
    expect(isInvestmentValid(high)).toBe(true);
  });

  it('warns on a $0 balance with no recurring contribution (#72)', () => {
    const empty = {
      ...validInvestment(),
      StartingBalance: 0,
      RecurringContribution: 0,
    };
    const result = validateInvestment(empty);
    expect(result.warnings.StartingBalance).toContain('never grow');
    // Non-blocking: $0 is a valid starting balance.
    expect(result.errors.StartingBalance).toBeUndefined();
    expect(isInvestmentValid(empty)).toBe(true);
  });

  it('does not warn on a $0 balance when a recurring contribution is set (#72)', () => {
    const funded = {
      ...validInvestment(),
      StartingBalance: 0,
      RecurringContribution: 100,
      ContributionFrequency: CompoundingFrequency.Monthly,
    };
    expect(validateInvestment(funded).warnings.StartingBalance).toBeUndefined();
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
    expect(result.warnings.ContributionFrequency).toContain('frequent');
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
    // Assert the message CONTENT, not just presence, so the flat/percentage
    // branch (a ternary) and its two distinct messages are exercised — the
    // .toBeDefined() form left the branch and message strings as surviving
    // mutants (ROADMAP §8.3).
    expect(
      validateInvestment(flat).warnings.ContributionStepUpAmount
    ).toContain('amount');

    const pct = {
      ...validInvestment(),
      RecurringContribution: 100,
      ContributionStepUpType: StepUpType.Percentage,
      ContributionStepUpAmount: undefined,
    };
    expect(validateInvestment(pct).warnings.ContributionStepUpAmount).toContain(
      'percentage'
    );
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
