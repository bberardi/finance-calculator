import { CardMedia, Stack, Typography } from '@mui/material';
import Logo from './assets/pathwise-icon.png';

export const Header = () => {
  return (
    <div className="header">
      <Stack
        direction="row"
        spacing={2}
        justifyContent="center"
        alignItems="center"
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
    </div>
  );
};
