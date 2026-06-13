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
          </FinanceDataProvider>
        </LocalizationProvider>
      </ThemeProvider>
    </div>
  );
}

export default App;
