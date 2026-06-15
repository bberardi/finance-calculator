import { Button, Alert, Snackbar, Tooltip } from '@mui/material';
import { useState, useRef } from 'react';
import { importFromJson, mergeData } from '../helpers/data-helpers';
import { downloadJsonExport } from './export-download';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DownloadIcon from '@mui/icons-material/Download';
import { useFinanceData } from '../state/use-finance-data';

export const DataManager = () => {
  const {
    state: {
      loans,
      investments,
      scenarios,
      sampleDataLoaded,
      stashedLoans,
      stashedInvestments,
    },
    importMerge,
  } = useFinanceData();
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // While sample data is displayed, the user's real data is parked in the
  // stash. Import/Export must act on that real data, not the visible samples —
  // otherwise an export dumps sample data and an import (which the reducer
  // routes into the stash) would report stats against the wrong collection. (#83)
  const realLoans = sampleDataLoaded ? (stashedLoans ?? []) : loans;
  const realInvestments = sampleDataLoaded
    ? (stashedInvestments ?? [])
    : investments;

  const hasData = realLoans.length > 0 || realInvestments.length > 0;

  const handleExport = () => {
    try {
      downloadJsonExport(realLoans, realInvestments, scenarios);
      setSuccessMessage('Data exported successfully!');
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
        } = importFromJson(content);

        // Compute merge statistics for the success message. The actual state
        // update is performed by the reducer's ImportMerge action (which runs
        // the same mergeData merge), keeping merge semantics in one place.
        const { result: loansResult } = mergeData(realLoans, importedLoans);
        const { result: investmentsResult } = mergeData(
          realInvestments,
          importedInvestments
        );

        importMerge(importedLoans, importedInvestments, importedScenarios);

        // Build detailed success message
        const totalLoansProcessed = loansResult.added + loansResult.updated;
        const loanMsg =
          totalLoansProcessed > 0
            ? `${totalLoansProcessed} loans (${loansResult.added} added, ${loansResult.updated} updated)`
            : '0 loans';
        const totalInvestmentsProcessed =
          investmentsResult.added + investmentsResult.updated;
        const investmentMsg =
          totalInvestmentsProcessed > 0
            ? `${totalInvestmentsProcessed} investments (${investmentsResult.added} added, ${investmentsResult.updated} updated)`
            : '0 investments';

        setSuccessMessage(
          `Data imported successfully! ${loanMsg} and ${investmentMsg} processed.`
        );
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

  const handleCloseSnackbar = () => {
    setErrorMessage('');
    setSuccessMessage('');
  };

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
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleFileUpload}
      />

      <Snackbar
        open={!!errorMessage}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={handleCloseSnackbar}
          severity="error"
          sx={{ width: '100%' }}
        >
          {errorMessage}
        </Alert>
      </Snackbar>

      <Snackbar
        open={!!successMessage}
        autoHideDuration={4000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={handleCloseSnackbar}
          severity="success"
          sx={{ width: '100%' }}
        >
          {successMessage}
        </Alert>
      </Snackbar>
    </>
  );
};
