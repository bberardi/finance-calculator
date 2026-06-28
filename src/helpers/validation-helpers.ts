// Pure form-validation rules for the loan and investment add/edit forms
// (roadmap 0.8). D7 boundary: this module operates on plain field values /
// model objects and returns structured results — NO React/MUI imports.
//
// Two kinds of result:
//   - errors:   block saving. These mirror the existing `isFormValid()` rules
//               so the button-disabled state and the per-field messages share a
//               single source of truth.
//   - warnings: do NOT block saving. Cross-field "sanity" checks that flag
//               inputs which pass type validation but likely produce a wrong
//               forecast (the Charter's "plausible chart on a wrong premise",
//               on the input side).
//
// `isFormValid` for each entity is simply: no error keys present.

import { Loan } from '../models/loan-model';
import {
  CompoundingFrequency,
  Investment,
  StepUpType,
} from '../models/investment-model';
import { Asset } from '../models/asset-model';

export interface ValidationResult<TField extends string> {
  errors: Partial<Record<TField, string>>;
  warnings: Partial<Record<TField, string>>;
  // Errors not tied to a specific field (e.g. a cross-field rule whose offending
  // field is ambiguous). Surfaced in the form's actions summary so the user can
  // always see why Save is disabled.
  formErrors: string[];
}

// Thresholds for the non-blocking sanity warnings. Chosen as "well outside the
// range of normal consumer products" so the warning is rare and meaningful:
//   - A consumer loan above 30% APR is almost always a data-entry slip (e.g. a
//     5.5% rate typed as 55). Payday/credit-card extremes exist, hence a warning
//     rather than an error.
//   - A long-run average investment return above 20%/yr beats every broad index
//     historically; usually a typo (e.g. 7 -> 70).
export const LOAN_RATE_WARNING_THRESHOLD = 30;
export const INVESTMENT_RETURN_WARNING_THRESHOLD = 20;

// Cadence ordering, finest (most frequent) first. A contribution cadence that is
// FINER than the compounding period means contributions land between compounding
// boundaries — the engine's premise (contribute on a compounding boundary) no
// longer holds, so the forecast may be off. Lower index = more frequent.
const CADENCE_ORDER: CompoundingFrequency[] = [
  CompoundingFrequency.Monthly,
  CompoundingFrequency.Quarterly,
  CompoundingFrequency.Annually,
];

const cadenceRank = (freq: CompoundingFrequency): number =>
  CADENCE_ORDER.indexOf(freq);

export type LoanField =
  | 'Name'
  | 'Provider'
  | 'Principal'
  | 'CurrentAmount'
  | 'InterestRate'
  | 'StartDate'
  | 'EndDate'
  | 'MonthlyPayment'
  | 'HomeValue'
  | 'PropertyTaxAnnual'
  | 'HomeInsuranceAnnual'
  | 'MonthlyPmi';

