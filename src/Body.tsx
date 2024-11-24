import { AppBar, Button, Container, Paper, Toolbar, Typography } from "@mui/material";
import { useState } from "react";
import { AddLoan } from "./loan/add-loan";
import { Loan } from "./models/loan-model";
import { LoanTable } from "./loan/loan-table";

export const Body = () => {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [isAddLoanOpen, setIsAddLoanOpen] = useState<boolean>(false);
  
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

      <Paper style={{marginBottom: '20px', padding: '5px'}}>
        <LoanTable
          loans={loans}
          removeLoan={removeLoan}
          />
      </Paper>

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
    </Container>
  );
};
