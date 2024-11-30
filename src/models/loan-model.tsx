
export interface Loan {
  Provider: string | null | undefined;
  Name: string;
  InterestRate: number;
  StartDate: Date;
  EndDate: Date;
  Principal: number;
  CurrentAmount: number;
  MonthlyPayment?: number;
  // TODO
  // add actual monthly payment (taxes, insurance, etc)
}

export const emptyLoan: Loan = {
  Provider: "",
  Name: "",
  InterestRate: 0,
  StartDate: new Date(),
  EndDate: new Date(),
  Principal: 0,
  CurrentAmount: 0,
  MonthlyPayment: 0
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
  PaidInterest: 0
};


export type AmortizationScheduleEntry = {
  Term: number;
  PrincipalPayment: number;
  InterestPayment: number;
  RemainingBalance: number;
}