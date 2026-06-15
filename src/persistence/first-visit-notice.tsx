import { useState } from 'react';
import { Alert, AlertTitle, Collapse } from '@mui/material';
import {
  acknowledgeFirstVisit,
  hasAcknowledgedFirstVisit,
} from '../helpers/storage-helpers';
import { SECTION_GAP } from '../theme';

// First-visit privacy notice (Phase 1.3, issue #20). Explains that PathWise is
// backend-free and that data stays on-device, and points to the "Save on this
// device" toggle. Shown once, then dismissed permanently via a stored flag.
// Doubles as the app's privacy story: no backend, no account, no tracking.
export const FirstVisitNotice = () => {
  const [open, setOpen] = useState(() => !hasAcknowledgedFirstVisit());

  const dismiss = () => {
    acknowledgeFirstVisit();
    setOpen(false);
  };

  return (
    <Collapse in={open} unmountOnExit>
      <Alert
        severity="info"
        onClose={dismiss}
        sx={{ marginBottom: SECTION_GAP }}
      >
        <AlertTitle>Your data stays on this device</AlertTitle>
        PathWise has no backend, no account, and no tracking — nothing you enter
        ever leaves your browser. Turn on <strong>
          Save on this device
        </strong>{' '}
        in the toolbar to keep your data across refreshes.
      </Alert>
    </Collapse>
  );
};
