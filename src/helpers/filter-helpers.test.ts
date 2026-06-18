import { describe, it, expect } from 'vitest';
import { matchesQuery, filterBySearch } from './filter-helpers';

describe('matchesQuery', () => {
  it('matches everything for an empty or whitespace-only query', () => {
    expect(matchesQuery(['anything'], '')).toBe(true);
    expect(matchesQuery(['anything'], '   ')).toBe(true);
    // Even with no fields, the "no filter" state matches.
    expect(matchesQuery([], '')).toBe(true);
  });

  it('is case-insensitive and matches substrings', () => {
    expect(matchesQuery(['Chase Mortgage'], 'mort')).toBe(true);
    expect(matchesQuery(['Chase Mortgage'], 'CHASE')).toBe(true);
    expect(matchesQuery(['Chase Mortgage'], 'ge')).toBe(true);
  });

  it('matches when any one field contains the query', () => {
    expect(matchesQuery(['Car loan', 'Toyota'], 'toyo')).toBe(true);
    expect(matchesQuery(['Car loan', 'Toyota'], 'loan')).toBe(true);
  });

  it('trims surrounding whitespace from the query before matching', () => {
    expect(matchesQuery(['Brokerage'], '  broker  ')).toBe(true);
  });

  it('returns false when no field contains the query', () => {
    expect(matchesQuery(['Car loan', 'Toyota'], 'mortgage')).toBe(false);
    // A non-empty query against no fields cannot match.
    expect(matchesQuery([], 'x')).toBe(false);
  });
});

describe('filterBySearch', () => {
  const rows = [
    { Id: '1', Name: 'Chase Mortgage', Provider: 'Chase' },
    { Id: '2', Name: 'Car loan', Provider: 'Toyota' },
    { Id: '3', Name: 'Brokerage', Provider: 'Fidelity' },
  ];
  const fields = (r: (typeof rows)[number]) => [r.Name, r.Provider];

  it('returns all items for an empty query', () => {
    expect(filterBySearch(rows, '', fields)).toEqual(rows);
  });

  it('filters to items matching name or provider', () => {
    expect(filterBySearch(rows, 'toyota', fields).map((r) => r.Id)).toEqual([
      '2',
    ]);
    expect(filterBySearch(rows, 'a', fields).map((r) => r.Id)).toEqual([
      '1',
      '2',
      '3',
    ]);
  });

  it('returns an empty array when nothing matches', () => {
    expect(filterBySearch(rows, 'zzz', fields)).toEqual([]);
  });

  it('preserves order and does not mutate the input', () => {
    const original = [...rows];
    const result = filterBySearch(rows, 'e', fields);
    // 'Chase Mortgage'/'Chase' and 'Brokerage'/'Fidelity' contain 'e'.
    expect(result.map((r) => r.Id)).toEqual(['1', '3']);
    expect(rows).toEqual(original);
  });
});
