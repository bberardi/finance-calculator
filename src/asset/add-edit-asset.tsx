import {
  Alert,
  Box,
  Button,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  TextField,
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { Asset, AssetType, emptyAsset } from '../models/asset-model';
import { CompoundingFrequency } from '../models/investment-model';
import { Loan } from '../models/loan-model';
import { NumericFormat } from 'react-number-format';
import { ResponsiveDialog } from '../components/responsive-dialog';
import { isAssetValid, validateAsset } from '../helpers/validation-helpers';
import { fieldHelperText } from '../components/field-helper-text';
import { useFieldTracking } from '../hooks/use-field-tracking';

// Friendly labels for the AssetType select. Keyed by enum value so the option
// list and the stored value never drift.
const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  [AssetType.Cash]: 'Cash (HYSA / CD / checking)',
  [AssetType.Property]: 'Property (home / real estate)',
  [AssetType.CustomAsset]: 'Custom asset',
  [AssetType.CustomLiability]: 'Custom liability',
};

const COMPOUNDING_LABELS: Record<CompoundingFrequency, string> = {
  [CompoundingFrequency.Monthly]: 'Monthly',
  [CompoundingFrequency.Quarterly]: 'Quarterly',
  [CompoundingFrequency.Annually]: 'Annually',
};

// Every type, the default when an entry point doesn't constrain the selector.
const ALL_ASSET_TYPES: AssetType[] = Object.values(AssetType);

// The rate label tracks the asset type so the field reads naturally: an APY for
// cash, an appreciation rate for property, a growth/decline rate otherwise.
const rateLabel = (type: AssetType): string => {
  switch (type) {
    case AssetType.Cash:
      return 'Annual percentage yield (APY)';
    case AssetType.Property:
      return 'Annual appreciation rate';
    default:
      return 'Annual growth / decline rate';
  }
};

