import { Button, Alert, Snackbar } from '@mui/material';
import { useState, useRef } from 'react';
import { Loan } from '../models/loan-model';
import { Investment } from '../models/investment-model';
import {
  exportToJson,
  importFromJson,
  mergeData,
} from '../helpers/data-helpers';
import { generateAmortizationSchedule } from '../helpers/loan-helpers';
import { generateInvestmentGrowth } from '../helpers/investment-helpers';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DownloadIcon from '@mui/icons-material/Download';

interface DataManagerProps {
  loans: Loan[];
  investments: Investment[];
  setLoans: (loans: Loan[]) => void;
  setInvestments: (investments: Investment[]) => void;
}

export const DataManager = ({
  loans,
  investments,
  setLoans,
  setInvestments,
}: DataManagerProps) => {
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasData = loans.length > 0 || investments.length > 0;

  const handleExport = () => {
    try {
      const jsonData = exportToJson(loans, investments);
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `pathwise-data-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
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
    // Strict MIME type validation - reject empty/unknown types
    const isJsonMimeType =
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
        const { loans: importedLoans, investments: importedInvestments } =
          importFromJson(content);

        // Merge the imported data with existing data
        const { items: mergedLoans, result: loansResult } = mergeData(
          loans,
          importedLoans
        );
        const { items: mergedInvestments, result: investmentsResult } =
          mergeData(investments, importedInvestments);

        // Regenerate calculated fields
        const updatedLoans = mergedLoans.map((loan) => ({
          ...loan,
          AmortizationSchedule: generateAmortizationSchedule(loan),
        }));

        const updatedInvestments = mergedInvestments.map((investment) => ({
          ...investment,
          ProjectedGrowth: generateInvestmentGrowth(investment),
        }));

        setLoans(updatedLoans);
        setInvestments(updatedInvestments);

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
      <Button
        variant="outlined"
        color="inherit"
        sx={{ margin: '5px' }}
        onClick={handleUploadClick}
        startIcon={<UploadFileIcon />}
      >
        Upload
      </Button>
      <Button
        variant="outlined"
        color="inherit"
        sx={{ margin: '5px' }}
        onClick={handleExport}
        disabled={!hasData}
        startIcon={<DownloadIcon />}
      >
        Export
      </Button>
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
