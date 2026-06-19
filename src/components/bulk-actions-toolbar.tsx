import { Button, IconButton, Toolbar, Typography } from '@mui/material';
import { Close, ContentCopy, Delete } from '@mui/icons-material';

// Bulk-action bar shown above a table when one or more rows are selected
// (roadmap 6.4). Owns no selection state itself — the table passes the count
// and the duplicate/delete/clear handlers — so the loan and investment tables
// share one consistent affordance.
export interface BulkActionsToolbarProps {
  count: number;
  // Singular noun for the entity kind, e.g. "loan" / "investment".
  itemLabel: string;
  onDuplicate: () => void;
  onDelete: () => void;
  onClear: () => void;
}

export const BulkActionsToolbar = ({
  count,
  itemLabel,
  onDuplicate,
  onDelete,
  onClear,
}: BulkActionsToolbarProps) => {
  if (count === 0) {
    return null;
  }
  const noun = count === 1 ? itemLabel : `${itemLabel}s`;
  return (
    <Toolbar
      disableGutters
      variant="dense"
      sx={{
        px: 1.5,
        mb: 1,
        gap: 1,
        borderRadius: 1,
        bgcolor: 'action.selected',
      }}
    >
      <IconButton
        size="small"
        onClick={onClear}
        aria-label="Clear selection"
        title="Clear selection"
      >
        <Close fontSize="small" />
      </IconButton>
      <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
        {count} {noun} selected
      </Typography>
      <Button size="small" startIcon={<ContentCopy />} onClick={onDuplicate}>
        Duplicate
      </Button>
      <Button
        size="small"
        color="error"
        startIcon={<Delete />}
        onClick={onDelete}
      >
        Delete
      </Button>
    </Toolbar>
  );
};
