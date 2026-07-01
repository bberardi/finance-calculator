import {
  Box,
  Button,
  DialogContent,
  DialogTitle,
  IconButton,
  Link,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { Add, Delete, OpenInNew } from '@mui/icons-material';
import { useState } from 'react';
import { Asset, ResearchLink } from '../models/asset-model';
import {
  isSafeResearchUrl,
  normalizeResearchUrl,
} from '../helpers/research-helpers';
import { ResponsiveDialog } from '../components/responsive-dialog';

interface ResearchPopoutProps {
  asset: Asset;
  onSave: (links: ResearchLink[]) => void;
  onClose: () => void;
}

// Holdings & property context (roadmap 9.4): a place to keep the research you
// already do by hand — company/fund pages for an investment, local-market and
// area links for a property. Links live on the asset (persisted through the
// normal edit path) and are never fetched; the app only ever renders them as
// clickable anchors, which is why every URL is normalized and checked to be a
// safe http(s) link (research-helpers) before it can be added.
export const ResearchPopout = ({
  asset,
  onSave,
  onClose,
}: ResearchPopoutProps) => {
  const [links, setLinks] = useState<ResearchLink[]>(asset.ResearchLinks ?? []);
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');
  const [note, setNote] = useState('');

  const normalizedUrl = normalizeResearchUrl(url);
  const urlIsSafe = isSafeResearchUrl(normalizedUrl);
  // Only complain once the user has typed a URL that still isn't a safe link.
  const urlError = url.trim() !== '' && !urlIsSafe;
  const canAdd = label.trim() !== '' && urlIsSafe;

  const commit = (next: ResearchLink[]) => {
    setLinks(next);
    onSave(next);
  };

  const addLink = () => {
    if (!canAdd) return;
    const link: ResearchLink = { Label: label.trim(), Url: normalizedUrl };
    if (note.trim() !== '') link.Note = note.trim();
    commit([...links, link]);
    setLabel('');
    setUrl('');
    setNote('');
  };

  const removeLink = (index: number) =>
    commit(links.filter((_, i) => i !== index));

  return (
    <ResponsiveDialog open={!!asset} onClose={onClose}>
      <DialogTitle>Research &amp; context</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            {asset.Name} · your own reference links, kept on this device (never
            fetched).
          </Typography>

          {links.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No links yet — add research pages, filings, or area reports below.
            </Typography>
          ) : (
            <Stack spacing={1}>
              {links.map((link, index) => (
                <Box
                  key={index}
                  sx={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 1,
                  }}
                >
                  <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Link
                      href={link.Url}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 0.5,
                      }}
                    >
                      {link.Label}
                      <OpenInNew fontSize="inherit" />
                    </Link>
                    {link.Note && (
                      <Typography variant="body2" color="text.secondary">
                        {link.Note}
                      </Typography>
                    )}
                  </Box>
                  <IconButton
                    aria-label={`Remove ${link.Label}`}
                    size="small"
                    onClick={() => removeLink(index)}
                  >
                    <Delete fontSize="small" />
                  </IconButton>
                </Box>
              ))}
            </Stack>
          )}

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <TextField
              label="Label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              size="small"
              fullWidth
              placeholder="Morningstar, Zillow, filing…"
            />
            <TextField
              label="URL"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              size="small"
              fullWidth
              placeholder="https://…"
              error={urlError}
              helperText={urlError ? 'Enter a valid http(s) link.' : ' '}
            />
          </Stack>
          <TextField
            label="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            size="small"
            fullWidth
            placeholder="Why it matters…"
          />
          <Box>
            <Button
              variant="outlined"
              size="small"
              startIcon={<Add />}
              onClick={addLink}
              disabled={!canAdd}
            >
              Add link
            </Button>
          </Box>
        </Box>
      </DialogContent>
    </ResponsiveDialog>
  );
};