export const validateLoan = (loan: Loan): ValidationResult<LoanField> => {
  const errors: Partial<Record<LoanField, string>> = {};
  const warnings: Partial<Record<LoanField, string>> = {};
  const formErrors: string[] = [];

  // --- Blocking errors (mirror the original isFormValid rules) ---
  if (loan.Name.trim() === '') {
    errors.Name = 'Name is required.';
  }
  if (loan.Provider.trim() === '') {
    errors.Provider = 'Loan provider is required.';
  }
  if (!(loan.Principal > 0)) {
    errors.Principal = 'Principal must be greater than 0.';
  }
  if (!(loan.CurrentAmount > 0)) {
    errors.CurrentAmount = 'Current amount must be greater than 0.';
  }
  // 0% is a real, fully-supported rate (interest-free loans) — the engine and
  // the JSON import boundary both accept it, so the form must too, otherwise an
  // imported 0% loan becomes uneditable. Only negative (or non-numeric) rates
  // are rejected. (#72)
  if (!(loan.InterestRate >= 0)) {
    errors.InterestRate = 'Interest rate cannot be negative.';
  }
  if (!loan.StartDate) {
    errors.StartDate = 'Start date is required.';
  }
  if (!loan.EndDate) {
    errors.EndDate = 'End date is required.';
  }
  // End date must be strictly after start date. This was part of the original
  // isFormValid expression, so it stays an error (per the task's "if that's an
  // error already, keep it an error").
  if (loan.StartDate && loan.EndDate && !(loan.StartDate < loan.EndDate)) {
    errors.EndDate = 'End date must be after the start date.';
  }
  // A non-positive monthly payment never amortizes the loan (the balance would
  // grow under interest forever), so block it at the source. (#51)
  if (!(typeof loan.MonthlyPayment === 'number' && loan.MonthlyPayment > 0)) {
    errors.MonthlyPayment = 'Monthly payment must be greater than 0.';
  }

  // --- Non-blocking sanity warnings ---
  if (
    loan.Principal > 0 &&
    loan.CurrentAmount > 0 &&
    loan.CurrentAmount > loan.Principal
  ) {
    warnings.CurrentAmount =
      'Current amount is greater than the original principal — the forecast may be wrong.';
  }
  if (loan.InterestRate > LOAN_RATE_WARNING_THRESHOLD) {
    warnings.InterestRate = `Interest rate above ${LOAN_RATE_WARNING_THRESHOLD}% is unusually high — double-check the value.`;
  }
  // A payment that does not exceed the first period's interest never amortizes
  // the loan — the principal portion is <= 0, so the balance never shrinks and
  // the amortization schedule has nothing sensible to show. The `<=` boundary
  // mirrors generateAmortizationSchedule's guard (`normalPrincipal <= 0`), so a
  // break-even payment (interest exactly == payment) that yields an empty
  // schedule also gets this explanation rather than a silent zero projection.
  // Warn (don't block: the value is type-valid) so the user sees why their
  // projection looks wrong. (#70)
  if (
    loan.Principal > 0 &&
    loan.InterestRate > 0 &&
    typeof loan.MonthlyPayment === 'number' &&
    loan.MonthlyPayment > 0 &&
    loan.MonthlyPayment <= (loan.Principal * loan.InterestRate) / 100 / 12
  ) {
    warnings.MonthlyPayment =
      'Monthly payment does not exceed the first month’s interest — it will never pay the loan off.';
  }

  // "True monthly payment" fields (Phase 8.3): each is optional, but when present
  // must be a finite, non-negative amount.
  const nonNegativeOptionalFields: [LoanField, number | undefined][] = [
    ['HomeValue', loan.HomeValue],
    ['PropertyTaxAnnual', loan.PropertyTaxAnnual],
    ['HomeInsuranceAnnual', loan.HomeInsuranceAnnual],
    ['MonthlyPmi', loan.MonthlyPmi],
  ];
  for (const [field, value] of nonNegativeOptionalFields) {
    if (value !== undefined && !(Number.isFinite(value) && value >= 0)) {
      errors[field] = 'Enter a non-negative amount.';
    }
  }
  // PMI can only drop off when there's a home value to size the 80%-LTV line
  // against; flag a premium set without one so it doesn't silently never end.
  if ((loan.MonthlyPmi ?? 0) > 0 && !((loan.HomeValue ?? 0) > 0)) {
    warnings.MonthlyPmi =
      'Set a home value so PMI can drop off at 80% loan-to-value.';
  }

  return { errors, warnings, formErrors };
};

export const isLoanValid = (loan: Loan): boolean =>
  Object.keys(validateLoan(loan).errors).length === 0;

export type InvestmentField =
  | 'Name'
  | 'Provider'
  | 'StartingBalance'
  | 'AverageReturnRate'
  | 'StartDate'
  | 'CompoundingPeriod'
  | 'RecurringContribution'
  | 'ContributionFrequency'
  | 'ContributionStepUpAmount'
  | 'CurrentValue'
  | 'EmployerMatchRate'
  | 'EmployerMatchLimitPct'
  | 'AnnualSalary';

