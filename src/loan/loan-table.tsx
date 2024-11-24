import { TableContainer, Table, TableHead, TableRow, TableCell, TableBody, Button } from "@mui/material";
import { Loan } from "../models/loan-model"
import { useState } from "react";
import { PitPopout } from "./pit-popout";


export const LoanTable = (props: LoanTableProps) => {
  const [selectedPit, setSelectedPit] = useState<Loan | undefined>();

    return (
      <>
        {selectedPit && (
          <PitPopout
            loan={selectedPit}
            onClose={() => setSelectedPit(undefined)}
          />
        )}
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Provider</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Interest Rate</TableCell>
                <TableCell>Initial Amount</TableCell>
                <TableCell>Current Amount</TableCell>
                <TableCell>Start Date</TableCell>
                <TableCell>End Date</TableCell>
                <TableCell>PIT Calc.</TableCell>
                <TableCell>Delete</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {props.loans.map((row) => (
                <TableRow key={row.Name}>
                  <TableCell>{row.Provider}</TableCell>
                  <TableCell>{row.Name}</TableCell>
                  <TableCell>{row.InterestRate}</TableCell>
                  <TableCell>{row.InitialAmount}</TableCell>
                  <TableCell>{row.CurrentAmount}</TableCell>
                  <TableCell>{row.StartDate.toLocaleDateString()}</TableCell>
                  <TableCell>{row.EndDate.toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Button onClick={() => setSelectedPit(row)}>
                      Calculate
                    </Button>
                  </TableCell>
                  <TableCell>
                    <Button onClick={() => props.removeLoan(row)}>
                      Remove
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