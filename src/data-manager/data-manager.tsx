import { Button, Alert, Snackbar, Tooltip } from '@mui/material';
import { useState, useRef } from 'react';
import { importFromJson, previewMerge } from '../helpers/data-helpers';
import { importAssetsFromMonarchBalanceCsvFiles } from '../helpers/monarch-helpers';
import { downloadJsonExport } from './export-download';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DownloadIcon from '@mui/icons-material/Download';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import { useFinanceData } from '../state/use-finance-data';
import { Loan } from '../models/loan-model';
import { Investment } from '../models/investment-model';
import { Asset } from '../models/asset-model';
import { Scenario } from '../models/scenario-model';
import { DataSnapshot } from '../state/finance-reducer';
import {
  ImportPreviewDialog,
  ImportPreviewSection,
} from './import-preview-dialog';
import { MonarchImportDialog } from './monarch-import-dialog';

// A parsed import awaiting confirmation: the entities to merge plus the
// precomputed add/overwrite preview shown to the user.
interface PendingImport {
  loans: Loan[];
  investments: Investment[];
  scenarios: Scenario[];
  assets: Asset[];
  sections: ImportPreviewSection[];
}

// A just-committed import that can still be undone: the pre-merge snapshot to
// restore plus the summary message shown in the snackbar.
interface ImportUndo {
  snapshot: DataSnapshot;
  message: string;
}

const IMPORT_UNDO_DURATION_MS = 8000;

// Read a File's text via FileReader (Promise-wrapped). Used for the multi-file
// Monarch import; the JSON path keeps its single-file FileReader inline.
const readFileAsText = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve((e.target?.result as string) ?? '');
    reader.onerror = () => reject(new Error(`Failed to read "${file.name}".`));
    reader.readAsText(file);
  });

