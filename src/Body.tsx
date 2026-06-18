import {
  Alert,
  AppBar,
  Box,
  Button,
  Container,
  Divider,
  Paper,
  Skeleton,
  Snackbar,
  Toolbar,
} from '@mui/material';
import { lazy, Suspense, useState } from 'react';
import { Loan } from './models/loan-model';
import { LoanTable } from './loan/loan-table';
import { Investment } from './models/investment-model';
import { InvestmentTable } from './investment/investment-table';
import { DataManager } from './data-manager/data-manager';
import { PersistenceToggle } from './persistence/persistence-toggle';
import { FirstVisitNotice } from './persistence/first-visit-notice';
import { NetWorthSummary } from './dashboard/net-worth-summary';
import { MilestoneCallouts } from './dashboard/milestone-callouts';
import { AssumptionsPanel } from './dashboard/assumptions-panel';
import { ScenarioBar } from './scenario/scenario-bar';
import { ScenarioImpactSummary } from './scenario/scenario-impact-summary';
import { OptimizerPanel } from './optimizer/optimizer-panel';
import { useFinanceData } from './state/use-finance-data';
import { ColorModeToggle, SECTION_GAP, PAPER_PADDING } from './theme';
import { ConfirmDeleteDialog } from './components/confirm-delete-dialog';
import {
  OnboardingEmptyState,
  SectionEmptyState,
} from './components/empty-state';
import { sampleLoans, sampleInvestments } from './state/sample-data';

// Code-split the heaviest, non-critical-path chunks (roadmap 6.6): the forecast
// chart (@mui/x-charts) and the add/edit forms (@mui/x-date-pickers) are kept
// out of the initial bundle. The chart loads once there is data to plot; the
// forms load the first time one is opened (mounted on demand, below).
const ForecastChart = lazy(() =>
  import('./chart/forecast-chart').then((m) => ({ default: m.ForecastChart }))
);
const AddEditLoan = lazy(() =>
  import('./loan/add-edit-loan').then((m) => ({ default: m.AddEditLoan }))
);
const AddEditInvestment = lazy(() =>
  import('./investment/add-edit-investment').then((m) => ({
    default: m.AddEditInvestment,
  }))
);

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

// Command-bar primary actions ("Add Loan" / "Add Investment"): solid white
// buttons with deep brand-green text. Styled explicitly rather than via
// `color="inherit"` — a contained inherit button takes its TEXT color from the
// AppBar (white) but its background from `grey[300]`, rendering white-on-light-
// grey and unreadable in light mode. White surface + green text stays
// high-contrast against the deep-green pill in both color schemes.
const addActionSx = {
  bgcolor: 'common.white',
  color: 'primary.dark',
  '&:hover': { bgcolor: 'grey.200' },
} as const;

