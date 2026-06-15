import { describe, it, expect } from 'vitest';
import {
  NET_WORTH_COLOR,
  SCENARIO_SERIES_SUFFIX,
  baseSeriesId,
  getSeriesColor,
} from './series-colors';
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

  it('color-matches a scenario overlay to the solid line it shadows', () => {
    expect(getSeriesColor('loan-1' + SCENARIO_SERIES_SUFFIX)).toBe(
      getSeriesColor('loan-1')
    );
    expect(getSeriesColor(NET_WORTH_SERIES_ID + SCENARIO_SERIES_SUFFIX)).toBe(
      NET_WORTH_COLOR
    );
  });
});

describe('baseSeriesId', () => {
  it('strips the scenario suffix, leaving plain ids untouched', () => {
    expect(baseSeriesId('loan-1' + SCENARIO_SERIES_SUFFIX)).toBe('loan-1');
    expect(baseSeriesId('loan-1')).toBe('loan-1');
  });
});
