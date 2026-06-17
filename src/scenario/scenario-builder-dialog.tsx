import {
  Alert,
  Box,
  Button,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { NumericFormat } from 'react-number-format';
import { Loan } from '../models/loan-model';
import { Investment } from '../models/investment-model';
import { Scenario, emptyScenario } from '../models/scenario-model';
import { ResponsiveDialog } from '../components/responsive-dialog';

interface ScenarioBuilderDialogProps {
  open: boolean;
  loans: Loan[];
  investments: Investment[];
  scenario?: Scenario;
  onSave: (scenario: Scenario) => void;
  onClose: () => void;
}

// Drop zero/blank entries so a scenario only carries the extras the user
// actually set.
const positiveEntries = (
  amounts: Record<string, number>
): Record<string, number> =>
  Object.fromEntries(Object.entries(amounts).filter(([, value]) => value > 0));

// Scenario builder dialog (Phase 4.2): name the scenario and enter extra $/month
// toward any loans (principal) and investments (contributions). Saving with at
// least one positive extra produces a Scenario the chart can overlay.
export const ScenarioBuilderDialog = ({
  open,
  loans,
  investments,
  scenario,
  onSave,
  onClose,
}: ScenarioBuilderDialogProps) => {
  const [name, setName] = useState('');
  const [extraLoanPayments, setExtraLoanPayments] = useState<
    Record<string, number>
  >({});
  const [extraContributions, setExtraContributions] = useState<
    Record<string, number>
  >({});

  // Reset the form to the edited scenario (or blank) each time it opens.
  useEffect(() => {
    setName(scenario?.Name ?? '');
    setExtraLoanPayments(scenario?.ExtraLoanPayments ?? {});
    setExtraContributions(scenario?.ExtraContributions ?? {});
  }, [scenario, open]);

  const cleanedLoans = positiveEntries(extraLoanPayments);
  const cleanedContributions = positiveEntries(extraContributions);
  const hasAnyExtra =
    Object.keys(cleanedLoans).length > 0 ||
    Object.keys(cleanedContributions).length > 0;
  const isValid = name.trim() !== '' && hasAnyExtra;

  const handleSave = () => {
    if (!isValid) return;
    onSave({
      ...emptyScenario,
      Id: scenario?.Id ?? '',
      Name: name.trim(),
      ExtraLoanPayments: cleanedLoans,
      ExtraContributions: cleanedContributions,
    });
    onClose();
  };

  const extraInput = (
    id: string,
    label: string,
    value: number | undefined,
    onChange: (value: number) => void
  ) => (
    // Key by the stable entity Id, not the display Name: names are not unique, so
    // two same-named positions keyed by Name produce duplicate React keys and the
    // two fields bleed focus/caret/formatting into each other. (#101)
    <NumericFormat
      key={id}
      label={label}
      value={value ?? 0}
      thousandSeparator
      decimalScale={2}
      prefix="$"
      customInput={TextField}
      size="small"
      fullWidth
      onValueChange={(vs) => onChange(Number(vs.value))}
    />
  );

  return (
    <ResponsiveDialog open={open} onClose={onClose}>
      <DialogTitle sx={{ textAlign: 'center' }}>
        {scenario ? 'Edit scenario' : 'New scenario'}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField
            label="Scenario name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <Typography variant="body2" color="text.secondary">
            Enter extra $/month to put toward any positions. Leave the rest at
            $0.
          </Typography>

          {loans.length > 0 && (
            <>
              <Divider>Extra loan payments</Divider>
              {loans.map((loan) =>
                extraInput(
                  loan.Id,
                  loan.Name,
                  extraLoanPayments[loan.Id],
                  (value) =>
                    setExtraLoanPayments((prev) => ({
                      ...prev,
                      [loan.Id]: value,
                    }))
                )
              )}
            </>
          )}

          {investments.length > 0 && (
            <>
              <Divider>Extra contributions</Divider>
              {investments.map((investment) =>
                extraInput(
                  investment.Id,
                  investment.Name,
                  extraContributions[investment.Id],
                  (value) =>
                    setExtraContributions((prev) => ({
                      ...prev,
                      [investment.Id]: value,
                    }))
                )
              )}
            </>
          )}
        </Box>
      </DialogContent>
      <Box sx={{ px: 3 }}>
        {!isValid && (
          <Alert severity="info" sx={{ mb: 1 }}>
            Name the scenario and add at least one extra $/month.
          </Alert>
        )}
      </Box>
      <DialogActions>
        <Button color="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={handleSave}
          disabled={!isValid}
        >
          {scenario ? 'Save scenario' : 'Add scenario'}
        </Button>
      </DialogActions>
    </ResponsiveDialog>
  );
};