export const validateInvestment = (
  investment: Investment
): ValidationResult<InvestmentField> => {
  const errors: Partial<Record<InvestmentField, string>> = {};
  const warnings: Partial<Record<InvestmentField, string>> = {};
  const formErrors: string[] = [];

  // --- Blocking errors (mirror the original isFormValid rules) ---
  if (investment.Name.trim() === '') {
    errors.Name = 'Investment name is required.';
  }
  if (investment.Provider.trim() === '') {
    errors.Provider = 'Provider is required.';
  }
  // $0 is a real starting point (a brand-new account funded only by recurring
  // contributions) — the engine and the JSON import boundary both accept it, so
  // the form must too, otherwise an imported $0-balance investment becomes
  // uneditable. Only negative (or non-numeric) balances are rejected. (#72)
  if (!(investment.StartingBalance >= 0)) {
    errors.StartingBalance = 'Starting balance cannot be negative.';
  }
  // Original rule: AverageReturnRate >= 0 (0 is valid; negative is not).
  if (!(investment.AverageReturnRate >= 0)) {
    errors.AverageReturnRate = 'Average return rate cannot be negative.';
  }
  if (!investment.StartDate) {
    errors.StartDate = 'Start date is required.';
  }
  // These optional numeric fields are rejected when negative by the JSON import
  // boundary (data-helpers, >= 0), so the form must reject them too — otherwise a
  // value the form happily saves (a negative RecurringContribution drains the
  // investment in the forecast) cannot round-trip through export/import, and the
  // form and import boundary disagree. Only block when present and negative;
  // absent/0 stays valid. (#99, mirrors the #72 invariant)
  if (
    typeof investment.RecurringContribution === 'number' &&
    investment.RecurringContribution < 0
  ) {
    errors.RecurringContribution = 'Recurring contribution cannot be negative.';
  }
  if (
    typeof investment.ContributionStepUpAmount === 'number' &&
    investment.ContributionStepUpAmount < 0
  ) {
    errors.ContributionStepUpAmount = 'Step-up amount cannot be negative.';
  }
  if (
    typeof investment.CurrentValue === 'number' &&
    investment.CurrentValue < 0
  ) {
    errors.CurrentValue = 'Current value cannot be negative.';
  }
  // Employer-match inputs (ROADMAP 8.1): reject negatives when present, mirroring
  // the import boundary so the form and import agree.
  if (
    typeof investment.EmployerMatchRate === 'number' &&
    investment.EmployerMatchRate < 0
  ) {
    errors.EmployerMatchRate = 'Employer match rate cannot be negative.';
  }
  if (
    typeof investment.EmployerMatchLimitPct === 'number' &&
    investment.EmployerMatchLimitPct < 0
  ) {
    errors.EmployerMatchLimitPct = 'Employer match limit cannot be negative.';
  }
  if (
    typeof investment.AnnualSalary === 'number' &&
    investment.AnnualSalary < 0
  ) {
    errors.AnnualSalary = 'Salary cannot be negative.';
  }

  // --- Non-blocking sanity warnings ---
  // A $0 starting balance is valid, but $0 AND no recurring contribution
  // describes an empty investment that will never grow — warn rather than block,
  // since the value is type-valid and the forecast still runs (flat at 0). (#72)
  if (
    investment.StartingBalance === 0 &&
    !(
      typeof investment.RecurringContribution === 'number' &&
      investment.RecurringContribution > 0
    )
  ) {
    warnings.StartingBalance =
      'Starting balance is 0 with no recurring contribution — this investment will never grow.';
  }
  if (investment.AverageReturnRate > INVESTMENT_RETURN_WARNING_THRESHOLD) {
    warnings.AverageReturnRate = `A return above ${INVESTMENT_RETURN_WARNING_THRESHOLD}%/yr beats every broad index historically — double-check the value.`;
  }

  // A step-up that is configured but has no (or zero) amount silently does
  // nothing — warn rather than block, since the investment still forecasts.
  if (
    typeof investment.RecurringContribution === 'number' &&
    investment.RecurringContribution > 0 &&
    investment.ContributionStepUpType &&
    !(
      typeof investment.ContributionStepUpAmount === 'number' &&
      investment.ContributionStepUpAmount > 0
    )
  ) {
    warnings.ContributionStepUpAmount =
      investment.ContributionStepUpType === StepUpType.Percentage
        ? 'Step-up percentage is 0 — contributions will never increase.'
        : 'Step-up amount is 0 — contributions will never increase.';
  }

  // Contribution cadence finer than the compounding period: contributions land
  // between compounding boundaries, so the forecast premise may be off.
  if (
    typeof investment.RecurringContribution === 'number' &&
    investment.RecurringContribution > 0 &&
    investment.ContributionFrequency &&
    cadenceRank(investment.ContributionFrequency) <
      cadenceRank(investment.CompoundingPeriod)
  ) {
    warnings.ContributionFrequency =
      'Contributions are more frequent than compounding — the forecast may understate growth between compounding dates.';
  }

  // An employer match needs all three inputs to do anything; a partial setup
  // silently no-ops, so warn rather than block. (ROADMAP 8.1)
  const matchInputsSet = [
    investment.EmployerMatchRate,
    investment.EmployerMatchLimitPct,
    investment.AnnualSalary,
  ].filter((value) => typeof value === 'number' && value > 0).length;
  if (matchInputsSet > 0 && matchInputsSet < 3) {
    warnings.EmployerMatchRate =
      'Employer match needs a match rate, a salary %, and a salary — it is ignored until all three are set.';
  }

  return { errors, warnings, formErrors };
};