export const Body = () => {
  const {
    state: {
      loans,
      investments,
      sampleDataLoaded,
      scenarios,
      activeScenarioId,
    },
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

  // Clone (roadmap 3.3): copy an entity with a fresh Id (addLoan/addInvestment
  // assign one when Id is empty) so refinance/what-if candidates don't need
  // re-typing. Marked "(copy)" so the duplicate is obvious.
  const onLoanClone = (loan: Loan) =>
    addLoan({ ...loan, Id: '', Name: `${loan.Name} (copy)` });

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

  const onInvestmentClone = (investment: Investment) =>
    addInvestment({
      ...investment,
      Id: '',
      Name: `${investment.Name} (copy)`,
    });

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
  const activeScenario = scenarios.find((s) => s.Id === activeScenarioId);

  return (
    <Container>
      <AppBar>
        {/* Command bar (roadmap 0.10): the two "Add" actions are the primary
            actions — solid white buttons with deep brand-green text (see
            `addActionSx`) so they stay readable against the deep-green pill in
            both light and dark mode. DataManager's import/export are secondary
            (text variant with icons + tooltips). The dark-mode toggle is pushed
            to the right with `marginLeft: 'auto'`; on narrow viewports the
            Toolbar wraps cleanly (theme `MuiToolbar` flexWrap/gap). */}
        <Toolbar>
          <Button
            variant="contained"
            sx={addActionSx}
            onClick={() => onLoanAddEdit()}
          >
            Add Loan
          </Button>
          <Button
            variant="contained"
            sx={addActionSx}
            onClick={() => onInvestmentAddEdit()}
          >
            Add Investment
          </Button>
          <DataManager />
          <PersistenceToggle />
          <ColorModeToggle />
        </Toolbar>
      </AppBar>

      {/* First-visit privacy notice (roadmap 1.3): shown once, explains data
          stays on-device and points at the "Save on this device" toggle. */}
      <FirstVisitNotice />

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
          {/* Net-worth dashboard summary cards (roadmap 3.1): lead the content
              with today's totals — the same anchor the forecast chart starts
              from. */}
          <Box sx={{ marginBottom: SECTION_GAP }}>
            <NetWorthSummary loans={loans} investments={investments} />
            {/* Milestone callouts (roadmap 3.2): debt-free date + net worth at
                +5y/+10y/+30y, cheap reads off the same engine series. */}
            <Box sx={{ marginTop: 2 }}>
              <MilestoneCallouts loans={loans} investments={investments} />
            </Box>
          </Box>

          <Paper sx={{ marginBottom: SECTION_GAP, padding: PAPER_PADDING }}>
            <Divider>Loans</Divider>
            {loans.length > 0 ? (
              <LoanTable
                loans={loans}
                onLoanEdit={onLoanAddEdit}
                onLoanDelete={onLoanDelete}
                onLoanClone={onLoanClone}
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
                onInvestmentClone={onInvestmentClone}
              />
            ) : (
              <SectionEmptyState
                message="No investments yet."
                actionLabel="Add your first investment"
                onAction={() => onInvestmentAddEdit()}
              />
            )}
          </Paper>

          {/* Forecast chart (roadmap 2.2): per-loan, per-investment, and overall
              net-worth lines from the shared engine. Shown whenever there is at
              least one position (the enclosing branch already guarantees it). */}
          <Paper sx={{ marginBottom: SECTION_GAP, padding: PAPER_PADDING }}>
            <Divider>Forecast</Divider>
            {/* Scenario controls (roadmap 4.2): create/select/delete what-if
                scenarios; the active one overlays the chart (4.3). */}
            <ScenarioBar />
            <Suspense
              fallback={
                <Skeleton variant="rounded" height={400} sx={{ mt: 1 }} />
              }
            >
              <ForecastChart
                loans={loans}
                investments={investments}
                scenario={activeScenario}
              />
            </Suspense>
            {/* Scenario impact summary (roadmap 4.4): what the active scenario
                buys vs. baseline — shown only when a scenario is active. */}
            {activeScenario && (
              <ScenarioImpactSummary
                loans={loans}
                investments={investments}
                scenario={activeScenario}
              />
            )}
            {/* Stated-assumptions panel (roadmap 3.4): always-available note on
                what the forecast assumes — honest framing for a deterministic
                projection. */}
            <AssumptionsPanel />
          </Paper>

          {/* "Next Dollar" optimizer (roadmap 5.3/5.4): the flagship section —
              given $X extra per month, rank where it does the most good and turn
              any plan into a chart overlay above. */}
          <Paper sx={{ marginBottom: SECTION_GAP, padding: PAPER_PADDING }}>
            <Divider>Where should my next dollar go?</Divider>
            <Box sx={{ marginTop: 2 }}>
              <OptimizerPanel loans={loans} investments={investments} />
            </Box>
          </Paper>
        </>
      )}

      {/* Mounted only while open so the date-picker chunk (6.6) loads on first
          use rather than at startup. The forms re-initialize from props in a
          mount-run effect, so a fresh mount opens cleanly. */}
      <Suspense fallback={null}>
        {isAddLoanOpen && (
          <AddEditLoan
            open
            onSave={onLoanAddEditSave}
            onClose={onLoanAddEditClose}
            loan={editLoan}
          />
        )}

        {isAddInvestmentOpen && (
          <AddEditInvestment
            open
            onSave={onInvestmentAddEditSave}
            onClose={onInvestmentAddEditClose}
            investment={editInvestment}
          />
        )}
      </Suspense>

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
