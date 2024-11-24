import { Loan, PitLoan } from "../loan/loan-model";

// Returns the number of terms (months) between the start date and end date. 
// If an inputted date is provided it is used as the end date. 
export const GetTerms = (loan: Loan, date?: Date): number => {
  // amortization schedule for x date
  const months =
    (date ?? loan.EndDate).getFullYear() * 12 +
    (date ?? loan.EndDate).getMonth() -
    loan.StartDate.getFullYear() * 12 -
    loan.StartDate.getMonth() +
    1;

  return months;
};

export const GetRemainingPrincipal = (loan: Loan, date: Date): number => {
    // amortization schedule for x date
    
    return 5000;
};

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