export const isInvestmentValid = (investment: Investment): boolean =>
  Object.keys(validateInvestment(investment).errors).length === 0;

// A growth/decline rate beyond this magnitude (in %/yr) is almost always a
// data-entry slip for any of the asset types Phase 7 covers: a HYSA APY, a
// home's appreciation, or a custom asset's drift. Warn (don't block) — a value
// this large is type-valid and still forecasts.
export const ASSET_GROWTH_WARNING_THRESHOLD = 25;

export type AssetField = 'Name' | 'Provider' | 'Balance' | 'GrowthRate';

export const validateAsset = (asset: Asset): ValidationResult<AssetField> => {
  const errors: Partial<Record<AssetField, string>> = {};
  const warnings: Partial<Record<AssetField, string>> = {};
  const formErrors: string[] = [];

  // --- Blocking errors ---
  if (asset.Name.trim() === '') {
    errors.Name = 'Name is required.';
  }
  if (asset.Provider.trim() === '') {
    errors.Provider = 'Provider is required.';
  }
  // Balance is the current value (a liability's debt is stored positive too), so
  // it must be non-negative — mirrors the JSON import boundary (data-helpers,
  // >= 0) so a saved asset round-trips through export/import.
  if (!(asset.Balance >= 0)) {
    errors.Balance = 'Balance cannot be negative.';
  }
  // GrowthRate may be negative (a depreciating asset), so the only error is a
  // non-finite value (NaN/Infinity), which the import boundary also rejects.
  if (!Number.isFinite(asset.GrowthRate)) {
    errors.GrowthRate = 'Growth rate must be a number.';
  }

  // --- Non-blocking sanity warnings ---
  if (
    Number.isFinite(asset.GrowthRate) &&
    Math.abs(asset.GrowthRate) > ASSET_GROWTH_WARNING_THRESHOLD
  ) {
    warnings.GrowthRate = `A rate beyond ±${ASSET_GROWTH_WARNING_THRESHOLD}%/yr is unusual — double-check the value.`;
  }

  return { errors, warnings, formErrors };
};

export const isAssetValid = (asset: Asset): boolean =>
  Object.keys(validateAsset(asset).errors).length === 0;
