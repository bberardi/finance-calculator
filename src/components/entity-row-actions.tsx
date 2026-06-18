import { Box, IconButton } from '@mui/material';
import { ReactNode } from 'react';

// Shared row/card action buttons for the loan and investment tables (roadmap
// 0.7/0.10). Both tables render the same cluster of icon buttons — a couple of
// entity-specific tools plus Edit and Delete — laid out identically (spread on
// mobile cards, left-aligned in desktop table rows). This component owns that
// layout once; each table just supplies its own `actions` list.
//
// Defining it at module scope (rather than inline inside each table component)
// is deliberate: an inline component is a new type on every parent render, which
// makes React remount the whole button cluster — and its enclosing row/card —
// each time the table re-renders (e.g. when a popout opens).
export interface RowAction {
  icon: ReactNode;
  title: string;
  onClick: () => void;
  color?: 'primary' | 'error';
}

export interface EntityRowActionsProps {
  actions: RowAction[];
  isMobile?: boolean;
}

export const EntityRowActions = ({
  actions,
  isMobile = false,
}: EntityRowActionsProps) => (
  <Box
    sx={{
      display: 'flex',
      justifyContent: isMobile ? 'space-around' : 'flex-start',
      gap: isMobile ? 0 : 1,
    }}
  >
    {actions.map((action) => (
      <IconButton
        key={action.title}
        onClick={action.onClick}
        color={action.color ?? 'primary'}
        size={isMobile ? 'medium' : 'small'}
        title={action.title}
        aria-label={action.title}
      >
        {action.icon}
      </IconButton>
    ))}
  </Box>
);
