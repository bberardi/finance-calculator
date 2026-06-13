import { Dialog, DialogProps, useMediaQuery, useTheme } from '@mui/material';
import { ReactNode } from 'react';

// Shared modal wrapper for PathWise (roadmap 0.7).
//
// The add/edit forms and the schedule/PIT popouts previously abused MUI
// `Popover` as a modal. `Popover` gives no focus trap, no Escape handling, and
// no responsive layout — all of which a real `Dialog` provides for free.
//
// This wrapper exists because six surfaces needed the same conversion and every
// later phase is told to copy this pattern. It does exactly one thing on top of
// `Dialog`: go full-screen on small viewports so forms/tables are usable on
// mobile. Everything else (focus trap, Escape-to-close, backdrop click,
// `DialogTitle`/`DialogContent`/`DialogActions` structure, theme surfaces in
// both light and dark mode) comes from `Dialog` itself — so callers compose the
// standard MUI dialog sub-components inside, and dark mode "just works" because
// the dialog surface is the themed `paper` color.
//
// Keep it thin: it forwards `maxWidth`, `fullWidth`, and any other `DialogProps`
// straight through, and never fights the Dialog's built-in keyboard/focus
// behavior.
export interface ResponsiveDialogProps extends DialogProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

export const ResponsiveDialog = ({
  open,
  onClose,
  children,
  maxWidth = 'sm',
  fullWidth = true,
  ...rest
}: ResponsiveDialogProps) => {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={fullScreen}
      fullWidth={fullWidth}
      maxWidth={maxWidth}
      {...rest}
    >
      {children}
    </Dialog>
  );
};
