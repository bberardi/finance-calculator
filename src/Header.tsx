import { Box, CardMedia, Stack, Typography } from '@mui/material';
import Logo from './assets/pathwise-icon.png';
import { brandGradient } from './theme';

export const Header = () => {
  return (
    <Box
      sx={{
        background: brandGradient,
        color: '#ffffff',
        padding: '12px 20px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
      }}
    >
      <Stack
        direction="row"
        spacing={2}
        sx={{
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <CardMedia
          image={Logo}
          role="img"
          aria-label="PathWise logo"
          sx={{ height: 60, width: 60 }}
        />
        <Stack spacing={0.5}>
          <Typography variant="h4" sx={{ fontWeight: 400 }}>
            PathWise
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.9 }}>
            Your financial calculator and forecastor
          </Typography>
        </Stack>
      </Stack>
    </Box>
  );
};
