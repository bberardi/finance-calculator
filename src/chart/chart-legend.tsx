import { Box, Button, Chip, Stack } from '@mui/material';

export interface LegendItem {
  id: string;
  label: string;
  color: string;
}

interface ChartLegendProps {
  items: LegendItem[];
  hiddenIds: Set<string>;
  onToggle: (id: string) => void;
  onShowAll: () => void;
}

// Interactive chart legend (Phase 2.3). Each series is a toggle chip: click (or
// keyboard-activate) to show/hide that line. Chips wrap so 10+ entities stay
// usable, and a "Show all" affordance appears once anything is hidden. Built as
// real buttons with `aria-pressed`, so it doubles as the keyboard-operable
// legend the Phase 6 a11y pass needs.
export const ChartLegend = ({
  items,
  hiddenIds,
  onToggle,
  onShowAll,
}: ChartLegendProps) => {
  const anyHidden = items.some((item) => hiddenIds.has(item.id));

  return (
    <Stack
      direction="row"
      spacing={1}
      useFlexGap
      sx={{ marginTop: 2, flexWrap: 'wrap', alignItems: 'center' }}
      role="group"
      aria-label="Toggle forecast series"
    >
      {items.map((item) => {
        const hidden = hiddenIds.has(item.id);
        return (
          <Chip
            key={item.id}
            label={item.label}
            variant="outlined"
            clickable
            onClick={() => onToggle(item.id)}
            aria-pressed={!hidden}
            icon={
              <Box
                component="span"
                sx={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  marginLeft: '8px',
                  backgroundColor: hidden ? 'action.disabled' : item.color,
                }}
              />
            }
            sx={{
              opacity: hidden ? 0.6 : 1,
              '& .MuiChip-label': {
                textDecoration: hidden ? 'line-through' : 'none',
              },
            }}
          />
        );
      })}
      {anyHidden && (
        <Button size="small" onClick={onShowAll}>
          Show all
        </Button>
      )}
    </Stack>
  );
};
