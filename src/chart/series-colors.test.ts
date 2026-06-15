import { describe, it, expect } from 'vitest';
import { NET_WORTH_COLOR, getSeriesColor } from './series-colors';
import { NET_WORTH_SERIES_ID } from '../helpers/forecast-series';

describe('getSeriesColor', () => {
  it('gives the net-worth line its fixed emphasized color', () => {
    expect(getSeriesColor(NET_WORTH_SERIES_ID)).toBe(NET_WORTH_COLOR);
  });

  it('is deterministic per id (stable across renders / reordering)', () => {
    expect(getSeriesColor('loan-1')).toBe(getSeriesColor('loan-1'));
  });

  it('returns a palette color for entities, distinct from net worth', () => {
    const color = getSeriesColor('inv-42');
    expect(color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(color).not.toBe(NET_WORTH_COLOR);
  });
});
