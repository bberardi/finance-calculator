import { CardMedia, Stack, Typography } from '@mui/material';
import Logo from './assets/pathwise.png';

export const Header = () => {
  return (
    <div className="header">
      <Stack
        direction="row"
        spacing={2}
        justifyContent="center"
        alignItems="center"
        sx={{ position: 'relative', zIndex: 1 }}
      >
        <CardMedia
          image={Logo}
          sx={{
            height: 120,
            width: 120,
            filter: 'drop-shadow(0 4px 12px rgba(0, 0, 0, 0.2))',
            transition: 'transform 0.3s ease',
            '&:hover': {
              transform: 'scale(1.05) rotate(2deg)',
            },
          }}
        />
        <Stack spacing={0.5}>
          <Typography
            variant="h3"
            sx={{
              fontWeight: 700,
              color: '#ffffff',
              background: 'linear-gradient(135deg, #ffffff 0%, #e0f0ff 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              letterSpacing: '1px',
              '@supports not (background-clip: text)': {
                color: '#ffffff',
                WebkitTextFillColor: 'inherit',
              },
            }}
          >
            PathWise
          </Typography>
          <Typography
            variant="body1"
            sx={{
              fontWeight: 300,
              color: 'rgba(255, 255, 255, 0.9)',
              letterSpacing: '0.5px',
            }}
          >
            Your financial calculator and forecaster
          </Typography>
        </Stack>
      </Stack>
    </div>
  );
};
