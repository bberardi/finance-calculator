// Generic, stable sorting for the data tables (Phase 3.3). Pure and
// framework-free (D7) so the comparator is unit-tested independently of the
// table UI. Numbers, strings, and dates are all comparable; callers map a row to
// one of those via a selector.

export type SortDirection = 'asc' | 'desc';
export type SortValue = number | string | Date;

// Human-friendly string ordering for table columns: case/accent-insensitive
// (so "chase savings" doesn't sink below every capitalized name) and
// numeric-aware (so "Loan 2" precedes "Loan 10"). One shared collator —
// construction is expensive and comparisons run per row. 'en-US' matches the
// locale format-helpers already pins.
const stringCollator = new Intl.Collator('en-US', {
  numeric: true,
  sensitivity: 'base',
});

const toComparable = (value: SortValue): number | string =>
  value instanceof Date ? value.getTime() : value;

// -1 / 0 / 1 ordering of two sort values (ascending).
export const compareSortValues = (a: SortValue, b: SortValue): number => {
  const ca = toComparable(a);
  const cb = toComparable(b);
  if (typeof ca === 'string' && typeof cb === 'string') {
    return Math.sign(stringCollator.compare(ca, cb));
  }
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
