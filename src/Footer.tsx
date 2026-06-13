import { Box, Link, Stack, Typography } from '@mui/material';
import GitHubIcon from '@mui/icons-material/GitHub';
import { brandGradientReversed } from './theme';

const REPO_URL = 'https://github.com/bberardi/finance-calculator';

// Minimal footer (roadmap 0.10): a link to the GitHub repo and the app version
// (injected from package.json at build time — see vite.config.ts). Sits on the
// brand gradient like the Header, so white text is intentional and reads in both
// color schemes.
export const Footer = () => {
  return (
    <Box
      component="footer"
      sx={{
        background: brandGradientReversed,
        color: '#ffffff',
        padding: 1,
        boxShadow: '0 -2px 8px rgba(0, 0, 0, 0.15)',
      }}
    >
      <Stack
        direction="row"
        spacing={2}
        sx={{ justifyContent: 'center', alignItems: 'center' }}
      >
        <Link
          href={REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          underline="hover"
          sx={{
            color: 'inherit',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.5,
          }}
        >
          <GitHubIcon fontSize="small" />
          GitHub
        </Link>
        <Typography variant="body2" sx={{ opacity: 0.9 }}>
          Version {__APP_VERSION__}
        </Typography>
      </Stack>
    </Box>
  );
};
