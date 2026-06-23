import {
  Box,
  Button,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { Asset, AssetType } from '../models/asset-model';
import { formatCurrency } from '../helpers/format-helpers';
import { ResponsiveDialog } from '../components/responsive-dialog';

// Type choices offered per account at Monarch import. The catch-all custom
// asset/liability are the parser's sign-based defaults; the explicit Cash /
// Property promote an account to a precise type before it lands.
const TYPE_OPTIONS: { value: AssetType; label: string }[] = [
  { value: AssetType.Cash, label: 'Cash (HYSA / CD / checking)' },
  { value: AssetType.Property, label: 'Property' },
  { value: AssetType.CustomAsset, label: 'Custom asset' },
  { value: AssetType.CustomLiability, label: 'Custom liability' },
];

export interface MonarchImportDialogProps {
  open: boolean;
  // Parsed accounts, each with the sign-based default AssetType.
  accounts: Asset[];
  // How many accounts are new vs. will update an existing entry (by Id), shown so
  // a re-import is unsurprising. Independent of the chosen types.
  addedCount: number;
  updatedCount: number;
  onConfirm: (assets: Asset[]) => void;
  onCancel: () => void;
}

// Per-account type picker shown before a Monarch import commits, so accounts can
// be promoted from the catch-all custom type to an explicit one (a mortgage that
// imported as a custom liability stays a liability here, then becomes a Loan via
// the Convert action in the list).
export const MonarchImportDialog = ({
  open,
  accounts,
  addedCount,
  updatedCount,
  onConfirm,
  onCancel,
}: MonarchImportDialogProps) => {
  // Chosen type per account Id, seeded from each account's parsed default.
  const [types, setTypes] = useState<Record<string, AssetType>>({});
  useEffect(() => {
    setTypes(Object.fromEntries(accounts.map((a) => [a.Id, a.AssetType])));
  }, [accounts]);

  const onImport = () => {
    onConfirm(
      accounts.map((a) => ({ ...a, AssetType: types[a.Id] ?? a.AssetType }))
    );
  };

  return (
    <ResponsiveDialog open={open} onClose={onCancel} maxWidth="sm">
      <DialogTitle>Import from Monarch</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          {accounts.length} account{accounts.length === 1 ? '' : 's'} found —
          set each type, then import. {addedCount} new
          {updatedCount > 0 ? `, ${updatedCount} will update existing` : ''}.
        </DialogContentText>
        <Stack spacing={2}>
          {accounts.map((account) => (
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
                value={types[account.Id] ?? account.AssetType}
                onChange={(e) =>
                  setTypes((prev) => ({
                    ...prev,
                    [account.Id]: e.target.value as AssetType,
                  }))
                }
                slotProps={{
                  htmlInput: { 'aria-label': `Type for ${account.Name}` },
                }}
                sx={{ minWidth: 210 }}
              >
                {TYPE_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
            </Box>
          ))}
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
  );
};
