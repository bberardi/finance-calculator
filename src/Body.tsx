import {
  Alert,
  AppBar,
  Button,
  Container,
  Divider,
  Paper,
  Snackbar,
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
import { ColorModeToggle } from './theme';
import { ConfirmDeleteDialog } from './components/confirm-delete-dialog';

// A delete pending confirmation: which kind of entity, and the entity itself
// (we need its name for the prompt).
type PendingDelete =
  | { kind: 'loan'; entity: Loan }
  | { kind: 'investment'; entity: Investment };

// A delete that just happened and can still be undone: the removed entity plus
// the index it occupied, so undo can restore it exactly where it was.
type UndoableDelete =
  | { kind: 'loan'; entity: Loan; index: number }
  | { kind: 'investment'; entity: Investment; index: number };

const DELETE_UNDO_DURATION_MS = 6000;

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
    insertLoanAt,
    addInvestment,
    updateInvestment,
    deleteInvestment,
    insertInvestmentAt,
    enableTestData,
    disableTestData,
  } = useFinanceData();

  // Local UI state only: dialog open/closed and which entity is being edited.
  const [isAddLoanOpen, setIsAddLoanOpen] = useState<boolean>(false);
  const [isAddInvestmentOpen, setIsAddInvestmentOpen] =
    useState<boolean>(false);
  const [editLoan, setEditLoan] = useState<Loan>();
  const [editInvestment, setEditInvestment] = useState<Investment>();

  // Delete confirmation + soft-undo state (roadmap 0.7).
  const [pendingDelete, setPendingDelete] = useState<PendingDelete>();
  const [undoableDelete, setUndoableDelete] = useState<UndoableDelete>();

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

  // Step 1: clicking the row/card trash icon asks for confirmation.
  const onLoanDelete = (loan: Loan) => {
    setPendingDelete({ kind: 'loan', entity: loan });
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

  // Step 1: clicking the row/card trash icon asks for confirmation.
  const onInvestmentDelete = (investment: Investment) => {
    setPendingDelete({ kind: 'investment', entity: investment });
  };

  // Step 2: confirmation accepted — actually delete, remembering the original
  // index so the snackbar can offer an exact-position undo.
  const onConfirmDelete = () => {
    if (!pendingDelete) {
      return;
    }
    if (pendingDelete.kind === 'loan') {
      const index = loans.findIndex((l) => l.Id === pendingDelete.entity.Id);
      deleteLoan(pendingDelete.entity.Id);
      setUndoableDelete({ kind: 'loan', entity: pendingDelete.entity, index });
    } else {
      const index = investments.findIndex(
        (i) => i.Id === pendingDelete.entity.Id
      );
      deleteInvestment(pendingDelete.entity.Id);
      setUndoableDelete({
        kind: 'investment',
        entity: pendingDelete.entity,
        index,
      });
    }
    setPendingDelete(undefined);
  };

  // Step 3 (optional): undo restores the entity at its original index.
  const onUndoDelete = () => {
    if (!undoableDelete) {
      return;
    }
    if (undoableDelete.kind === 'loan') {
      insertLoanAt(undoableDelete.entity, undoableDelete.index);
    } else {
      insertInvestmentAt(undoableDelete.entity, undoableDelete.index);
    }
    setUndoableDelete(undefined);
  };

  const deletedName = undoableDelete?.entity.Name ?? '';

  return (
    <Container>
      <AppBar>
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
          <ColorModeToggle />
        </Toolbar>
      </AppBar>

      <Paper sx={{ marginBottom: '20px', padding: '5px' }}>
        <Divider>Loans</Divider>
        {loans.length > 0 ? (
          <LoanTable
            loans={loans}
            onLoanEdit={onLoanAddEdit}
            onLoanDelete={onLoanDelete}
          />
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
            onInvestmentDelete={onInvestmentDelete}
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

      <ConfirmDeleteDialog
        itemName={pendingDelete?.entity.Name}
        onCancel={() => setPendingDelete(undefined)}
        onConfirm={onConfirmDelete}
      />

      {/* Soft-undo for delete: matches DataManager's snackbar conventions
          (bottom-center, ~6s) but adds an UNDO action that restores the entity
          at its original index. */}
      <Snackbar
        open={!!undoableDelete}
        autoHideDuration={DELETE_UNDO_DURATION_MS}
        onClose={() => setUndoableDelete(undefined)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity="info"
          sx={{ width: '100%' }}
          action={
            <Button color="inherit" size="small" onClick={onUndoDelete}>
              UNDO
            </Button>
          }
        >
          {`Deleted ${deletedName}`}
        </Alert>
      </Snackbar>
    </Container>
  );
};
