import { CardMedia, Stack, Typography } from '@mui/material';
import Logo from './assets/pathwise.png';

export const Header = () => {
  return (
    <div className="header">
      <Stack
        direction="row"
        spacing={3}
        justifyContent="center"
        alignItems="center"
      >
        <CardMedia image={Logo} sx={{ height: 200, width: 200 }} />
        <Stack spacing={2}>
          <Typography variant="h2">PathWise</Typography>
          <Typography variant="h5">
            Your financial calculator and forecastor
          </Typography>
        </Stack>
      </Stack>
    </div>
  );
};
