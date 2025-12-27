import './App.css';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { Footer } from './Footer';
import { Body } from './Body';
import { Header } from './Header';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { Box, Stack } from '@mui/material';

function App() {
  return (
    <div className="wrapper">
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <Stack sx={{ height: '100vh', flexDirection: 'column' }}>
          <Header />
          <Box
            sx={{
              flexGrow: 1,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <Body />
          </Box>
          <Footer />
        </Stack>
      </LocalizationProvider>
    </div>
  );
}

export default App;
