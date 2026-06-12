import {
  Button,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';
import { ResponsiveDialog } from './responsive-dialog';

// Small confirmation guard for destructive deletes (roadmap 0.7).
//
// Delete moved out of the edit form onto the table rows / mobile cards; this
// dialog is the confirmation step before the delete actually fires. The
// snackbar soft-undo (in Body) is the second safety net.
export interface ConfirmDeleteDialogProps {
  // When set, the dialog is open and asks to delete the entity with this name.
  // Null/undefined keeps the dialog closed.
  itemName?: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export const ConfirmDeleteDialog = ({
  itemName,
  onCancel,
  onConfirm,
}: ConfirmDeleteDialogProps) => (
  <ResponsiveDialog
    open={!!itemName}
    onClose={onCancel}
    maxWidth="xs"
    // A tiny confirmation never needs to fill a phone screen.
    fullScreen={false}
  >
    <DialogTitle>Delete {itemName}?</DialogTitle>
    <DialogContent>
      <DialogContentText>
        This can be undone right after, but the entry will be removed from your
        lists.
      </DialogContentText>
    </DialogContent>
    <DialogActions>
      <Button color="secondary" onClick={onCancel}>
        Cancel
      </Button>
      <Button color="error" variant="contained" onClick={onConfirm} autoFocus>
        Delete
      </Button>
    </DialogActions>
  </ResponsiveDialog>
);
