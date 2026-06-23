import {
  Alert,
  AppBar,
  Box,
  Button,
  Container,
  Divider,
  Menu,
  MenuItem,
  Paper,
  Skeleton,
  Snackbar,
  Toolbar,
  Typography,
} from '@mui/material';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import { lazy, Suspense, useState } from 'react';
import { Loan } from './models/loan-model';
import { LoanTable } from './loan/loan-table';
import { Investment } from './models/investment-model';
import { InvestmentTable } from './investment/investment-table';
import { Asset, AssetType } from './models/asset-model';
import { AssetTable } from './asset/asset-table';
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
import { DataSnapshot } from './state/finance-reducer';
import { buildLoanSeedFromAsset } from './helpers/convert-helpers';
import { ColorModeToggle, SECTION_GAP, PAPER_PADDING } from './theme';
import { ConfirmDeleteDialog } from './components/confirm-delete-dialog';
import {
  OnboardingEmptyState,
  SectionEmptyState,
} from './components/empty-state';
import { DialogFallback } from './components/dialog-fallback';
import {
  sampleLoans,
  sampleInvestments,
  sampleAssets,
} from './state/sample-data';

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
const AddEditAsset = lazy(() =>
  import('./asset/add-edit-asset').then((m) => ({ default: m.AddEditAsset }))
);

// A delete pending confirmation: which kind of entity, and the entity itself
// (we need its name for the prompt).
type PendingDelete =
  | { kind: 'loan'; entity: Loan }
  | { kind: 'investment'; entity: Investment }
  | { kind: 'asset'; entity: Asset };

// A delete that just happened and can still be undone: the removed entity plus
// the index it occupied, so undo can restore it exactly where it was.
type UndoableDelete =
  | { kind: 'loan'; entity: Loan; index: number }
  | { kind: 'investment'; entity: Investment; index: number }
  | { kind: 'asset'; entity: Asset; index: number };

// A bulk delete pending confirmation: which kind, and the selected entities.
type PendingBulkDelete =
  | { kind: 'loan'; entities: Loan[] }
  | { kind: 'investment'; entities: Investment[] }
  | { kind: 'asset'; entities: Asset[] };

// A committed bulk delete that can still be undone: the pre-delete data
// snapshot (restored wholesale) plus the snackbar message.
interface BulkUndo {
  snapshot: DataSnapshot;
  message: string;
}

const DELETE_UNDO_DURATION_MS = 6000;
// A bulk delete removes many rows at once, so give the undo a little longer.
const BULK_DELETE_UNDO_DURATION_MS = 8000;

// The non-liability asset types: the group the "Add Asset" entry point offers in
// the in-dialog type selector.
const ASSET_TYPE_GROUP: AssetType[] = [
  AssetType.Cash,
  AssetType.Property,
  AssetType.CustomAsset,
];

// Every asset type. Editing an existing holding offers the full set so it can be
// retyped freely — including flipping an asset to a liability or back (e.g. a
// credit card that imported as an asset). Add flows stay in their entry-point
// group; conversion to a Loan (mortgage) is a separate row action.
const ALL_ASSET_TYPES: AssetType[] = [
  AssetType.Cash,
  AssetType.Property,
  AssetType.CustomAsset,
  AssetType.CustomLiability,
];

