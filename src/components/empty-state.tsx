import { MouseEvent } from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';

// Onboarding & empty states (roadmap 0.9).
//
// Two flavors:
//  - <OnboardingEmptyState>: shown when there are NO loans, investments, OR
//    assets. Explains what PathWise does and offers the first-run CTAs, which
//    open the same "Add Asset" / "Add Liability" type menus as the command bar
//    (anchored to the clicked button), or load sample data.
//  - <SectionEmptyState>: a lighter per-section empty state shown when only ONE
//    collection is empty (e.g. loans exist but investments don't), with that
//    section's single "Add" CTA.
//
// Both are theme-only (no hardcoded colors); text uses `text.secondary` so they
// read correctly in light and dark mode.

export interface OnboardingEmptyStateProps {
  // Receive the click event so the caller can anchor its type menu to the button.
  onAddAsset: (event: MouseEvent<HTMLElement>) => void;
  onAddLiability: (event: MouseEvent<HTMLElement>) => void;
  onLoadSampleData: () => void;
}

export const OnboardingEmptyState = ({
  onAddAsset,
  onAddLiability,
  onLoadSampleData,
}: OnboardingEmptyStateProps) => (
  <Box sx={{ textAlign: 'center', paddingY: 5, paddingX: 2 }}>
    <Typography variant="h5" gutterBottom>
      Welcome to PathWise
    </Typography>
    <Typography
      variant="body1"
      color="text.secondary"
      sx={{ maxWidth: 560, marginX: 'auto', marginBottom: 3 }}
    >
      PathWise forecasts your net worth across all of your assets and
      liabilities at once — investments, cash, property, loans, and more — so
      you can see your whole financial position and decide where your extra
      money should go. Add your first entry, or load some sample data to
      explore.
    </Typography>
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={1.5}
      sx={{ justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}
    >
      <Button
        variant="contained"
        endIcon={<ArrowDropDownIcon />}
        aria-haspopup="menu"
        onClick={onAddAsset}
      >
        Add an asset
      </Button>
      <Button
        variant="contained"
        endIcon={<ArrowDropDownIcon />}
        aria-haspopup="menu"
        onClick={onAddLiability}
      >
        Add a liability
      </Button>
      <Button variant="outlined" onClick={onLoadSampleData}>
        Load sample data
      </Button>
    </Stack>
  </Box>
);

export interface SectionEmptyStateProps {
  message: string;
  actionLabel: string;
  // Receives the click event so an action can anchor a menu to the button
  // (callers that just open a dialog can ignore it).
  onAction: (event: MouseEvent<HTMLElement>) => void;
}

export const SectionEmptyState = ({
  message,
  actionLabel,
  onAction,
}: SectionEmptyStateProps) => (
  <Box sx={{ textAlign: 'center', paddingY: 3, paddingX: 2 }}>
    <Typography
      variant="body2"
      color="text.secondary"
      sx={{ marginBottom: 1.5 }}
    >
      {message}
    </Typography>
    <Button variant="outlined" size="small" onClick={onAction}>
      {actionLabel}
    </Button>
  </Box>
);
