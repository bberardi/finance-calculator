import { Loan, PitLoan } from "../models/loan-model";

// Returns the number of terms (months) between the start date and end date. 
// If an inputted date is provided it is used as the end date. 
export const GetTerms = (loan: Loan, date?: Date): number => {
  const months =
    (date ?? loan.EndDate).getFullYear() * 12 +
    (date ?? loan.EndDate).getMonth() -
    loan.StartDate.getFullYear() * 12 -
    loan.StartDate.getMonth() +
    1;

  return months;
};

// Returns the amortization object given a loan and date in time.
export const GetRemainingPrincipal = (loan: Loan, date: Date): number => {
    // import npm package amortize to perform calcs
    
    return 5000;
};

// Returns a point-in-time view of a loan given a date.
export const getPitCalculation = (
  loan: Loan,
  date: Date
): PitLoan => {
  const paidTerms = GetTerms(loan, date);
  const remainingPrincipal = GetRemainingPrincipal(loan, date);

  return {
    RemainingPrincipal: remainingPrincipal,
    PaidPrincipal: loan.InitialAmount - remainingPrincipal,
    PaidTerms: paidTerms,
    RemainingTerms: GetTerms(loan) - paidTerms,
  } as PitLoan;
};