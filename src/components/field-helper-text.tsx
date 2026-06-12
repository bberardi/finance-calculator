import { Box } from '@mui/material';
import { ReactNode } from 'react';

// Renders helper text for a form field (roadmap 0.8). Errors render in the
// theme error color (handled by the field's own `error` prop), warnings render
// in the theme warning color so they are visually distinct from errors and from
// neutral helper text. Returns the node to pass as a TextField `helperText`.
//
// No hardcoded colors: `warning.main` comes from the active theme palette, so it
// adapts to dark mode automatically.
export const fieldHelperText = (
  error?: string,
  warning?: string
): ReactNode => {
  if (error) {
    return error;
  }
  if (warning) {
    return (
      <Box component="span" sx={{ color: 'warning.main' }}>
        {warning}
      </Box>
    );
  }
  return undefined;
};
