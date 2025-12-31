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
  Alert,
  Snackbar,
} from '@mui/material';
import { useState, useRef } from 'react';
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
import {
  exportToJson,
  importFromJson,
  mergeData,
} from './helpers/data-helpers';
import { generateId } from './helpers/id-helpers';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DownloadIcon from '@mui/icons-material/Download';

export const Body = () => {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [testDataEnabled, setTestDataEnabled] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    const isJsonMimeType = !file.type || file.type === 'application/json';

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
        const loanMsg =
          loansResult.added + loansResult.updated > 0
            ? `${loansResult.added + loansResult.updated} loans (${loansResult.added} added, ${loansResult.updated} updated)`
            : '0 loans';
        const investmentMsg =
          investmentsResult.added + investmentsResult.updated > 0
            ? `${investmentsResult.added + investmentsResult.updated} investments (${investmentsResult.added} added, ${investmentsResult.updated} updated)`
            : '0 investments';

        setSuccessMessage(
          `Data imported successfully! ${loanMsg} and ${investmentMsg} processed.`
        );
      } catch (error) {
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

  const hasData = loans.length > 0 || investments.length > 0;

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
    </Container>
  );
};
