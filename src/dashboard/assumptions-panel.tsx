import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  List,
  ListItem,
  ListItemText,
  Typography,
} from '@mui/material';
import { ExpandMore, InfoOutlined } from '@mui/icons-material';

// What every forecast in the app assumes. A deterministic 30-year projection
// implies false precision; stating the assumptions is the honest framing that
// Monte Carlo (H2) and the inflation/tax toggles (H2/H4) later make statistical.
const ASSUMPTIONS: { title: string; detail: string }[] = [
  {
    title: 'Rates stay constant',
    detail:
      'Interest and return rates are held fixed for the whole projection — no rate changes, ARM resets, or promo expiries.',
  },
  {
    title: 'Average, not guaranteed',
    detail:
      'Investments grow at a single average rate. Real markets vary year to year; this is a midpoint, not a promise.',
  },
  {
    title: 'No taxes or inflation',
    detail:
      'Values are nominal and pre-tax. After-tax and real (inflation-adjusted) views are planned, not yet applied.',
  },
  {
    title: 'Anchored to today',
    detail:
      "Each line starts from a position's current balance or value, not a replay from its start date.",
  },
];

// Stated-assumptions panel (Phase 3.4): a small, always-available note on what
// the forecasts assume, collapsed by default so it informs without crowding.
export const AssumptionsPanel = () => (
  <Accordion
    disableGutters
    elevation={0}
    sx={{ backgroundColor: 'transparent', '&:before': { display: 'none' } }}
  >
    <AccordionSummary expandIcon={<ExpandMore />} sx={{ paddingX: 0 }}>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
      >
        <InfoOutlined fontSize="inherit" />
        What these forecasts assume
      </Typography>
    </AccordionSummary>
    <AccordionDetails sx={{ paddingX: 0 }}>
      <List dense disablePadding>
        {ASSUMPTIONS.map((assumption) => (
          <ListItem key={assumption.title} sx={{ paddingX: 0 }}>
            <ListItemText
              primary={assumption.title}
              secondary={assumption.detail}
              slotProps={{
                primary: { variant: 'body2', sx: { fontWeight: 600 } },
                secondary: { variant: 'caption' },
              }}
            />
          </ListItem>
        ))}
      </List>
    </AccordionDetails>
  </Accordion>
);
