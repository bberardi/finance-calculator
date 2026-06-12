import {
  AppBar,
  Button,
  Container,
  Divider,
  Paper,
  Toolbar,
  Typography,
  Switch,
  FormControlLabel,
} from '@mui/material';
import { useState } from 'react';
import { AddEditLoan } from './loan/add-edit-loan';
import { Loan } from './models/loan-model';
import { LoanTable } from './loan/loan-table';
import { AddEditInvestment } from './investment/add-edit-investment';
import { CompoundingFrequency, Investment } from './models/investment-model';
import { InvestmentTable } from './investment/investment-table';
import { DataManager } from './data-manager/data-manager';
import { useFinanceData } from './state/use-finance-data';

// Fake data for the dev "Test Data" toggle. Lives here as a UI seed, not as
// state — the provider stashes the user's real data when this is loaded.
const fakeLoans: Loan[] = [
  {
    Id: '00000000-0000-0000-0000-000000000001',
    Name: 'Test Loan 1',
    Provider: 'Fake Provider',
    InterestRate: 5,
    Principal: 300000,
    CurrentAmount: 300000,
    MonthlyPayment: 1610.46,
    StartDate: new Date('2024-11-02'),
    EndDate: new Date('2054-10-02'),
  },
  {
    Id: '00000000-0000-0000-0000-000000000002',
    Name: 'Test Loan 2',
    Provider: 'Sample Bank',
    InterestRate: 3.5,
    Principal: 150000,
    CurrentAmount: 120000,
    MonthlyPayment: 900.12,
    StartDate: new Date('2022-01-01'),
    EndDate: new Date('2042-01-01'),
  },
];

const fakeInvestments: Investment[] = [
  {
    Id: '00000000-0000-0000-0000-000000000003',
    Name: 'Test Investment 1',
    Provider: 'Fake Investment Co.',
    StartingBalance: 10000,
    CurrentValue: 12500,
    AverageReturnRate: 5.5,
    CompoundingPeriod: CompoundingFrequency.Annually,
    StartDate: new Date('2020-01-01'),
  },
  {
    Id: '00000000-0000-0000-0000-000000000004',
    Name: 'Test Investment 2',
    Provider: 'Sample Fund',
    StartingBalance: 5000,
    AverageReturnRate: 2.1,
    CompoundingPeriod: CompoundingFrequency.Monthly,
    StartDate: new Date('2021-06-15'),
    RecurringContribution: 50,
    ContributionFrequency: CompoundingFrequency.Monthly,
  },
];

export const Body = () => {
  const {
    state: { loans, investments, testDataEnabled },
    addLoan,
    updateLoan,
    deleteLoan,
    addInvestment,
    updateInvestment,
    deleteInvestment,
    enableTestData,
    disableTestData,
  } = useFinanceData();

  // Local UI state only: dialog open/closed and which entity is being edited.
  const [isAddLoanOpen, setIsAddLoanOpen] = useState<boolean>(false);
  const [isAddInvestmentOpen, setIsAddInvestmentOpen] =
    useState<boolean>(false);
  const [editLoan, setEditLoan] = useState<Loan>();
  const [editInvestment, setEditInvestment] = useState<Investment>();

  const handleToggleTestData = () => {
    if (!testDataEnabled) {
      enableTestData(fakeLoans, fakeInvestments);
    } else {
      disableTestData();
    }
  };

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
      addLoan(newLoan);
    } else {
      updateLoan(newLoan);
    }
  };

  const onLoanDelete = (loan: Loan) => {
    deleteLoan(loan.Id);
  };

  const onInvestmentAddEdit = (investment?: Investment) => {
    setEditInvestment(investment);
    setIsAddInvestmentOpen(true);
  };

  const onInvestmentAddEditClose = () => {
    setIsAddInvestmentOpen(false);
    setEditInvestment(undefined);
  };

  const onInvestmentAddEditSave = (
    newInvestment: Investment,
    oldInvestment?: Investment
  ) => {
    if (!oldInvestment) {
      addInvestment(newInvestment);
    } else {
      updateInvestment(newInvestment);
    }
  };

  const onInvestmentDelete = (investment: Investment) => {
    deleteInvestment(investment.Id);
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
          <DataManager />
          <div style={{ flex: 1 }} />
          <FormControlLabel
            control={
              <Switch
                checked={testDataEnabled}
                onChange={handleToggleTestData}
                color="secondary"
              />
            }
            label={'Test Data'}
            labelPlacement="start"
            sx={{ margin: '5px' }}
          />
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
          <InvestmentTable
            investments={investments}
            onInvestmentEdit={onInvestmentAddEdit}
          />
        ) : (
          <Typography sx={{ marginTop: '25px', marginBottom: '15px' }}>
            No investments yet, add one from the command bar!
          </Typography>
        )}
      </Paper>

      <AddEditLoan
        open={isAddLoanOpen}
        onSave={onLoanAddEditSave}
        onDelete={onLoanDelete}
        onClose={onLoanAddEditClose}
        loan={editLoan}
      />

      <AddEditInvestment
        open={isAddInvestmentOpen}
        onSave={onInvestmentAddEditSave}
        onDelete={onInvestmentDelete}
        onClose={onInvestmentAddEditClose}
        investment={editInvestment}
      />
    </Container>
  );
};
