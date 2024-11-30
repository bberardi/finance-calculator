import { TableContainer, Table, TableHead, TableRow, TableCell, TableBody, Button, Paper } from "@mui/material";
import { Loan } from "../models/loan-model"
import { useState } from "react";
import { PitPopout } from "./pit-popout";
import { getTerms } from "../helpers/loan-helpers";
import { Delete, Calculate, CalendarMonth } from '@mui/icons-material';
import { AmortizationPopout } from "./amortization-popout";

export const LoanTable = (props: LoanTableProps) => {
  const [selectedPit, setSelectedPit] = useState<Loan | undefined>();
  const [selectedAmortization, setSelectedAmortization] = useState<Loan | undefined>();

    return (
      <>
        {selectedPit && (
          <PitPopout
            loan={selectedPit}
            onClose={() => setSelectedPit(undefined)}
          />
        )}
        {selectedAmortization && (
          <AmortizationPopout
            loan={selectedAmortization}
            onClose={() => setSelectedAmortization(undefined)}
          />
        )}
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Provider</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Interest Rate</TableCell>
                <TableCell>Principal</TableCell>
                <TableCell>Current Amount</TableCell>
                <TableCell>Monthly Payment</TableCell>
                <TableCell>Start Date</TableCell>
                <TableCell>End Date</TableCell>
                <TableCell>Terms</TableCell>
                <TableCell>Amortization Schedule</TableCell>
                <TableCell>PIT Calc.</TableCell>
                <TableCell>Delete</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {props.loans.map((row) => (
                <TableRow key={row.Name}>
                  <TableCell>{row.Provider}</TableCell>
                  <TableCell>{row.Name}</TableCell>
                  <TableCell>
                    {(row.InterestRate / 100).toLocaleString(undefined, {
                      style: "percent",
                      minimumFractionDigits: 3,
                      maximumFractionDigits: 3,
                    })}
                  </TableCell>
                  <TableCell>
                    {row.Principal.toLocaleString(undefined, {
                      style: "currency",
                      currency: "USD",
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </TableCell>
                  <TableCell>
                    {row.CurrentAmount.toLocaleString(undefined, {
                      style: "currency",
                      currency: "USD",
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </TableCell>
                  <TableCell>
                    {row.MonthlyPayment?.toLocaleString(undefined, {
                      style: "currency",
                      currency: "USD",
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </TableCell>
                  <TableCell>{row.StartDate.toLocaleDateString()}</TableCell>
                  <TableCell>{row.EndDate.toLocaleDateString()}</TableCell>
                  <TableCell>{getTerms(row)}</TableCell>
                  <TableCell>
                    <Button onClick={() => setSelectedAmortization(row)}>
                      <CalendarMonth />
                    </Button>
                  </TableCell>
                  <TableCell>
                    <Button onClick={() => setSelectedPit(row)}>
                      <Calculate />
                    </Button>
                  </TableCell>
                  <TableCell>
                    <Button onClick={() => props.removeLoan(row)}>
                      <Delete />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </>
    );

}

export type LoanTableProps = {
    loans: Loan[],
    removeLoan: (loan: Loan) => void,
}