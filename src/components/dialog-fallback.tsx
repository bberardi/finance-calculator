import { Backdrop, CircularProgress } from '@mui/material';

// Suspense fallback for lazily-loaded modal surfaces — the add/edit forms and
// the schedule/PIT popouts (roadmap 6.6). Their chunks are small, but on a slow
// connection clicking "Add" or a row action would otherwise give a beat of no
// feedback before the dialog appears. A dimmed backdrop + spinner (above the
// modal layer) makes the load visible, matching the chart's Skeleton fallback.
export const DialogFallback = () => (
  <Backdrop open sx={{ zIndex: (theme) => theme.zIndex.modal + 1 }}>
    <CircularProgress color="inherit" />
  </Backdrop>
);
