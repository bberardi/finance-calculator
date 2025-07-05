import {
  AppBar,
  Button,
  Container,
  Divider,
  Paper,
  Toolbar,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { AddEditLoan } from './loan/add-edit-loan';
import { emptyLoan, Loan } from './models/loan-model';
import { LoanTable } from './loan/loan-table';
import { generateAmortizationSchedule } from './helpers/loan-helpers';

export const Body = () => {
  const [loans, setLoans] = useState<Loan[]>([
    // TODO delete this starter
    // {
    //   Name: 'Test Loan 1',
    //   Provider: 'Fake Provider',
    //   InterestRate: 5,
    //   Principal: 300000,
    //   CurrentAmount: 300000,
    //   MonthlyPayment: 1610.46,
    //   StartDate: new Date('2024-11-02'),
    //   EndDate: new Date('2054-10-02'),
    // },
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
    const updatedLoan: Loan = {
      ...newLoan,
      AmortizationSchedule: generateAmortizationSchedule(newLoan),
    };

    if (!oldLoan) {
      setLoans([...loans, updatedLoan]);
    } else {
      const filteredLoans = loans.filter((l) => l != oldLoan);

      if (newLoan !== emptyLoan) {
        setLoans([...filteredLoans, updatedLoan]);
      } else {
        setLoans(filteredLoans);
      }
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
            sx={{ margin: '5px' }}
            onClick={() => onLoanAddEdit()}
          >
            Add Loan
          </Button>
        </Toolbar>
      </AppBar>

      <Paper sx={{ marginBottom: '20px', padding: '5px' }}>
        <Divider>Loans</Divider>
        {loans.length > 0 ? (
          <LoanTable loans={loans} onLoanEdit={onLoanAddEdit} />
        ) : (
          <Typography sx={{ marginTop: '25px', marginBottom: '15px' }}>
            No loans yet, add one from the command bar!
          </Typography>
        )}
      </Paper>

      <AddEditLoan
        open={isAddLoanOpen}
        onSave={onLoanAddEditSave}
        onClose={onLoanAddEditClose}
        loan={editLoan}
      />
    </Container>
  );
};
