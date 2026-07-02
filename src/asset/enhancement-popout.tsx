import {
  Box,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useMemo, useState } from 'react';
import { NumericFormat } from 'react-number-format';
import { Asset } from '../models/asset-model';
import { evaluateEnhancement } from '../helpers/enhancement-helpers';
import { formatCurrency, formatPercent } from '../helpers/format-helpers';
import { ResponsiveDialog } from '../components/responsive-dialog';

interface EnhancementPopoutProps {
  asset: Asset;
  onClose: () => void;
}

// Enhancement ROI calculator (roadmap 9.3): "is this improvement worth it?" —
// enter an improvement's cost and the value it adds to a property, and see how
// much of the cost it recoups, its immediate effect on net worth, and (as the
// added value appreciates with the home) when it breaks even. The appreciation
// rate is pre-filled from the asset; all figures come from evaluateEnhancement.
export const EnhancementPopout = ({
  asset,
  onClose,
}: EnhancementPopoutProps) => {
  const [cost, setCost] = useState(0);
  const [valueAdd, setValueAdd] = useState(0);
  const [years, setYears] = useState(10);

  const result = useMemo(
    () => evaluateEnhancement(cost, valueAdd, asset.GrowthRate, years),
    [cost, valueAdd, asset.GrowthRate, years]
  );

  const { recoupPercent, immediateEquityChange, breakEvenYears } = result;

  // One-line verdict, from best case (nets out positive today) to worst (never
  // recovers at this appreciation rate).
  const verdict =
    immediateEquityChange >= 0
      ? `Adds ${formatCurrency(immediateEquityChange)} to your net worth right away.`
      : breakEvenYears !== undefined
        ? `Costs ${formatCurrency(-immediateEquityChange)} up front; the added value catches up in about ${breakEvenYears} years as it appreciates.`
        : `Costs ${formatCurrency(-immediateEquityChange)} up front and doesn't recover at this appreciation rate.`;

  const dollarInput = (
    label: string,
    value: number,
    onChange: (value: number) => void
  ) => (
    <NumericFormat
      label={label}
      value={value || ''}
      thousandSeparator
      decimalScale={2}
      prefix="$"
      allowNegative={false}
      customInput={TextField}
      size="small"
      fullWidth
      placeholder="$0"
      onValueChange={(vs) => onChange(Number(vs.value))}
    />
  );

  return (
    <ResponsiveDialog open={!!asset} onClose={onClose}>
      <DialogTitle>Is this improvement worth it?</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            {asset.Name} · appreciating {formatPercent(asset.GrowthRate)}/yr
          </Typography>

          <Stack direction="row" spacing={1}>
            {dollarInput('Improvement cost', cost, setCost)}
            {dollarInput('Value it adds', valueAdd, setValueAdd)}
          </Stack>
          <NumericFormat
            label="Years to project"
            value={years || ''}
            decimalScale={0}
            allowNegative={false}
            customInput={TextField}
            size="small"
            sx={{ width: 160 }}
            onValueChange={(vs) => setYears(Number(vs.value))}
          />

          <Typography>
            {recoupPercent === undefined
              ? 'Recoups: n/a (no cost entered)'
              : `Recoups: ${recoupPercent}% of the cost`}
          </Typography>
          <Typography>{`Net worth today: ${
            immediateEquityChange >= 0 ? '+' : ''
          }${formatCurrency(immediateEquityChange)}`}</Typography>
          <Typography>{`Added value in ${years} years: ${formatCurrency(
            result.addedValueAtYears
          )}`}</Typography>
          <Typography>{`Breaks even: ${
            breakEvenYears === undefined
              ? 'not at this rate'
              : breakEvenYears === 0
                ? 'right away'
                : `~${breakEvenYears} years`
          }`}</Typography>

          <Typography variant="body2" sx={{ fontWeight: 600, mt: 1 }}>
            {verdict}
          </Typography>
        </Box>
      </DialogContent>
    </ResponsiveDialog>
  );
};
