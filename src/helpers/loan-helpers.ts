import { AmortizationScheduleEntry, Loan, PitLoan } from '../models/loan-model';

// Returns the number of terms (months) between the start date and end date.
// If an inputted date is provided it is used as the end date.
export const getTerms = (loan: Loan, date?: Date): number => {
  if (date && date < loan.StartDate) {
    return 1;
  }

  if (date && date >= loan.EndDate) {
    return getTerms(loan);
  }

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

// Returns a point-in-time view of a loan given a date.
export const getPitCalculation = (loan: Loan, date: Date): PitLoan => {
  const paidTerms = getTerms(loan, date);
  const relevantAmortization = generateAmortizationSchedule(loan, paidTerms);
  const lastEntry = relevantAmortization[relevantAmortization.length - 1];

  return {
    PaidTerms: lastEntry.Term,
    RemainingTerms: getTerms(loan) - lastEntry.Term,
    RemainingPrincipal: lastEntry.RemainingBalance,
    PaidPrincipal: loan.Principal - lastEntry.RemainingBalance,
    PaidInterest: relevantAmortization.reduce(
      (acc, entry) => acc + entry.InterestPayment,
      0
    ),
  } as PitLoan;
};

// Returns an array of entries for the amortization of a loan.
// If `terms` is provided, it will generate up to that many terms.
export const generateAmortizationSchedule = (
  loan: Loan,
  terms?: number
): AmortizationScheduleEntry[] => {
  if (loan.MonthlyPayment === undefined) {
    return [];
  }

  const schedule: AmortizationScheduleEntry[] = [];
  const monthlyInterestRate = loan.InterestRate / 100 / 12;
  const totalTerms = getTerms(loan);
  const numberOfPayments = terms ?? totalTerms;
  let remainingBalance = loan.Principal;

  for (let term = 1; term <= numberOfPayments; term++) {
    const isLastTerm = term === totalTerms;

    const interestPayment =
      Math.round(remainingBalance * monthlyInterestRate * 100) / 100;
    const principalPayment = !isLastTerm
      ? Math.round((loan.MonthlyPayment - interestPayment) * 100) / 100
      : remainingBalance;
    remainingBalance -= principalPayment;

    schedule.push({
      Term: term,
      PrincipalPayment: principalPayment,
      InterestPayment: interestPayment,
      RemainingBalance: Math.max(remainingBalance, 0), // Ensure no negative balance
    });
  }

  return schedule;
};
