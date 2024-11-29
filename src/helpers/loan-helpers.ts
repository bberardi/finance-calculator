import { Loan, PitLoan } from "../models/loan-model";

// Returns the number of terms (months) between the start date and end date. 
// If an inputted date is provided it is used as the end date. 
export const getTerms = (loan: Loan, date?: Date): number => {
  const months =
    (date ?? loan.EndDate).getFullYear() * 12 +
    (date ?? loan.EndDate).getMonth() -
    loan.StartDate.getFullYear() * 12 -
    loan.StartDate.getMonth() +
    1;

  return months;
};

export const getMonthlyPayment = (
  principal: number,
  interestRate: number,
  terms: number
): number => {
  const monthlyInterestRate = interestRate / 100 / 12;
  const numerator =
    monthlyInterestRate * Math.pow(1 + monthlyInterestRate, terms);
  const denominator = Math.pow(1 + monthlyInterestRate, terms) - 1;
  return Math.round(principal * (numerator / denominator) * 100) / 100;
};

// Returns the amortization object given a loan and date in time.
export const getRemainingPrincipal = (loan: Loan, date: Date): number => {
    // import npm package amortize to perform calcs
    console.log(loan, date);
    return 5000;
};

// Returns a point-in-time view of a loan given a date.
export const getPitCalculation = (
  loan: Loan,
  date: Date
): PitLoan => {
  const paidTerms = getTerms(loan, date);
  const remainingPrincipal = getRemainingPrincipal(loan, date);

  return {
    RemainingPrincipal: remainingPrincipal,
    PaidPrincipal: loan.Principal - remainingPrincipal,
    PaidTerms: paidTerms,
    RemainingTerms: getTerms(loan) - paidTerms,
  } as PitLoan;
};