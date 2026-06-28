// Input-only model: derived data (amortization schedules, forecasts) is
// computed on demand by helpers, never stored or serialized.
export interface Loan {
  Id: string;
  Provider: string;
  Name: string;
  InterestRate: number;
  StartDate: Date;
  EndDate: Date;
  Principal: number;
  CurrentAmount: number;
  // The amortizing principal-and-interest payment. The escrow/PMI fields below
  // are paid to third parties (the county, the insurer, the lender's mortgage
  // insurance) and are deliberately NOT part of this — they never pay down
  // principal, so the forecast amortizes on P&I alone. The "true monthly
  // payment" (P&I + escrow + PMI) is derived for display and the commitments
  // total; see getMonthlyPaymentBreakdown.
  MonthlyPayment?: number;
  // "True monthly payment" components (Phase 8.3), all optional so a plain loan
  // is unaffected (absent = $0, true payment == P&I).
  //
  // HomeValue is the property's value at origination — the basis for loan-to-
  // value (LTV = CurrentAmount / HomeValue) and therefore for PMI drop-off. Per
  // the federal Homeowners Protection Act, automatic PMI termination is tied to
  // the original value, not the current (appreciating) one, so this lives on the
  // loan rather than reading a linked property's drifting balance.
  HomeValue?: number;
  PropertyTaxAnnual?: number;
  HomeInsuranceAnnual?: number;
  // Monthly private mortgage insurance premium, charged only while LTV > 80% and
  // dropped to $0 at or below 80% (getMonthlyPaymentBreakdown / getPmiEndDate).
  MonthlyPmi?: number;
}

export const emptyLoan: Loan = {
  Id: '',
  Provider: '',
  Name: '',
  InterestRate: 0,
  StartDate: new Date(),
  EndDate: new Date(),
  Principal: 0,
  CurrentAmount: 0,
  MonthlyPayment: 0,
};

export type PitLoan = {
  PaidTerms: number;
  RemainingTerms: number;
  RemainingPrincipal: number;
  PaidPrincipal: number;
  PaidInterest: number;
};

export const defaultPit: PitLoan = {
  RemainingPrincipal: 0,
  PaidPrincipal: 0,
  RemainingTerms: 0,
  PaidTerms: 0,
  PaidInterest: 0,
};

export type AmortizationScheduleEntry = {
  Term: number;
  PrincipalPayment: number;
  InterestPayment: number;
  RemainingBalance: number;
};
