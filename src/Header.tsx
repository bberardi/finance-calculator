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
        sx={{ position: 'relative', zIndex: 1 }}
      >
        <CardMedia
          image={Logo}
          sx={{
            height: 200,
            width: 200,
            filter: 'drop-shadow(0 4px 12px rgba(0, 0, 0, 0.2))',
            transition: 'transform 0.3s ease',
            '&:hover': {
              transform: 'scale(1.05) rotate(2deg)',
            },
          }}
        />
        <Stack spacing={2}>
          <Typography
            variant="h2"
            sx={{
              fontWeight: 700,
              background: 'linear-gradient(135deg, #ffffff 0%, #e0f0ff 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              textShadow: '0 2px 10px rgba(0, 0, 0, 0.2)',
              letterSpacing: '1px',
            }}
          >
            PathWise
          </Typography>
          <Typography
            variant="h5"
            sx={{
              fontWeight: 300,
              color: 'rgba(255, 255, 255, 0.9)',
              letterSpacing: '0.5px',
            }}
          >
            Your financial calculator and forecastor
          </Typography>
        </Stack>
      </Stack>
    </div>
  );
};
