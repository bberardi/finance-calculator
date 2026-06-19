import './App.css';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { Footer } from './Footer';
import { Body } from './Body';
import { Header } from './Header';
import { LocalizationProvider } from '@mui/x-date-pickers';
import {
  Box,
  CssBaseline,
  InitColorSchemeScript,
  Link,
  Stack,
  ThemeProvider,
} from '@mui/material';
import { FinanceDataProvider } from './state/finance-data-context';
import { AppErrorBoundary } from './components/app-error-boundary';
import { theme } from './theme';

function App() {
  return (
    <div className="wrapper">
      {/* Applies the persisted color scheme before first paint to avoid a
          light/dark flash on reload. */}
      <InitColorSchemeScript attribute="data-mui-color-scheme" />
      <ThemeProvider theme={theme} defaultMode="light">
        <CssBaseline />
        <LocalizationProvider dateAdapter={AdapterDayjs}>
          <FinanceDataProvider>
            {/* App-level error boundary (1.4): a render crash shows a recovery
                screen with an export-my-data escape hatch + reload, never a
                white screen. Inside the provider so the fallback can export. */}
            <AppErrorBoundary>
              <Stack sx={{ height: '100vh', flexDirection: 'column' }}>
                {/* Skip-to-content link (roadmap 6.1): the first focusable
                    element, visually hidden until focused, so keyboard and
                    screen-reader users can jump past the header straight to the
                    main content. */}
                <Link
                  href="#main-content"
                  sx={{
                    position: 'absolute',
                    left: 8,
                    top: 8,
                    px: 2,
                    py: 1,
                    borderRadius: 1,
                    bgcolor: 'background.paper',
                    color: 'primary.main',
                    zIndex: (t) => t.zIndex.tooltip + 1,
                    transform: 'translateY(-150%)',
                    transition: 'transform 0.15s ease-in',
                    '&:focus': { transform: 'translateY(0)' },
                  }}
                >
                  Skip to main content
                </Link>
                <Header />
                <Box
                  component="main"
                  id="main-content"
                  tabIndex={-1}
                  sx={{
                    flexGrow: 1,
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <Body />
                </Box>
                <Footer />
              </Stack>
            </AppErrorBoundary>
          </FinanceDataProvider>
        </LocalizationProvider>
      </ThemeProvider>
    </div>
  );
}

export default App;
