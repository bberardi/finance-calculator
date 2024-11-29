
export interface Loan {
    Provider: string | null | undefined;
    Name: string;
    InterestRate: number;
    StartDate: Date;
    EndDate: Date;
    Principal: number;
    CurrentAmount: number;
    MonthlyPayment?: number;
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
    RemainingPrincipal: number,
    PaidPrincipal: number,
    RemainingTerms: number,
    PaidTerms: number
}


export const defaultPit: PitLoan = {
  RemainingPrincipal: 0,
  PaidPrincipal: 0,
  RemainingTerms: 0,
  PaidTerms: 0,
};
