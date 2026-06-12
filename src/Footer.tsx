import { Box } from '@mui/material';
import { brandGradientReversed } from './theme';

export const Footer = () => {
  return (
    <Box
      sx={{
        background: brandGradientReversed,
        color: '#ffffff',
        padding: '8px',
        boxShadow: '0 -2px 8px rgba(0, 0, 0, 0.15)',
      }}
    >
      <p>Version {APP_VERSION}</p>
    </Box>
  );
};
