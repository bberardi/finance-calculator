import { Box, Stack, Typography } from '@mui/material';

// Pinned lifetime-totals band for the schedule popouts (roadmap 6.5). Rendered
// below the (virtualized) scroll area rather than as an in-table <TableFooter>
// so the summary stays visible regardless of scroll position, and so it can't
// fall out of column alignment with windowed rows.
export interface ScheduleTotal {
  label: string;
  value: string;
}

export interface ScheduleTotalsFooterProps {
  items: ScheduleTotal[];
}

export const ScheduleTotalsFooter = ({ items }: ScheduleTotalsFooterProps) => (
  <Box
    sx={{
      mt: 1.5,
      px: 2,
      py: 1.5,
      borderRadius: 1,
      bgcolor: 'action.hover',
    }}
  >
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={{ xs: 1, sm: 4 }}
      sx={{ justifyContent: 'space-around', flexWrap: 'wrap' }}
    >
      {items.map((item) => (
        <Box key={item.label} sx={{ textAlign: { xs: 'left', sm: 'center' } }}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block' }}
          >
            {item.label}
          </Typography>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            {item.value}
          </Typography>
        </Box>
      ))}
    </Stack>
  </Box>
);