// Command-bar primary actions: two menu buttons, "Add Asset" (Investment / Cash
// / Property / Custom asset) and "Add Liability" (Loan / Custom liability) —
// solid white buttons with deep brand-green text. Styled explicitly rather than via
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
      assets,
      sampleDataLoaded,
      stashedLoans,
      stashedInvestments,
      stashedAssets,
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
    addAsset,
    updateAsset,
    deleteAsset,
    insertAssetAt,
    restoreData,
    loadSampleData,
    clearSampleData,
  } = useFinanceData();

  // Local UI state only: dialog open/closed and which entity is being edited.
  const [isAddLoanOpen, setIsAddLoanOpen] = useState<boolean>(false);
  const [isAddInvestmentOpen, setIsAddInvestmentOpen] =
    useState<boolean>(false);
  const [isAddAssetOpen, setIsAddAssetOpen] = useState<boolean>(false);
  const [editLoan, setEditLoan] = useState<Loan>();
  const [editInvestment, setEditInvestment] = useState<Investment>();
  const [editAsset, setEditAsset] = useState<Asset>();
  // Cross-model conversion (custom liability → loan): the loan form opens in
  // add-mode seeded from the asset; on save we add the loan and remove the
  // original asset. `convertFromAssetId` marks the in-flight conversion.
  const [convertSeedLoan, setConvertSeedLoan] = useState<Loan>();
  const [convertFromAssetId, setConvertFromAssetId] = useState<string>();
  // Which AssetType options the asset/liability dialog offers, and the type a new
  // entity seeds with — set by the entry point that opened it.
  const [assetAllowedTypes, setAssetAllowedTypes] =
    useState<AssetType[]>(ASSET_TYPE_GROUP);
  const [assetInitialType, setAssetInitialType] = useState<AssetType>();

  // Anchors for the two command-bar (and onboarding) "Add" type menus.
  const [assetMenuAnchor, setAssetMenuAnchor] = useState<null | HTMLElement>(
    null
  );
  const [liabilityMenuAnchor, setLiabilityMenuAnchor] =
    useState<null | HTMLElement>(null);

  // Delete confirmation + soft-undo state (roadmap 0.7).
  const [pendingDelete, setPendingDelete] = useState<PendingDelete>();
  const [undoableDelete, setUndoableDelete] = useState<UndoableDelete>();

  // Bulk delete confirmation + soft-undo state (roadmap 6.4).
  const [pendingBulkDelete, setPendingBulkDelete] =
    useState<PendingBulkDelete>();
  const [bulkUndo, setBulkUndo] = useState<BulkUndo>();

  const onLoadSampleData = () =>
    loadSampleData(sampleLoans, sampleInvestments, sampleAssets);

  const onLoanAddEdit = (loan?: Loan) => {
    setEditLoan(loan);
    setIsAddLoanOpen(true);
  };

  const onLoanAddEditClose = () => {
    setIsAddLoanOpen(false);
    setEditLoan(undefined);
    setConvertSeedLoan(undefined);
    setConvertFromAssetId(undefined);
  };

  const onLoanAddEditSave = (newLoan: Loan, oldLoan?: Loan) => {
    if (!oldLoan) {
      addLoan(newLoan);
      // Converting a custom liability into a loan: the loan now exists, so drop
      // the original asset. Only runs for the conversion flow (id set).
      if (convertFromAssetId) {
        deleteAsset(convertFromAssetId);
      }
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

  // Edit an existing asset/liability from its table row. Editing offers every
  // asset type so a holding can be retyped freely — including flipping an asset
  // to a liability or back (e.g. a credit card that imported as an asset). The
  // empty-state "add your first asset" path (no entity) stays in the asset group.
  const onAssetAddEdit = (asset?: Asset) => {
    setEditAsset(asset);
    setAssetInitialType(undefined);
    setAssetAllowedTypes(asset ? ALL_ASSET_TYPES : ASSET_TYPE_GROUP);
    setIsAddAssetOpen(true);
  };

  // Convert a custom liability into a Loan (mortgage). Opens the loan form in
  // add-mode seeded from the asset; onLoanAddEditSave removes the asset once the
  // loan is saved (cancelling leaves the asset untouched).
  const onAssetConvertToLoan = (asset: Asset) => {
    setEditLoan(undefined);
    setConvertSeedLoan(buildLoanSeedFromAsset(asset));
    setConvertFromAssetId(asset.Id);
    setIsAddLoanOpen(true);
  };

  // Add a new asset/liability of a chosen type (from a command-bar/onboarding
  // menu). `allowedTypes` keeps the in-dialog selector to the right group.
  const openAddAsset = (initialType: AssetType, allowedTypes: AssetType[]) => {
    setEditAsset(undefined);
    setAssetInitialType(initialType);
    setAssetAllowedTypes(allowedTypes);
    setIsAddAssetOpen(true);
  };

  // "Add Asset" menu: an investment opens its own rich form; the simple holdings
  // open the shared asset form on the picked type.
  const onAddAssetType = (type: 'investment' | AssetType) => {
    setAssetMenuAnchor(null);
    if (type === 'investment') {
      onInvestmentAddEdit();
    } else {
      openAddAsset(type, ASSET_TYPE_GROUP);
    }
  };

  // "Add Liability" menu: a loan opens its own form; a custom liability opens the
  // shared asset form locked to the liability type.
  const onAddLiabilityType = (type: 'loan' | AssetType) => {
    setLiabilityMenuAnchor(null);
    if (type === 'loan') {
      onLoanAddEdit();
    } else {
      openAddAsset(AssetType.CustomLiability, [AssetType.CustomLiability]);
    }
  };

  const onAssetAddEditClose = () => {
    setIsAddAssetOpen(false);
    setEditAsset(undefined);
  };

  const onAssetAddEditSave = (newAsset: Asset, oldAsset?: Asset) => {
    if (!oldAsset) {
      addAsset(newAsset);
    } else {
      updateAsset(newAsset);
    }
  };

  const onAssetDelete = (asset: Asset) => {
    setPendingDelete({ kind: 'asset', entity: asset });
  };

  const onAssetClone = (asset: Asset) =>
    addAsset({ ...asset, Id: '', Name: `${asset.Name} (copy)` });

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
    } else if (pendingDelete.kind === 'investment') {
      const index = investments.findIndex(
        (i) => i.Id === pendingDelete.entity.Id
      );
      deleteInvestment(pendingDelete.entity.Id);
      setUndoableDelete({
        kind: 'investment',
        entity: pendingDelete.entity,
        index,
      });
    } else {
      const index = assets.findIndex((a) => a.Id === pendingDelete.entity.Id);
      deleteAsset(pendingDelete.entity.Id);
      setUndoableDelete({
        kind: 'asset',
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
    } else if (undoableDelete.kind === 'investment') {
      insertInvestmentAt(undoableDelete.entity, undoableDelete.index);
    } else {
      insertAssetAt(undoableDelete.entity, undoableDelete.index);
    }
    setUndoableDelete(undefined);
  };

  // Bulk delete (roadmap 6.4). The tables hand up the selected entities; Body
  // owns the confirm + soft-undo, reusing the snapshot/restore mechanism from
  // the import undo (6.3) so a whole multi-row delete reverts in one step.
  const onLoanBulkDelete = (selected: Loan[]) => {
    if (selected.length > 0) {
      setPendingBulkDelete({ kind: 'loan', entities: selected });
    }
  };

  const onInvestmentBulkDelete = (selected: Investment[]) => {
    if (selected.length > 0) {
      setPendingBulkDelete({ kind: 'investment', entities: selected });
    }
  };

  const onAssetBulkDelete = (selected: Asset[]) => {
    if (selected.length > 0) {
      setPendingBulkDelete({ kind: 'asset', entities: selected });
    }
  };

  const bulkDeleteCount = pendingBulkDelete?.entities.length ?? 0;
  const bulkDeleteNoun = pendingBulkDelete?.kind ?? 'loan';
  const pluralize = (count: number, noun: string) =>
    `${count} ${noun}${count === 1 ? '' : 's'}`;

  const onConfirmBulkDelete = () => {
    if (!pendingBulkDelete) {
      return;
    }
    // Snapshot the restorable data before deleting, so undo restores it whole.
    const snapshot: DataSnapshot = {
      loans,
      investments,
      assets,
      scenarios,
      stashedLoans,
      stashedInvestments,
      stashedAssets,
    };
    if (pendingBulkDelete.kind === 'loan') {
      pendingBulkDelete.entities.forEach((loan) => deleteLoan(loan.Id));
    } else if (pendingBulkDelete.kind === 'investment') {
      pendingBulkDelete.entities.forEach((inv) => deleteInvestment(inv.Id));
    } else {
      pendingBulkDelete.entities.forEach((asset) => deleteAsset(asset.Id));
    }
    setBulkUndo({
      snapshot,
      message: `Deleted ${pluralize(
        pendingBulkDelete.entities.length,
        pendingBulkDelete.kind
      )}`,
    });
    setPendingBulkDelete(undefined);
  };

  const onUndoBulkDelete = () => {
    if (!bulkUndo) {
      return;
    }
    restoreData(bulkUndo.snapshot);
    setBulkUndo(undefined);
  };

  const deletedName = undoableDelete?.entity.Name ?? '';
  // Split assets for display: custom liabilities live in the Liabilities section
  // (next to loans); everything else is a true asset. They remain one collection
  // in state — this is purely a presentation split.
  const liabilityAssets = assets.filter(
    (a) => a.AssetType === AssetType.CustomLiability
  );
  const assetHoldings = assets.filter(
    (a) => a.AssetType !== AssetType.CustomLiability
  );
  const allEmpty =
    loans.length === 0 && investments.length === 0 && assets.length === 0;
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
            endIcon={<ArrowDropDownIcon />}
            aria-haspopup="menu"
            aria-expanded={Boolean(assetMenuAnchor)}
            onClick={(e) => setAssetMenuAnchor(e.currentTarget)}
          >
            Add Asset
          </Button>
          <Button
            variant="contained"
            sx={addActionSx}
            endIcon={<ArrowDropDownIcon />}
            aria-haspopup="menu"
            aria-expanded={Boolean(liabilityMenuAnchor)}
            onClick={(e) => setLiabilityMenuAnchor(e.currentTarget)}
          >
            Add Liability
          </Button>
          <DataManager />
          <PersistenceToggle />
          <ColorModeToggle />
        </Toolbar>
      </AppBar>

      {/* Type selectors for the two "Add" entry points (roadmap 7). The single
          anchor state per menu means the command bar and the onboarding CTAs can
          both open the same menu, anchored to whichever button was clicked. */}
      <Menu
        anchorEl={assetMenuAnchor}
        open={Boolean(assetMenuAnchor)}
        onClose={() => setAssetMenuAnchor(null)}
      >
        <MenuItem onClick={() => onAddAssetType('investment')}>
          Investment
        </MenuItem>
        <MenuItem onClick={() => onAddAssetType(AssetType.Cash)}>
          Cash (HYSA / CD / checking)
        </MenuItem>
        <MenuItem onClick={() => onAddAssetType(AssetType.Property)}>
          Property
        </MenuItem>
        <MenuItem onClick={() => onAddAssetType(AssetType.CustomAsset)}>
          Custom asset
        </MenuItem>
      </Menu>
      <Menu
        anchorEl={liabilityMenuAnchor}
        open={Boolean(liabilityMenuAnchor)}
        onClose={() => setLiabilityMenuAnchor(null)}
      >
        <MenuItem onClick={() => onAddLiabilityType('loan')}>Loan</MenuItem>
        <MenuItem onClick={() => onAddLiabilityType(AssetType.CustomLiability)}>
          Custom liability
        </MenuItem>
      </Menu>

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

      {allEmpty ? (
        <Paper sx={{ marginBottom: SECTION_GAP, padding: PAPER_PADDING }}>
          <OnboardingEmptyState
            onAddAsset={(e) => setAssetMenuAnchor(e.currentTarget)}
            onAddLiability={(e) => setLiabilityMenuAnchor(e.currentTarget)}
            onLoadSampleData={onLoadSampleData}
          />
        </Paper>
      ) : (
        <>
          {/* Net-worth dashboard summary cards (roadmap 3.1): lead the content
              with today's totals — the same anchor the forecast chart starts
              from. Assets (Phase 7) roll into the totals. */}
          <Box sx={{ marginBottom: SECTION_GAP }}>
            <NetWorthSummary
              loans={loans}
              investments={investments}
              assets={assets}
            />
            {/* Milestone callouts (roadmap 3.2): debt-free date + net worth at
                +5y/+10y/+30y, cheap reads off the same engine series. */}
            <Box sx={{ marginTop: 2 }}>
              <MilestoneCallouts
                loans={loans}
                investments={investments}
                assets={assets}
              />
            </Box>
          </Box>

          <Paper sx={{ marginBottom: SECTION_GAP, padding: PAPER_PADDING }}>
            <Divider>Investments</Divider>
            {investments.length > 0 ? (
              <InvestmentTable
                investments={investments}
                onInvestmentEdit={onInvestmentAddEdit}
                onInvestmentDelete={onInvestmentDelete}
                onInvestmentClone={onInvestmentClone}
                onInvestmentBulkDelete={onInvestmentBulkDelete}
              />
            ) : (
              <SectionEmptyState
                message="No investments yet."
                actionLabel="Add your first investment"
                onAction={() => onInvestmentAddEdit()}
              />
            )}
          </Paper>

          {/* Assets section (roadmap 7.1–7.3): cash, property, and custom
              assets that complete the net-worth picture. Custom liabilities are
              shown under Liabilities instead. */}
          <Paper sx={{ marginBottom: SECTION_GAP, padding: PAPER_PADDING }}>
            <Divider>Assets</Divider>
            {assetHoldings.length > 0 ? (
              <AssetTable
                assets={assetHoldings}
                loans={loans}
                onAssetEdit={onAssetAddEdit}
                onAssetDelete={onAssetDelete}
                onAssetClone={onAssetClone}
                onAssetBulkDelete={onAssetBulkDelete}
              />
            ) : (
              <SectionEmptyState
                message="No assets yet."
                actionLabel="Add your first asset"
                onAction={() => onAssetAddEdit()}
              />
            )}
          </Paper>

          {/* Liabilities section: loans and custom liabilities together, matching
              the "Add Liability" entry point. Loans keep their rich table
              (amortization, payoff, PIT); custom liabilities use the shared asset
              table with liability-framed labels. */}
          <Paper sx={{ marginBottom: SECTION_GAP, padding: PAPER_PADDING }}>
            <Divider>Liabilities</Divider>
            {loans.length === 0 && liabilityAssets.length === 0 ? (
              <SectionEmptyState
                message="No liabilities yet."
                actionLabel="Add your first liability"
                onAction={(e) => setLiabilityMenuAnchor(e.currentTarget)}
              />
            ) : (
              <>
                {loans.length > 0 && (
                  <Box>
                    {liabilityAssets.length > 0 && (
                      <Typography
                        variant="subtitle2"
                        color="text.secondary"
                        sx={{ mb: 1 }}
                      >
                        Loans
                      </Typography>
                    )}
                    <LoanTable
                      loans={loans}
                      onLoanEdit={onLoanAddEdit}
                      onLoanDelete={onLoanDelete}
                      onLoanClone={onLoanClone}
                      onLoanBulkDelete={onLoanBulkDelete}
                    />
                  </Box>
                )}
                {liabilityAssets.length > 0 && (
                  <Box sx={{ mt: loans.length > 0 ? 3 : 0 }}>
                    {loans.length > 0 && (
                      <Typography
                        variant="subtitle2"
                        color="text.secondary"
                        sx={{ mb: 1 }}
                      >
                        Other liabilities
                      </Typography>
                    )}
                    <AssetTable
                      assets={liabilityAssets}
                      loans={loans}
                      onAssetEdit={onAssetAddEdit}
                      onAssetDelete={onAssetDelete}
                      onAssetClone={onAssetClone}
                      onAssetBulkDelete={onAssetBulkDelete}
                      onAssetConvertToLoan={onAssetConvertToLoan}
                      showTypeColumn={false}
                      showEquityColumn={false}
                      searchLabel="Search liabilities"
                      itemLabel="liability"
                      itemLabelPlural="liabilities"
                      balanceHeader="Owed"
                    />
                  </Box>
                )}
              </>
            )}
          </Paper>

          {/* Forecast chart (roadmap 2.2): per-loan, per-investment, per-asset,
              and overall net-worth lines from the shared engine. Shown whenever
              there is at least one position (the enclosing branch guarantees
              it). */}
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
                assets={assets}
                scenario={activeScenario}
              />
            </Suspense>
            {/* Scenario impact summary (roadmap 4.4): what the active scenario
                buys vs. baseline — shown only when a scenario is active. */}
            {activeScenario && (
              <ScenarioImpactSummary
                loans={loans}
                investments={investments}
                assets={assets}
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
              <OptimizerPanel
                loans={loans}
                investments={investments}
                assets={assets}
              />
            </Box>
          </Paper>
        </>
      )}

      {/* Mounted only while open so the date-picker chunk (6.6) loads on first
          use rather than at startup. The forms re-initialize from props in a
          mount-run effect, so a fresh mount opens cleanly. */}
      <Suspense fallback={<DialogFallback />}>
        {isAddLoanOpen && (
          <AddEditLoan
            open
            onSave={onLoanAddEditSave}
            onClose={onLoanAddEditClose}
            loan={editLoan}
            initialValues={convertSeedLoan}
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

        {isAddAssetOpen && (
          <AddEditAsset
            open
            onSave={onAssetAddEditSave}
            onClose={onAssetAddEditClose}
            asset={editAsset}
            loans={loans}
            allowedTypes={assetAllowedTypes}
            initialType={assetInitialType}
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

      {/* Bulk delete confirmation (roadmap 6.4): one prompt for the whole
          selection, e.g. "Delete 3 loans?". */}
      <ConfirmDeleteDialog
        itemName={
          pendingBulkDelete
            ? pluralize(bulkDeleteCount, bulkDeleteNoun)
            : undefined
        }
        onCancel={() => setPendingBulkDelete(undefined)}
        onConfirm={onConfirmBulkDelete}
      />

      {/* Soft-undo for a bulk delete: restores the whole pre-delete snapshot. */}
      <Snackbar
        open={!!bulkUndo}
        autoHideDuration={BULK_DELETE_UNDO_DURATION_MS}
        onClose={() => setBulkUndo(undefined)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity="info"
          sx={{ width: '100%' }}
          action={
            <Button color="inherit" size="small" onClick={onUndoBulkDelete}>
              UNDO
            </Button>
          }
        >
          {bulkUndo?.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};
