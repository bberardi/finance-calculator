import dayjs from 'dayjs';
import { Asset } from '../models/asset-model';
import { Loan } from '../models/loan-model';

// Cross-model conversion seed: turn a (custom-liability) Asset into a Loan the
// user can finish in the loan form. The Monarch/asset side only carries a name,
// provider, and balance, so the rate/term/payment are seeded with sensible
// placeholders the user adjusts before saving. Pure (D7): no React/MUI.

// Default term for a loan seeded from a converted liability — a typical mortgage
// length. The user changes the rate and term before saving.
export const CONVERTED_LOAN_TERM_YEARS = 30;

/**
 * Build a Loan pre-filled from an Asset (its outstanding balance becomes both the
 * principal and the current amount). The Id is left empty so the add flow assigns
 * a fresh one; the loan form recomputes the monthly payment from the seeded
 * principal/term and lets the user set the real interest rate.
 */
export const buildLoanSeedFromAsset = (
  asset: Asset,
  today: Date = new Date()
): Loan => ({
  Id: '',
  Provider: asset.Provider,
  Name: asset.Name,
  Principal: asset.Balance,
  CurrentAmount: asset.Balance,
  InterestRate: 0,
  StartDate: today,
  EndDate: dayjs(today).add(CONVERTED_LOAN_TERM_YEARS, 'year').toDate(),
  MonthlyPayment: 0,
});
