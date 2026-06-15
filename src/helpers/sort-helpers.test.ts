import { describe, it, expect } from 'vitest';
import { compareSortValues, sortBy } from './sort-helpers';

describe('compareSortValues', () => {
  it('orders numbers, strings, and dates ascending', () => {
    expect(compareSortValues(1, 2)).toBe(-1);
    expect(compareSortValues(2, 1)).toBe(1);
    expect(compareSortValues('a', 'b')).toBe(-1);
    expect(compareSortValues(new Date(2020, 0, 1), new Date(2021, 0, 1))).toBe(
      -1
    );
  });

  it('returns 0 for equal values', () => {
    expect(compareSortValues(5, 5)).toBe(0);
    expect(compareSortValues('x', 'x')).toBe(0);
  });
});

describe('sortBy', () => {
  const rows = [
    { name: 'b', rate: 5 },
    { name: 'a', rate: 9 },
    { name: 'c', rate: 5 },
  ];

  it('sorts ascending and descending by a numeric selector', () => {
    expect(sortBy(rows, (r) => r.rate, 'asc').map((r) => r.rate)).toEqual([
      5, 5, 9,
    ]);
    expect(sortBy(rows, (r) => r.rate, 'desc').map((r) => r.rate)).toEqual([
      9, 5, 5,
    ]);
  });

  it('is stable for ties (preserves input order)', () => {
    // b and c both have rate 5; b precedes c in the input and should stay first.
    expect(sortBy(rows, (r) => r.rate, 'asc').map((r) => r.name)).toEqual([
      'b',
      'c',
      'a',
    ]);
  });

  it('does not mutate the input array', () => {
    const original = [...rows];
    sortBy(rows, (r) => r.rate, 'desc');
    expect(rows).toEqual(original);
  });
});
