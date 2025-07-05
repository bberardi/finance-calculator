import {
  AppBar,
  Button,
  Container,
  Divider,
  Paper,
  Toolbar,
  Typography,
} from '@mui/material';
import { useState, useEffect } from 'react';
import { AddEditLoan } from './loan/add-edit-loan';
import { emptyLoan, Loan } from './models/loan-model';
import { LoanTable } from './loan/loan-table';
import { generateAmortizationSchedule } from './helpers/loan-helpers';
import { AddEditInvestment } from './investment/add-edit-investment';
import { emptyInvestment, Investment } from './models/investment-model';
import { InvestmentTable } from './investment/investment-table';
import { generateInvestmentGrowth } from './helpers/investment-helpers';

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
  const [investments, setInvestments] = useState<Investment[]>([]);

  // Debug effect to track investments state changes
  useEffect(() => {
    console.log('Investments state changed:', investments);
  }, [investments]);
  const [isAddLoanOpen, setIsAddLoanOpen] = useState<boolean>(false);
  const [isAddInvestmentOpen, setIsAddInvestmentOpen] = useState<boolean>(false);
  const [editLoan, setEditLoan] = useState<Loan>();
  const [editInvestment, setEditInvestment] = useState<Investment>();

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

  const onInvestmentAddEdit = (investment?: Investment) => {
    setEditInvestment(investment);
    setIsAddInvestmentOpen(true);
  };

  const onInvestmentAddEditClose = () => {
    setIsAddInvestmentOpen(false);
    setEditInvestment(undefined);
  };

  const onInvestmentAddEditSave = (newInvestment: Investment, oldInvestment?: Investment) => {
    console.log('onInvestmentAddEditSave called:', { newInvestment, oldInvestment });
    
    try {
      const projectedGrowth = generateInvestmentGrowth(newInvestment);
      console.log('projectedGrowth:', projectedGrowth);
      
      const updatedInvestment: Investment = {
        ...newInvestment,
        ProjectedGrowth: projectedGrowth,
      };
      
      console.log('updatedInvestment:', updatedInvestment);

      if (!oldInvestment) {
        console.log('Adding new investment to list, current investments:', investments);
        const newInvestments = [...investments, updatedInvestment];
        console.log('newInvestments array:', newInvestments);
        setInvestments(newInvestments);
      } else {
        const filteredInvestments = investments.filter((i) => i != oldInvestment);

        if (newInvestment !== emptyInvestment) {
          setInvestments([...filteredInvestments, updatedInvestment]);
        } else {
          setInvestments(filteredInvestments);
        }
      }
    } catch (error) {
      console.error('Error in onInvestmentAddEditSave:', error);
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
          <Button
            variant="outlined"
            color="inherit"
            sx={{ margin: '5px' }}
            onClick={() => onInvestmentAddEdit()}
          >
            Add Investment
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

      <Paper sx={{ marginBottom: '20px', padding: '5px' }}>
        <Divider>Investments</Divider>
        {investments.length > 0 ? (
          <InvestmentTable investments={investments} onInvestmentEdit={onInvestmentAddEdit} />
        ) : (
          <Typography sx={{ marginTop: '25px', marginBottom: '15px' }}>
            No investments yet, add one from the command bar!
          </Typography>
        )}
      </Paper>

      <AddEditLoan
        open={isAddLoanOpen}
        onSave={onLoanAddEditSave}
        onClose={onLoanAddEditClose}
        loan={editLoan}
      />

      <AddEditInvestment
        open={isAddInvestmentOpen}
        onSave={onInvestmentAddEditSave}
        onClose={onInvestmentAddEditClose}
        investment={editInvestment}
      />
    </Container>
  );
};
