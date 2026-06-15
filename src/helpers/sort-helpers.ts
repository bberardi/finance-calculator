// Generic, stable sorting for the data tables (Phase 3.3). Pure and
// framework-free (D7) so the comparator is unit-tested independently of the
// table UI. Numbers, strings, and dates are all comparable; callers map a row to
// one of those via a selector.

export type SortDirection = 'asc' | 'desc';
export type SortValue = number | string | Date;

const toComparable = (value: SortValue): number | string =>
  value instanceof Date ? value.getTime() : value;

// -1 / 0 / 1 ordering of two sort values (ascending).
export const compareSortValues = (a: SortValue, b: SortValue): number => {
  const ca = toComparable(a);
  const cb = toComparable(b);
  if (ca < cb) return -1;
  if (ca > cb) return 1;
  return 0;
};

/**
 * Return a new array sorted by `selector`. Stable (equal rows keep their input
 * order), so toggling the sorted column doesn't scramble ties. Never mutates the
 * input.
 */
export const sortBy = <T>(
  items: T[],
  selector: (item: T) => SortValue,
  direction: SortDirection
): T[] => {
  const factor = direction === 'asc' ? 1 : -1;
  return [...items].sort(
    (a, b) => factor * compareSortValues(selector(a), selector(b))
  );
};
