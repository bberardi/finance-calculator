import {
  Alert,
  AppBar,
  Button,
  Container,
  Divider,
  Paper,
  Snackbar,
  Toolbar,
} from '@mui/material';
import { useState } from 'react';
import { AddEditLoan } from './loan/add-edit-loan';
import { Loan } from './models/loan-model';
import { LoanTable } from './loan/loan-table';
import { AddEditInvestment } from './investment/add-edit-investment';
import { Investment } from './models/investment-model';
import { InvestmentTable } from './investment/investment-table';
import { DataManager } from './data-manager/data-manager';
import { useFinanceData } from './state/use-finance-data';
import { ColorModeToggle, SECTION_GAP, PAPER_PADDING } from './theme';
import { ConfirmDeleteDialog } from './components/confirm-delete-dialog';
import {
  OnboardingEmptyState,
  SectionEmptyState,
} from './components/empty-state';
import { sampleLoans, sampleInvestments } from './state/sample-data';

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

export const Body = () => {
  const {
    state: { loans, investments, sampleDataLoaded },
    addLoan,
    updateLoan,
    deleteLoan,
    insertLoanAt,
    addInvestment,
    updateInvestment,
    deleteInvestment,
    insertInvestmentAt,
    loadSampleData,
    clearSampleData,
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

  const onLoadSampleData = () => loadSampleData(sampleLoans, sampleInvestments);

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
  const bothEmpty = loans.length === 0 && investments.length === 0;

  return (
    <Container>
      <AppBar>
        {/* Command bar (roadmap 0.10): the two "Add" actions are the primary
            actions — `contained color="inherit"` renders them as solid light
            buttons that contrast against the brand-blue pill in both light and
            dark mode. DataManager's import/export are secondary (text variant
            with icons + tooltips). The dark-mode toggle is pushed to the right
            with `marginLeft: 'auto'`; on narrow viewports the Toolbar wraps
            cleanly (theme `MuiToolbar` flexWrap/gap). */}
        <Toolbar>
          <Button
            variant="contained"
            color="inherit"
            onClick={() => onLoanAddEdit()}
          >
            Add Loan
          </Button>
          <Button
            variant="contained"
            color="inherit"
            onClick={() => onInvestmentAddEdit()}
          >
            Add Investment
          </Button>
          <DataManager />
          <ColorModeToggle />
        </Toolbar>
      </AppBar>

      {/* Sample-data indicator (roadmap 0.9): while samples are loaded, keep a
          one-click "Clear sample data" right above the tables, where the user
          is already looking. The reducer restores any stashed real data. */}
      {sampleDataLoaded && (
        <Alert
          severity="info"
          sx={{ marginBottom: SECTION_GAP }}
          action={
            <Button color="inherit" size="small" onClick={clearSampleData}>
              Clear sample data
            </Button>
          }
        >
          Showing sample data
        </Alert>
      )}

      {bothEmpty ? (
        <Paper sx={{ marginBottom: SECTION_GAP, padding: PAPER_PADDING }}>
          <OnboardingEmptyState
            onAddLoan={() => onLoanAddEdit()}
            onAddInvestment={() => onInvestmentAddEdit()}
            onLoadSampleData={onLoadSampleData}
          />
        </Paper>
      ) : (
        <>
          <Paper sx={{ marginBottom: SECTION_GAP, padding: PAPER_PADDING }}>
            <Divider>Loans</Divider>
            {loans.length > 0 ? (
              <LoanTable
                loans={loans}
                onLoanEdit={onLoanAddEdit}
                onLoanDelete={onLoanDelete}
              />
            ) : (
              <SectionEmptyState
                message="No loans yet."
                actionLabel="Add your first loan"
                onAction={() => onLoanAddEdit()}
              />
            )}
          </Paper>

          <Paper sx={{ marginBottom: SECTION_GAP, padding: PAPER_PADDING }}>
            <Divider>Investments</Divider>
            {investments.length > 0 ? (
              <InvestmentTable
                investments={investments}
                onInvestmentEdit={onInvestmentAddEdit}
                onInvestmentDelete={onInvestmentDelete}
              />
            ) : (
              <SectionEmptyState
                message="No investments yet."
                actionLabel="Add your first investment"
                onAction={() => onInvestmentAddEdit()}
              />
            )}
          </Paper>
        </>
      )}

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
