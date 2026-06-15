import {
  Alert,
  FormControlLabel,
  Snackbar,
  Switch,
  Tooltip,
} from '@mui/material';
import { usePersistence } from './use-persistence';

// Command-bar "Save on this device" toggle (Phase 1.2, issue #20). The switch
// reflects the persisted preference; flipping it hydrates/clears storage and
// starts/stops debounced auto-save via `usePersistence`. Snackbar feedback
// mirrors DataManager's conventions (bottom-center, auto-hide).
export const PersistenceToggle = () => {
  const { enabled, toggle, feedback, clearFeedback } = usePersistence();

  return (
    <>
      <Tooltip
        title={
          enabled
            ? 'Your data is saved on this device. Turn this off to clear it.'
            : 'Save your data on this device so it survives a refresh. Nothing ever leaves your browser.'
        }
      >
        <FormControlLabel
          sx={{ color: 'inherit', mr: 0 }}
          control={
            <Switch
              checked={enabled}
              onChange={toggle}
              color="default"
              slotProps={{
                input: { 'aria-label': 'Save data on this device' },
              }}
            />
          }
          label="Save on this device"
        />
      </Tooltip>

      <Snackbar
        open={!!feedback}
        autoHideDuration={4000}
        onClose={clearFeedback}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {feedback ? (
          <Alert
            onClose={clearFeedback}
            severity={feedback.severity}
            sx={{ width: '100%' }}
          >
            {feedback.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </>
  );
};