export const DataManager = () => {
  const {
    state: {
      loans,
      investments,
      assets,
      scenarios,
      sampleDataLoaded,
      stashedLoans,
      stashedInvestments,
      stashedAssets,
    },
    importMerge,
    restoreData,
  } = useFinanceData();
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [exportMessage, setExportMessage] = useState<string>('');
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(
    null
  );
  const [importUndo, setImportUndo] = useState<ImportUndo | null>(null);
  // Parsed Monarch accounts awaiting the per-account type picker (null = closed).
  const [monarchAccounts, setMonarchAccounts] = useState<Asset[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const monarchInputRef = useRef<HTMLInputElement>(null);

  // While sample data is displayed, the user's real data is parked in the
  // stash. Import/Export must act on that real data, not the visible samples —
  // otherwise an export dumps sample data and an import (which the reducer
  // routes into the stash) would report stats against the wrong collection. (#83)
  const realLoans = sampleDataLoaded ? (stashedLoans ?? []) : loans;
  const realInvestments = sampleDataLoaded
    ? (stashedInvestments ?? [])
    : investments;
  const realAssets = sampleDataLoaded ? (stashedAssets ?? []) : assets;

  const hasData =
    realLoans.length > 0 || realInvestments.length > 0 || realAssets.length > 0;

  const handleExport = () => {
    try {
      downloadJsonExport(realLoans, realInvestments, scenarios, realAssets);
      setExportMessage('Data exported successfully!');
    } catch (error) {
      // Log full error details for debugging
      console.error('Error exporting data:', error);
      setErrorMessage('Failed to export data. Please try again.');
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type using both extension and MIME type
    const fileName = file.name.toLowerCase();
    const hasJsonExtension = fileName.endsWith('.json');
    // Accept JSON MIME types or empty MIME type (for browser compatibility)
    const isJsonMimeType =
      !file.type || // Some browsers/OS may not set MIME type
      file.type === 'application/json' ||
      file.type === 'text/json' ||
      file.type.startsWith('application/json;');

    if (!hasJsonExtension || !isJsonMimeType) {
      setErrorMessage('Please upload a JSON file (.json)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const {
          loans: importedLoans,
          investments: importedInvestments,
          scenarios: importedScenarios,
          assets: importedAssets,
        } = importFromJson(content);

        // Compute the add-vs-overwrite preview against the *real* data (the
        // merge target), so the user confirms exactly what the subsequent merge
        // will do. The merge itself still runs in the reducer (one source of
        // truth) once confirmed.
        const loanPreview = previewMerge(realLoans, importedLoans);
        const investmentPreview = previewMerge(
          realInvestments,
          importedInvestments
        );
        const scenarioPreview = previewMerge(scenarios, importedScenarios);
        const assetPreview = previewMerge(realAssets, importedAssets);

        setPendingImport({
          loans: importedLoans,
          investments: importedInvestments,
          scenarios: importedScenarios,
          assets: importedAssets,
          sections: [
            { label: 'Loans', ...loanPreview },
            { label: 'Investments', ...investmentPreview },
            { label: 'Assets', ...assetPreview },
            { label: 'Scenarios', ...scenarioPreview },
          ],
        });
      } catch (error) {
        console.error('Error importing data:', error);
        setErrorMessage(
          error instanceof Error ? error.message : 'Failed to import data'
        );
      }
    };

    reader.onerror = () => {
      setErrorMessage('Failed to read file. Please try again.');
    };

    reader.readAsText(file);

    // Reset the input so the same file can be uploaded again
    if (event.target) {
      event.target.value = '';
    }
  };

  const handleMonarchClick = () => {
    monarchInputRef.current?.click();
  };

  // Import Monarch "account balance history" CSV exports (one per account; the
  // input accepts several at once) as assets/liabilities. Parsing yields one
  // account per row; the per-account type picker (MonarchImportDialog) then lets
  // the user promote each from the catch-all custom type before the merge.
  const handleMonarchUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(event.target.files ?? []);
    // Reset the input up front so re-selecting the same file(s) re-triggers it.
    if (event.target) {
      event.target.value = '';
    }
    if (files.length === 0) return;

    const nonCsv = files.find((f) => !f.name.toLowerCase().endsWith('.csv'));
    if (nonCsv) {
      setErrorMessage('Please upload Monarch CSV files (.csv).');
      return;
    }

    try {
      const texts = await Promise.all(files.map(readFileAsText));
      const importedAssets = importAssetsFromMonarchBalanceCsvFiles(
        files.map((file, i) => ({ text: texts[i], name: file.name }))
      );
      setMonarchAccounts(importedAssets);
    } catch (error) {
      console.error('Error importing Monarch data:', error);
      setErrorMessage(
        error instanceof Error ? error.message : 'Failed to import Monarch data'
      );
    }
  };

  // Snapshot → merge → undo. Shared by the JSON confirm and the Monarch confirm
  // so both land an undoable import the same way (one source of truth).
  const commitImportMerge = (
    parts: {
      loans: Loan[];
      investments: Investment[];
      scenarios: Scenario[];
      assets: Asset[];
    },
    added: number,
    overwritten: number
  ) => {
    // Capture the pre-merge data so the import can be undone. These are the raw
    // state fields RestoreData replaces — not the derived `real*` views.
    const snapshot: DataSnapshot = {
      loans,
      investments,
      assets,
      scenarios,
      stashedLoans,
      stashedInvestments,
      stashedAssets,
    };
    importMerge(parts.loans, parts.investments, parts.scenarios, parts.assets);
    setImportUndo({
      snapshot,
      message: `Imported ${added} item${added === 1 ? '' : 's'}${
        overwritten > 0 ? `, overwrote ${overwritten}` : ''
      }.`,
    });
  };

  const handleConfirmImport = () => {
    if (!pendingImport) return;
    const added = pendingImport.sections.reduce(
      (sum, s) => sum + s.added.length,
      0
    );
    const overwritten = pendingImport.sections.reduce(
      (sum, s) => sum + s.overwritten.length,
      0
    );
    commitImportMerge(pendingImport, added, overwritten);
    setPendingImport(null);
  };

  // Confirm a Monarch import with the user's chosen per-account types. Only the
  // assets list is touched; loans/investments/scenarios stay put.
  const handleMonarchConfirm = (typedAssets: Asset[]) => {
    const { added, overwritten } = previewMerge(realAssets, typedAssets);
    commitImportMerge(
      { loans: [], investments: [], scenarios: [], assets: typedAssets },
      added.length,
      overwritten.length
    );
    setMonarchAccounts(null);
  };

  const handleUndoImport = () => {
    if (!importUndo) return;
    restoreData(importUndo.snapshot);
    setImportUndo(null);
  };

  // Add-vs-update counts for the Monarch dialog (by Id, so independent of the
  // types the user picks). Computed against the real (merge-target) assets.
  const monarchPreview = monarchAccounts
    ? previewMerge(realAssets, monarchAccounts)
    : null;

  return (
    <>
      {/* Import/export are secondary actions (roadmap 0.10): de-emphasized as
          `text` buttons with icons + tooltips, so the primary "Add" actions
          lead the command bar. */}
      <Tooltip title="Import data from a JSON file">
        <Button
          variant="text"
          color="inherit"
          onClick={handleUploadClick}
          startIcon={<UploadFileIcon />}
        >
          Upload
        </Button>
      </Tooltip>
      <Tooltip
        title={hasData ? 'Export your data as JSON' : 'No data to export'}
      >
        {/* Span keeps the tooltip working while the button is disabled. */}
        <span>
          <Button
            variant="text"
            color="inherit"
            onClick={handleExport}
            disabled={!hasData}
            startIcon={<DownloadIcon />}
          >
            Export
          </Button>
        </span>
      </Tooltip>
      <Tooltip title="Import assets & liabilities from Monarch account balance CSV exports">
        <Button
          variant="text"
          color="inherit"
          onClick={handleMonarchClick}
          startIcon={<AccountBalanceIcon />}
        >
          Import from Monarch
        </Button>
      </Tooltip>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleFileUpload}
      />
      <input
        ref={monarchInputRef}
        type="file"
        accept=".csv"
        multiple
        style={{ display: 'none' }}
        onChange={handleMonarchUpload}
      />

      {/* Pre-merge "what changed" preview (roadmap 6.3): merges only run after
          the user reviews the add/overwrite list and confirms. */}
      <ImportPreviewDialog
        open={!!pendingImport}
        sections={pendingImport?.sections ?? []}
        onConfirm={handleConfirmImport}
        onCancel={() => setPendingImport(null)}
      />

      {/* Per-account type picker for a Monarch import: promote each account from
          the catch-all custom type to an explicit one before merging. */}
      <MonarchImportDialog
        open={!!monarchAccounts}
        accounts={monarchAccounts ?? []}
        addedCount={monarchPreview?.added.length ?? 0}
        updatedCount={monarchPreview?.overwritten.length ?? 0}
        onConfirm={handleMonarchConfirm}
        onCancel={() => setMonarchAccounts(null)}
      />

      <Snackbar
        open={!!errorMessage}
        autoHideDuration={6000}
        onClose={() => setErrorMessage('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setErrorMessage('')}
          severity="error"
          sx={{ width: '100%' }}
        >
          {errorMessage}
        </Alert>
      </Snackbar>

      <Snackbar
        open={!!exportMessage}
        autoHideDuration={4000}
        onClose={() => setExportMessage('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setExportMessage('')}
          severity="success"
          sx={{ width: '100%' }}
        >
          {exportMessage}
        </Alert>
      </Snackbar>

      {/* Soft-undo for an import merge (roadmap 6.3): mirrors the delete-undo
          snackbar, restoring the pre-merge snapshot. Longer window than a
          delete because a merge can touch many entities at once. */}
      <Snackbar
        open={!!importUndo}
        autoHideDuration={IMPORT_UNDO_DURATION_MS}
        onClose={() => setImportUndo(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity="success"
          sx={{ width: '100%' }}
          action={
            <Button color="inherit" size="small" onClick={handleUndoImport}>
              UNDO
            </Button>
          }
        >
          {importUndo?.message}
        </Alert>
      </Snackbar>
    </>
  );
};
