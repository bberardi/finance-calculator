import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Collapse,
  Container,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import DownloadIcon from '@mui/icons-material/Download';

interface AppErrorFallbackProps {
  error: Error;
  // Reload the whole app (a render error usually recurs without a fresh start).
  onReload: () => void;
  // Escape hatch: download the last-good data so a crash never traps it.
  onExport: () => void;
  // Whether there is any data worth exporting.
  canExport: boolean;
}

// App-level recovery UI (1.4). Shown when the global error boundary catches a
// render exception: an apology, an "export my data" escape hatch so unsaved data
// is never trapped, and a reload affordance.
export const AppErrorFallback = ({
  error,
  onReload,
  onExport,
  canExport,
}: AppErrorFallbackProps) => {
  const [exportFailed, setExportFailed] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const handleExport = () => {
    try {
      onExport();
      setExportFailed(false);
    } catch {
      setExportFailed(true);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ paddingY: 8 }}>
      <Paper sx={{ padding: 4 }}>
        <Stack spacing={2}>
          <Typography variant="h5" component="h1">
            Something went wrong
          </Typography>
          <Typography color="text.secondary">
            PathWise hit an unexpected error. Your data isn’t lost — download a
            backup first, then reload to get back to work.
          </Typography>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Button
              variant="contained"
              startIcon={<DownloadIcon />}
              onClick={handleExport}
              disabled={!canExport}
            >
              Download my data
            </Button>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={onReload}
            >
              Reload app
            </Button>
          </Stack>

          {!canExport && (
            <Typography variant="body2" color="text.secondary">
              There’s no data to download yet.
            </Typography>
          )}
          {exportFailed && (
            <Alert severity="error">
              Couldn’t download your data. Try reloading instead.
            </Alert>
          )}

          <Box>
            <Button size="small" onClick={() => setShowDetails((v) => !v)}>
              {showDetails ? 'Hide' : 'Show'} technical details
            </Button>
            <Collapse in={showDetails}>
              <Typography
                variant="caption"
                component="pre"
                sx={{
                  whiteSpace: 'pre-wrap',
                  marginTop: 1,
                  color: 'text.secondary',
                }}
              >
                {error.message}
              </Typography>
            </Collapse>
          </Box>
        </Stack>
      </Paper>
    </Container>
  );
};
