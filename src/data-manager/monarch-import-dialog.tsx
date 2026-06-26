import {
  Box,
  Button,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { lazy, Suspense, useEffect, useState } from 'react';
import { Asset, AssetType } from '../models/asset-model';
import { Loan } from '../models/loan-model';
import { emptyInvestment, Investment } from '../models/investment-model';
import {
  assetToInvestment,
  investmentToAsset,
} from '../helpers/asset-investment-helpers';
import { buildLoanSeedFromAsset } from '../helpers/convert-helpers';
import { formatCurrency } from '../helpers/format-helpers';
import { ResponsiveDialog } from '../components/responsive-dialog';
import { DialogFallback } from '../components/dialog-fallback';

// Lazy-loaded like the app's other editor entry points (Body, the tables) so the
// editor bundles stay code-split — they load only when a row opens one mid-import.
const AddEditAsset = lazy(() =>
  import('../asset/add-edit-asset').then((m) => ({ default: m.AddEditAsset }))
);
const AddEditInvestment = lazy(() =>
  import('../investment/add-edit-investment').then((m) => ({
    default: m.AddEditInvestment,
  }))
);
const AddEditLoan = lazy(() =>
  import('../loan/add-edit-loan').then((m) => ({ default: m.AddEditLoan }))
);

// What a parsed Monarch account will commit as. A Loan is a separate entity from
// an Asset, so an import can yield both; an investment is stored as its
// AssetType.Investment asset (the fold), so it rides in the asset arm.
type Resolution =
  | { kind: 'asset'; asset: Asset }
  | { kind: 'loan'; loan: Loan };

// "loan" is not an AssetType, so the row dropdown uses a synthetic option value
// alongside the real asset types.
const LOAN_OPTION = 'loan';
type RowTypeChoice = AssetType | typeof LOAN_OPTION;

// Type choices per account. Custom asset/liability are the parser's sign-based
// defaults and commit as-is; Cash / Property / Investment / Loan each open that
// type's editor to capture its extra fields before the import commits.
const TYPE_OPTIONS: { value: RowTypeChoice; label: string }[] = [
  { value: AssetType.Cash, label: 'Cash (HYSA / CD / checking)' },
  { value: AssetType.Property, label: 'Property' },
  { value: AssetType.Investment, label: 'Investment' },
  { value: AssetType.CustomAsset, label: 'Custom asset' },
  { value: AssetType.CustomLiability, label: 'Custom liability' },
  { value: LOAN_OPTION, label: 'Loan' },
];

// The asset types the in-import asset editor offers. Investment is excluded — it
// has its own (richer) editor, reached from the row dropdown.
const ASSET_EDITOR_TYPES: AssetType[] = [
  AssetType.Cash,
  AssetType.Property,
  AssetType.CustomAsset,
  AssetType.CustomLiability,
];

// Asset types whose extra fields are captured in the asset editor on selection
// (Investment routes to its own editor; custom commits as-is).
const ASSET_TYPES_WITH_EDITOR: AssetType[] = [
  AssetType.Cash,
  AssetType.Property,
];

// The dropdown value for a row, derived from its resolution.
const choiceOf = (r: Resolution): RowTypeChoice =>
  r.kind === 'loan' ? LOAN_OPTION : r.asset.AssetType;

// A resolution that went through a type editor (vs. the bare custom default), so
// the row shows a "configured" affordance to review/edit it.
const isConfigured = (r: Resolution): boolean =>
  r.kind === 'loan' ||
  r.asset.AssetType === AssetType.Cash ||
  r.asset.AssetType === AssetType.Property ||
  r.asset.AssetType === AssetType.Investment;

// Which editor is open, for which account, seeded with what.
type Editing =
  | { kind: 'asset'; accountId: string; seed: Asset }
  | { kind: 'investment'; accountId: string; seed: Investment }
  | { kind: 'loan'; accountId: string; seed: Loan };

export interface MonarchImportDialogProps {
  open: boolean;
  // Parsed accounts, each with the sign-based default AssetType.
  accounts: Asset[];
  // Existing loans, offered as link targets when an account is configured as a
  // Property in the asset editor (7.2 entity linking).
  existingLoans: Loan[];
  // The resolved entities to merge: loans on their own, everything else (incl.
  // investments, as AssetType.Investment) as assets.
  onConfirm: (result: { loans: Loan[]; assets: Asset[] }) => void;
  onCancel: () => void;
}

// Per-account type picker shown before a Monarch import commits. Promoting an
// account to Loan / Cash / Property / Investment opens that type's editor,
// pre-filled from the account, so its type-specific fields (rate/term, APY,
// appreciation, return/contributions) are captured up front instead of landing
// half-specified. Custom asset/liability remain the one-click default.
export const MonarchImportDialog = ({
  open,
  accounts,
  existingLoans,
  onConfirm,
  onCancel,
}: MonarchImportDialogProps) => {
  // Resolution per account Id, seeded from each account's parsed default.
  const [resolutions, setResolutions] = useState<Record<string, Resolution>>(
    {}
  );
  const [editing, setEditing] = useState<Editing | null>(null);

  useEffect(() => {
    setResolutions(
      Object.fromEntries(
        accounts.map((a) => [a.Id, { kind: 'asset', asset: a } as Resolution])
      )
    );
    setEditing(null);
  }, [accounts]);

  // Selecting a type: field-bearing types open their editor; custom types commit
  // as-is. The resolution only changes when an editor saves, so cancelling an
  // editor leaves the row at its prior type.
  const onSelectType = (account: Asset, choice: RowTypeChoice) => {
    if (choice === LOAN_OPTION) {
      setEditing({
        kind: 'loan',
        accountId: account.Id,
        seed: buildLoanSeedFromAsset(account),
      });
    } else if (choice === AssetType.Investment) {
      setEditing({
        kind: 'investment',
        accountId: account.Id,
        seed: {
          ...emptyInvestment,
          Id: account.Id,
          Name: account.Name,
          Provider: account.Provider,
          StartingBalance: account.Balance,
        },
      });
    } else if (ASSET_TYPES_WITH_EDITOR.includes(choice)) {
      setEditing({
        kind: 'asset',
        accountId: account.Id,
        seed: { ...account, AssetType: choice },
      });
    } else {
      // Custom asset / liability: no editor, commit as-is with the chosen type.
      setResolutions((prev) => ({
        ...prev,
        [account.Id]: {
          kind: 'asset',
          asset: { ...account, AssetType: choice as AssetType },
        },
      }));
    }
  };

  // Re-open the editor for an already-configured row, seeded with what was
  // entered so far so editing preserves the values.
  const onReconfigure = (accountId: string, r: Resolution) => {
    if (r.kind === 'loan') {
      setEditing({ kind: 'loan', accountId, seed: r.loan });
    } else if (r.asset.AssetType === AssetType.Investment) {
      setEditing({
        kind: 'investment',
        accountId,
        seed: assetToInvestment(r.asset),
      });
    } else {
      setEditing({ kind: 'asset', accountId, seed: r.asset });
    }
  };

  const resolve = (accountId: string, r: Resolution) =>
    setResolutions((prev) => ({ ...prev, [accountId]: r }));

  const onImport = () => {
    const list = accounts
      .map((a) => resolutions[a.Id])
      .filter((r): r is Resolution => Boolean(r));
    onConfirm({
      loans: list.flatMap((r) => (r.kind === 'loan' ? [r.loan] : [])),
      assets: list.flatMap((r) => (r.kind === 'asset' ? [r.asset] : [])),
    });
  };

  return (
    <>
      <ResponsiveDialog open={open} onClose={onCancel} maxWidth="sm">
        <DialogTitle>Import from Monarch</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            {accounts.length} account{accounts.length === 1 ? '' : 's'} found —
            set each type, then import. Loan, Cash, Property and Investment open
            a quick editor to fill in their details; Custom asset/liability
            import as-is.
          </DialogContentText>
          <Stack spacing={2}>
            {accounts.map((account) => {
              const resolution = resolutions[account.Id];
              if (!resolution) return null;
              const configured = isConfigured(resolution);
              return (
                <Box
                  key={account.Id}
                  sx={{
                    display: 'flex',
                    gap: 2,
                    alignItems: 'center',
                    flexWrap: 'wrap',
                  }}
                >
                  <Box sx={{ flex: 1, minWidth: 160 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {account.Name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {formatCurrency(account.Balance)}
                    </Typography>
                  </Box>
                  <TextField
                    select
                    size="small"
                    label="Type"
                    value={choiceOf(resolution)}
                    onChange={(e) =>
                      onSelectType(account, e.target.value as RowTypeChoice)
                    }
                    slotProps={{
                      htmlInput: { 'aria-label': `Type for ${account.Name}` },
                    }}
                    sx={{ minWidth: 200 }}
                  >
                    {TYPE_OPTIONS.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </TextField>
                  {configured ? (
                    <Tooltip title="Edit details">
                      <IconButton
                        aria-label={`Edit details for ${account.Name}`}
                        onClick={() => onReconfigure(account.Id, resolution)}
                        size="small"
                        color="success"
                      >
                        <CheckCircleIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  ) : (
                    // Keep the row layout stable when there's no edit affordance.
                    <Box sx={{ width: 34 }} />
                  )}
                </Box>
              );
            })}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onCancel} color="inherit">
            Cancel
          </Button>
          <Button onClick={onImport} variant="contained">
            Import {accounts.length}
          </Button>
        </DialogActions>
      </ResponsiveDialog>

      <Suspense fallback={<DialogFallback />}>
        {editing?.kind === 'asset' && (
          <AddEditAsset
            open
            initialValues={editing.seed}
            allowedTypes={ASSET_EDITOR_TYPES}
            loans={existingLoans}
            onSave={(asset) =>
              resolve(editing.accountId, { kind: 'asset', asset })
            }
            onClose={() => setEditing(null)}
          />
        )}
        {editing?.kind === 'investment' && (
          <AddEditInvestment
            open
            initialValues={editing.seed}
            onSave={(investment) =>
              resolve(editing.accountId, {
                kind: 'asset',
                asset: investmentToAsset(investment),
              })
            }
            onClose={() => setEditing(null)}
          />
        )}
        {editing?.kind === 'loan' && (
          <AddEditLoan
            open
            initialValues={editing.seed}
            onSave={(loan) =>
              resolve(editing.accountId, { kind: 'loan', loan })
            }
            onClose={() => setEditing(null)}
          />
        )}
      </Suspense>
    </>
  );
};
