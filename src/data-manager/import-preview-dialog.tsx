import {
  Alert,
  Box,
  Button,
  Chip,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  List,
  ListItem,
  ListItemText,
  Typography,
} from '@mui/material';
import { ResponsiveDialog } from '../components/responsive-dialog';

// A named entity in the preview (loans, investments, and scenarios all have an
// Id + Name, which is all the preview needs to display).
export interface PreviewEntity {
  Id: string;
  Name: string;
}

export interface ImportPreviewSection {
  // Plural label for the entity kind, e.g. "Loans".
  label: string;
  added: PreviewEntity[];
  overwritten: PreviewEntity[];
}

export interface ImportPreviewDialogProps {
  open: boolean;
  sections: ImportPreviewSection[];
  onConfirm: () => void;
  onCancel: () => void;
}

const NamesList = ({ entities }: { entities: PreviewEntity[] }) => (
  <List dense disablePadding>
    {entities.map((entity) => (
      <ListItem key={entity.Id} disablePadding sx={{ pl: 1 }}>
        <ListItemText
          primary={entity.Name}
          slotProps={{ primary: { variant: 'body2' } }}
        />
      </ListItem>
    ))}
  </List>
);

// Pre-merge "what changed" preview (roadmap 6.3). Import merges by Id, so an
// imported entity that shares an Id with an existing one silently overwrites
// it — an unrecoverable clobber. This dialog shows exactly what will be added
// vs. overwritten and requires explicit confirmation before the merge runs.
export const ImportPreviewDialog = ({
  open,
  sections,
  onConfirm,
  onCancel,
}: ImportPreviewDialogProps) => {
  const totalAdded = sections.reduce((sum, s) => sum + s.added.length, 0);
  const totalOverwritten = sections.reduce(
    (sum, s) => sum + s.overwritten.length,
    0
  );
  const nothingToImport = totalAdded + totalOverwritten === 0;

  return (
    <ResponsiveDialog open={open} onClose={onCancel} maxWidth="sm">
      <DialogTitle>Review import</DialogTitle>
      <DialogContent>
        {nothingToImport ? (
          <DialogContentText>
            This file has no loans, investments, or scenarios to import.
          </DialogContentText>
        ) : (
          <>
            <DialogContentText sx={{ mb: 1 }}>
              {totalAdded} added
              {totalOverwritten > 0 ? `, ${totalOverwritten} overwritten` : ''}.
              Review the changes before importing.
            </DialogContentText>

            {totalOverwritten > 0 && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                Items sharing an ID with existing ones will be replaced. This
                can&apos;t be undone after the snackbar closes.
              </Alert>
            )}

            {sections.map((section) => {
              if (section.added.length + section.overwritten.length === 0) {
                return null;
              }
              return (
                <Box key={section.label} sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    {section.label}
                  </Typography>
                  {section.added.length > 0 && (
                    <Box sx={{ mb: 1 }}>
                      <Chip
                        label={`Add ${section.added.length}`}
                        color="success"
                        size="small"
                        variant="outlined"
                      />
                      <NamesList entities={section.added} />
                    </Box>
                  )}
                  {section.overwritten.length > 0 && (
                    <Box>
                      <Chip
                        label={`Overwrite ${section.overwritten.length}`}
                        color="warning"
                        size="small"
                        variant="outlined"
                      />
                      <NamesList entities={section.overwritten} />
                    </Box>
                  )}
                  <Divider sx={{ mt: 1 }} />
                </Box>
              );
            })}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} color="inherit">
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          disabled={nothingToImport}
          color={totalOverwritten > 0 ? 'warning' : 'primary'}
        >
          {totalOverwritten > 0
            ? `Import & overwrite ${totalOverwritten}`
            : 'Import'}
        </Button>
      </DialogActions>
    </ResponsiveDialog>
  );
};
