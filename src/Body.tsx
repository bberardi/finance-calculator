// import { useState } from "react";

import { AppBar, Button, Container, Grid, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Toolbar, Typography } from "@mui/material";
import { useState } from "react";
// import { Loan } from "./loan/loan-model";
import { AddLoan } from "./loan/add-loan";
import { Loan } from "./loan/loan-model";

export const Body = () => {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [isAddLoanOpen, setIsAddLoanOpen] = useState<boolean>(false);

  // interface DataRow {
  //   id: number;
  //   name: string;
  //   value: number;
  // }

  // const sampleData: DataRow[] = [
  //   { id: 1, name: "Item 1", value: 10 },
  //   { id: 2, name: "Item 2", value: 20 },
  //   { id: 3, name: "Item 3", value: 30 },
  // ];
  
  const onAddLoan = () => {
    setIsAddLoanOpen(true);
  };

  const removeLoan = (loan: Loan) => {
    setLoans(loans.filter(l => l !== loan));
  }

  return (
    <Container>
      <AppBar
        position="static"
        sx={{
          borderRadius: "30px",
          marginTop: "15px",
          marginBottom: "15px",
          overflow: "hidden",
        }}
      >
        <Toolbar>
          <Button
            variant="outlined"
            color="inherit"
            style={{ margin: "5px" }}
            onClick={() => onAddLoan()}
          >
            Add Loan
          </Button>
        </Toolbar>
      </AppBar>

      <AddLoan
        open={isAddLoanOpen}
        onSave={(newLoan: Loan) => setLoans([...loans, newLoan])}
        onClose={() => {
          setIsAddLoanOpen(false);
        }}
      />

      <Grid container spacing={2} sx={{}}>
        <Grid item xs={12}>
          <Paper>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Initial Ammount</TableCell>
                    <TableCell>Current Amount</TableCell>
                    <TableCell>Interest Rate</TableCell>
                    <TableCell>Start Date</TableCell>
                    <TableCell>End Date</TableCell>
                    <TableCell>Provider</TableCell>
                    <TableCell>Delete</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loans.map((row) => (
                    <TableRow key={row.Name}>
                      <TableCell>{row.Name}</TableCell>
                      <TableCell>{row.InitialAmount}</TableCell>
                      <TableCell>{row.CurrentAmount}</TableCell>
                      <TableCell>{row.InterestRate}</TableCell>
                      <TableCell>{row.StartDate.toLocaleDateString()}</TableCell>
                      <TableCell>{row.EndDate.toLocaleDateString()}</TableCell>
                      <TableCell>{row.Provider}</TableCell>
                      <TableCell>
                        <Button onClick={() => removeLoan(row)}>Remove
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>
        <Grid item xs={12}>
          {/* Placeholder for Graphs */}
          <Paper
            sx={{
              height: 300,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Typography variant="h6">Graph Placeholder</Typography>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};
