import {
  AppBar,
  Button,
  Container,
  Paper,
  Toolbar,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { AddEditLoan } from './loan/add-loan';
import { Loan } from './models/loan-model';
import { LoanTable } from './loan/loan-table';

export const Body = () => {
  const [loans, setLoans] = useState<Loan[]>([
    {
      Name: 'Test Loan 1',
      Provider: 'Fake Provider',
      InterestRate: 5,
      Principal: 300000,
      CurrentAmount: 300000,
      MonthlyPayment: 1610.46,
      StartDate: new Date('2024-11-02'),
      EndDate: new Date('2054-10-02'),
    },
  ]);
  const [isAddLoanOpen, setIsAddLoanOpen] = useState<boolean>(false);
  const [editLoan, setEditLoan] = useState<Loan>();

  const onLoanAddEdit = (loan?: Loan) => {
    setEditLoan(loan);
    setIsAddLoanOpen(true);
  };

  const onLoanAddEditClose = () => {
    setIsAddLoanOpen(false);
    setEditLoan(undefined);
  };

  const onLoanAddEditSave = (newLoan: Loan, oldLoan?: Loan) => {
    if (!oldLoan) {
      setLoans([...loans, newLoan]);
    } else {
      setLoans([...loans.filter((l) => l != oldLoan), newLoan]);
    }
  };

  return (
    <Container>
      <AppBar
        position="static"
        sx={{
          borderRadius: '30px',
          marginTop: '15px',
          marginBottom: '15px',
          overflow: 'hidden',
        }}
      >
        <Toolbar>
          <Button
            variant="outlined"
            color="inherit"
            style={{ margin: '5px' }}
            onClick={() => onLoanAddEdit()}
          >
            Add Loan
          </Button>
        </Toolbar>
      </AppBar>

      <AddEditLoan
        open={isAddLoanOpen}
        onSave={onLoanAddEditSave}
        onClose={onLoanAddEditClose}
        loan={editLoan}
      />

      <Paper style={{ marginBottom: '20px', padding: '5px' }}>
        <LoanTable loans={loans} onLoanEdit={onLoanAddEdit} />
      </Paper>

      <Paper
        sx={{
          height: 300,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Typography variant="h6">Graph Placeholder</Typography>
      </Paper>
    </Container>
  );
};
