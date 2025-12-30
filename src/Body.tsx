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
import { emptyLoan, Loan } from './models/loan-model';
import { LoanTable } from './loan/loan-table';
import { generateAmortizationSchedule } from './helpers/loan-helpers';
import { AddEditInvestment } from './investment/add-edit-investment';
import {
  CompoundingFrequency,
  emptyInvestment,
  Investment,
} from './models/investment-model';
import { InvestmentTable } from './investment/investment-table';
import { generateInvestmentGrowth } from './helpers/investment-helpers';
import { generateId } from './helpers/id-helpers';

export const Body = () => {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [testDataEnabled, setTestDataEnabled] = useState<boolean>(false);

  // Fake data for testing
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
      AmortizationSchedule: [],
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
      AmortizationSchedule: [],
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
      ProjectedGrowth: [],
    },
    {
      Id: '00000000-0000-0000-0000-000000000004',
      Name: 'Test Investment 2',
      Provider: 'Sample Fund',
      StartingBalance: 5000,
      AverageReturnRate: 2.1,
      CompoundingPeriod: CompoundingFrequency.Monthly,
      StartDate: new Date('2021-06-15'),
      ProjectedGrowth: [],
      RecurringContribution: 50,
      ContributionFrequency: CompoundingFrequency.Monthly,
    },
  ];

  // Toggle handler for test data
  const handleToggleTestData = () => {
    if (!testDataEnabled) {
      // Add fake data
      setLoans(
        fakeLoans.map((l) => ({
          ...l,
          AmortizationSchedule: generateAmortizationSchedule(l),
        }))
      );
      setInvestments(
        fakeInvestments.map((i) => ({
          ...i,
          ProjectedGrowth: generateInvestmentGrowth(i),
        }))
      );
    } else {
      // Remove all data
      setLoans([]);
      setInvestments([]);
    }
    setTestDataEnabled(!testDataEnabled);
  };
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [isAddLoanOpen, setIsAddLoanOpen] = useState<boolean>(false);
  const [isAddInvestmentOpen, setIsAddInvestmentOpen] =
    useState<boolean>(false);
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
      Id: newLoan.Id || generateId(), // Generate ID if not present (new loan)
      AmortizationSchedule: generateAmortizationSchedule(newLoan),
    };

    if (!oldLoan) {
      setLoans([...loans, updatedLoan]);
    } else {
      const filteredLoans = loans.filter((l) => l.Id !== oldLoan.Id);

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

  const onInvestmentAddEditSave = (
    newInvestment: Investment,
    oldInvestment?: Investment
  ) => {
    const updatedInvestment: Investment = {
      ...newInvestment,
      Id: newInvestment.Id || generateId(), // Generate ID if not present (new investment)
      ProjectedGrowth: generateInvestmentGrowth(newInvestment),
    };

    if (!oldInvestment) {
      setInvestments([...investments, updatedInvestment]);
    } else {
      const filteredInvestments = investments.filter(
        (i) => i.Id !== oldInvestment.Id
      );

      if (newInvestment !== emptyInvestment) {
        setInvestments([...filteredInvestments, updatedInvestment]);
      } else {
        setInvestments(filteredInvestments);
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
          <Button
            variant="outlined"
            color="inherit"
            sx={{ margin: '5px' }}
            onClick={() => onInvestmentAddEdit()}
          >
            Add Investment
          </Button>
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
