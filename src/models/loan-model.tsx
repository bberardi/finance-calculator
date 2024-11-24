
export interface Loan {
    Provider: string | null | undefined;
    Name: string;
    InterestRate: number;
    StartDate: Date;
    EndDate: Date;
    InitialAmount: number;
    CurrentAmount: number;
}

export const emptyLoan: Loan = {
    Provider: "",
    Name: "",
    InterestRate: 0,
    StartDate: new Date(),
    EndDate: new Date(),
    InitialAmount: 0,
    CurrentAmount: 0,
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
