import { NET_WORTH_SERIES_ID } from '../helpers/forecast-series';

// Stable per-entity chart colors (Phase 2.2). Color is derived from the entity's
// Id, so a given loan/investment keeps the same color across re-renders and as
// other entities are added or removed — and Phase 4's dotted scenario overlay
// can reuse the exact color of the solid line it shadows by passing the same Id.
//
// The aggregate net-worth line gets a fixed, emphasized brand-green so the
// headline series stands apart from the entity palette.

export const NET_WORTH_COLOR = '#2e7d32';

// Suffix marking a scenario-overlay series (Phase 4.3). Underscores keep the id
// valid inside the `MuiLineElement-series-<id>` CSS class the chart targets.
export const SCENARIO_SERIES_SUFFIX = '__scenario';

// The underlying entity (or net-worth) id behind a series id, with any scenario
// suffix stripped — so a scenario overlay color-matches the solid line it shadows.
export const baseSeriesId = (id: string): string =>
  id.endsWith(SCENARIO_SERIES_SUFFIX)
    ? id.slice(0, -SCENARIO_SERIES_SUFFIX.length)
    : id;

// A categorical palette chosen for separation and readable contrast in both
// light and dark mode. Entities cycle through it by a hash of their Id.
const ENTITY_PALETTE = [
  '#1976d2', // blue
  '#9c27b0', // purple
  '#ed6c02', // orange
  '#0288d1', // light blue
  '#c2185b', // pink
  '#00796b', // teal
  '#5d4037', // brown
  '#7b1fa2', // deep purple
  '#f9a825', // amber
  '#455a64', // blue grey
];

// Deterministic, order-independent hash of an Id so color survives reordering.
const hashId = (id: string): number => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
};

export const getSeriesColor = (id: string): string => {
  const base = baseSeriesId(id);
  return base === NET_WORTH_SERIES_ID
    ? NET_WORTH_COLOR
    : ENTITY_PALETTE[hashId(base) % ENTITY_PALETTE.length];
};
