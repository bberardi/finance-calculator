import { Box, Button, Stack, Typography } from '@mui/material';

// Onboarding & empty states (roadmap 0.9).
//
// Two flavors:
//  - <OnboardingEmptyState>: shown when there are NO loans AND NO investments.
//    Explains what PathWise does and offers all three first-run CTAs (add a
//    loan, add an investment, load sample data).
//  - <SectionEmptyState>: a lighter per-section empty state shown when only ONE
//    collection is empty (e.g. loans exist but investments don't), with that
//    section's single "Add" CTA.
//
// Both are theme-only (no hardcoded colors); text uses `text.secondary` so they
// read correctly in light and dark mode.

export interface OnboardingEmptyStateProps {
  onAddLoan: () => void;
  onAddInvestment: () => void;
  onLoadSampleData: () => void;
}

export const OnboardingEmptyState = ({
  onAddLoan,
  onAddInvestment,
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
      PathWise forecasts your net worth across all of your loans and investments
      at once, so you can see your whole financial position and decide where
      your extra money should go. Add your first entry, or load some sample data
      to explore.
    </Typography>
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={1.5}
      sx={{ justifyContent: 'center', alignItems: 'center' }}
    >
      <Button variant="contained" onClick={onAddLoan}>
        Add your first loan
      </Button>
      <Button variant="contained" onClick={onAddInvestment}>
        Add your first investment
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
  onAction: () => void;
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
