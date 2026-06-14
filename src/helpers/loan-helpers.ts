import {
  AmortizationScheduleEntry,
  defaultPit,
  Loan,
  PitLoan,
} from '../models/loan-model';

// Returns the number of terms (months) between the start date and end date.
// If an inputted date is provided it is used as the end date.
export const getTerms = (loan: Loan, date?: Date): number => {
  if (!loan.StartDate || !loan.EndDate) {
    return 0;
  }

  // A date before the loan starts means no terms have been paid. Returning 0
  // (not 1) keeps the PIT view from reporting a phantom first payment for dates
  // earlier than StartDate. (#53)
  if (date && date < loan.StartDate) {
    return 0;
  }

  if (date && date >= loan.EndDate) {
    return getTerms(loan);
  }

  const endDate = date ?? loan.EndDate;
  const months =
    endDate.getFullYear() * 12 +
    endDate.getMonth() -
    loan.StartDate.getFullYear() * 12 -
    loan.StartDate.getMonth() +
    1;

  return Math.max(1, months);
};

// Returns a monthly payment calculated for the loan based on the principal and interest rate
export const getMonthlyPayment = (
  principal: number,
  interestRate: number,
  terms: number
): number => {
  // interestRate === 0 is valid (interest-free loan); negative rates and
  // non-positive principal or terms are not.
  if (principal <= 0 || interestRate < 0 || terms <= 0) {
    return 0;
  }

  const monthlyInterestRate = interestRate / 100 / 12;
  if (monthlyInterestRate === 0) {
    // Interest-free loan: equal principal instalments rounded to cents.
    // Arithmetic: principal / terms  (e.g. 12000 / 60 = 200.00)
    return Math.round((principal / terms) * 100) / 100;
  }

  const numerator =
    monthlyInterestRate * Math.pow(1 + monthlyInterestRate, terms);
  const denominator = Math.pow(1 + monthlyInterestRate, terms) - 1;

  const payment = principal * (numerator / denominator);
  return Math.round(payment * 100) / 100;
};

// Returns a point-in-time view of a loan given a date.
export const getPitCalculation = (loan: Loan, date: Date): PitLoan => {
  const paidTerms = getTerms(loan, date);
  const relevantAmortization = generateAmortizationSchedule(loan, paidTerms);

  // A loan without MonthlyPayment has no schedule; return the zero default.
  if (relevantAmortization.length === 0) {
    return defaultPit;
  }

  const lastEntry = relevantAmortization[paidTerms - 1];

  return {
    PaidTerms: lastEntry.Term,
    RemainingTerms: getTerms(loan) - lastEntry.Term,
    RemainingPrincipal: lastEntry.RemainingBalance,
    PaidPrincipal: loan.Principal - lastEntry.RemainingBalance,
    PaidInterest: relevantAmortization
      .slice(0, paidTerms)
      .reduce((acc, entry) => acc + entry.InterestPayment, 0),
  } as PitLoan;
};

// Returns an array of entries for the amortization of a loan.
// If `terms` is provided, it will generate up to that many terms.
export const generateAmortizationSchedule = (
  loan: Loan,
  terms?: number
): AmortizationScheduleEntry[] => {
  // A non-positive (or unset) MonthlyPayment is "no payment specified" — there
  // is nothing to amortize. Guarding here (not only on `undefined`) stops a
  // stored 0 from producing a schedule whose balance grows under interest
  // forever. (#51)
  if (loan.MonthlyPayment === undefined || loan.MonthlyPayment <= 0) {
    return [];
  }

  const schedule: AmortizationScheduleEntry[] = [];
  const monthlyInterestRate = loan.InterestRate / 100 / 12;
  const totalTerms = getTerms(loan);
  const numberOfPayments = terms ?? totalTerms;
  let remainingBalance = loan.Principal;

  for (let term = 1; term <= numberOfPayments; term++) {
    const interestPayment =
      Math.round(remainingBalance * monthlyInterestRate * 100) / 100;

    // Close the loan out on the scheduled final term, or as soon as a normal
    // payment would cover the entire remaining balance (an early payoff, when
    // the monthly payment exceeds the amortizing amount). Clamping principal to
    // the remaining balance stops the running balance from going negative and
    // emitting garbage rows — negative interest, a catastrophic final row —
    // past the payoff point. (#59)
    const normalPrincipal =
      Math.round((loan.MonthlyPayment - interestPayment) * 100) / 100;
    const isFinalTerm =
      term === totalTerms || normalPrincipal >= remainingBalance;
    const principalPayment = isFinalTerm ? remainingBalance : normalPrincipal;
    remainingBalance -= principalPayment;

    schedule.push({
      Term: term,
      PrincipalPayment: principalPayment,
      InterestPayment: interestPayment,
      RemainingBalance: Math.max(remainingBalance, 0), // Ensure no negative balance
    });

    // Once the balance is cleared, stop — never emit rows after payoff.
    if (remainingBalance <= 0) {
      break;
    }
  }

  return schedule;
};
