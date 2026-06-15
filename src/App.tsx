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
                <Header />
                <Box
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
