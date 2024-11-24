
export interface Loan {
    Provider: string | null | undefined;
    Name: string;
    InterestRate: number;
    StartDate: Date;
    EndDate: Date;
    InitialAmount: number;
    CurrentAmount: number;
}