// Shared form for every simple holding (Phase 7). The owning "Add Asset" /
// "Add Liability" entry point decides which AssetType options the selector
// offers (`allowedTypes`) and which type a new entity starts as (`initialType`);
// a custom liability flows through here too, so the copy (title, balance label,
// buttons) adapts to whether the current type is a liability.
export const AddEditAsset = (props: AddEditAssetProps) => {
  const allowedTypes = props.allowedTypes ?? ALL_ASSET_TYPES;
  const seedType = props.initialType ?? allowedTypes[0] ?? AssetType.Cash;

  const [newAsset, setNewAsset] = useState<Asset>(emptyAsset);

  const validation = useMemo(() => validateAsset(newAsset), [newAsset]);
  const isFormValid = () => isAssetValid(newAsset);

  const {
    touch,
    errorFor,
    warningFor,
    resetTracking,
    markSubmitAttempted,
    saveDisabledReason,
  } = useFieldTracking(validation);

  useEffect(() => {
    // Edit reuses the passed entity; add seeds an empty entity of the type the
    // entry point chose, so the form opens already on (say) "Custom liability".
    setNewAsset(props.asset ?? { ...emptyAsset, AssetType: seedType });
    resetTracking();
  }, [props.asset, props.open, seedType, resetTracking]);

  const onSave = () => {
    if (!isFormValid()) {
      markSubmitAttempted();
      return;
    }
    props.onSave(newAsset, props.asset);
    props.onClose();
    setNewAsset(emptyAsset);
    resetTracking();
  };

  const onCancel = () => {
    props.onClose();
    resetTracking();
  };

  const isProperty = newAsset.AssetType === AssetType.Property;
  const isLiability = newAsset.AssetType === AssetType.CustomLiability;
  const noun = isLiability ? 'liability' : 'asset';

  return (
    <ResponsiveDialog open={props.open} onClose={props.onClose}>
      <DialogTitle sx={{ textAlign: 'center' }}>
        {!props.asset ? `Add new ${noun}` : `Edit ${noun}`}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          {/* The entry point's type selector. Hidden when it would offer a single
              option (the type is fixed, e.g. a custom liability). */}
          {allowedTypes.length > 1 && (
            <TextField
              select
              label="Type"
              value={newAsset.AssetType}
              onChange={(e) =>
                setNewAsset({
                  ...newAsset,
                  AssetType: e.target.value as AssetType,
                  // Dropping out of Property clears a now-meaningless link.
                  LinkedLoanId:
                    (e.target.value as AssetType) === AssetType.Property
                      ? newAsset.LinkedLoanId
                      : undefined,
                })
              }
            >
              {allowedTypes.map((type) => (
                <MenuItem key={type} value={type}>
                  {ASSET_TYPE_LABELS[type]}
                </MenuItem>
              ))}
            </TextField>
          )}
          <TextField
            label="Name"
            value={newAsset.Name}
            onChange={(e) => setNewAsset({ ...newAsset, Name: e.target.value })}
            onBlur={() => touch('Name')}
            error={Boolean(errorFor('Name'))}
            helperText={fieldHelperText(errorFor('Name'), warningFor('Name'))}
            required
          />
          <TextField
            label="Provider / Institution"
            value={newAsset.Provider}
            onChange={(e) =>
              setNewAsset({ ...newAsset, Provider: e.target.value })
            }
            onBlur={() => touch('Provider')}
            error={Boolean(errorFor('Provider'))}
            helperText={fieldHelperText(
              errorFor('Provider'),
              warningFor('Provider')
            )}
            required
          />
          <NumericFormat
            label={isLiability ? 'Amount owed' : 'Current Balance / Value'}
            value={newAsset.Balance}
            thousandSeparator
            decimalScale={2}
            prefix={'$'}
            customInput={TextField}
            onValueChange={(vs) =>
              setNewAsset({ ...newAsset, Balance: Number(vs.value) })
            }
            onBlur={() => touch('Balance')}
            error={Boolean(errorFor('Balance'))}
            helperText={fieldHelperText(
              errorFor('Balance'),
              warningFor('Balance')
            )}
            required
          />
          <NumericFormat
            label={rateLabel(newAsset.AssetType)}
            value={newAsset.GrowthRate}
            thousandSeparator
            decimalScale={3}
            suffix={'%'}
            allowNegative
            customInput={TextField}
            onValueChange={(vs) =>
              setNewAsset({ ...newAsset, GrowthRate: Number(vs.value) })
            }
            onBlur={() => touch('GrowthRate')}
            error={Boolean(errorFor('GrowthRate'))}
            helperText={fieldHelperText(
              errorFor('GrowthRate'),
              warningFor('GrowthRate')
            )}
            required
          />
          <TextField
            select
            label="Compounding"
            value={newAsset.CompoundingPeriod ?? CompoundingFrequency.Monthly}
            onChange={(e) =>
              setNewAsset({
                ...newAsset,
                CompoundingPeriod: e.target.value as CompoundingFrequency,
              })
            }
          >
            {Object.values(CompoundingFrequency).map((freq) => (
              <MenuItem key={freq} value={freq}>
                {COMPOUNDING_LABELS[freq]}
              </MenuItem>
            ))}
          </TextField>
          {/* 7.2 entity linking: pair a property to its mortgage so net worth
              reflects home equity. Only shown for property; "None" clears it. */}
          {isProperty && (
            <TextField
              select
              label="Linked mortgage (optional)"
              value={newAsset.LinkedLoanId ?? ''}
              onChange={(e) =>
                setNewAsset({
                  ...newAsset,
                  LinkedLoanId: e.target.value || undefined,
                })
              }
              helperText="Pair this property with its mortgage to track home equity."
            >
              <MenuItem value="">None</MenuItem>
              {props.loans.map((loan) => (
                <MenuItem key={loan.Id} value={loan.Id}>
                  {loan.Name}
                </MenuItem>
              ))}
            </TextField>
          )}
        </Box>
      </DialogContent>
      <Box sx={{ px: 3 }}>
        {!isFormValid() && (
          <Alert severity="info" sx={{ mb: 1 }}>
            {saveDisabledReason}
          </Alert>
        )}
      </Box>
      <DialogActions>
        <Button type="reset" color="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="submit"
          variant="contained"
          color="primary"
          onClick={onSave}
          disabled={!isFormValid()}
        >
          {!props.asset ? `Add ${noun}` : `Save ${noun}`}
        </Button>
      </DialogActions>
    </ResponsiveDialog>
  );
};

export interface AddEditAssetProps {
  open: boolean;
  onSave: (newAsset: Asset, oldAsset?: Asset) => void;
  onClose: () => void;
  asset?: Asset;
  // Loans available to pair with a property (7.2 entity linking).
  loans: Loan[];
  // The AssetType options the in-dialog selector offers. When only one type is
  // allowed the selector is hidden (the type is fixed by the entry point, e.g. a
  // custom liability). Defaults to every type.
  allowedTypes?: AssetType[];
  // The type a brand-new (add-mode) entity starts as; ignored when editing.
  initialType?: AssetType;
}
