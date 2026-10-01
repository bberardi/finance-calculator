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

// A NaN key (or an Invalid Date, whose getTime() is NaN) has no order. Treating
// it as "equal" to everything makes the comparator non-transitive and lets the
// engine leave the whole column unsorted, so it gets a fixed slot instead. (#213)
const isNaNKey = (value: number | string): boolean =>
  typeof value === 'number' && Number.isNaN(value);

// -1 / 0 / 1 ordering of two sort values (ascending). NaN / Invalid Date keys
// sort after every valid key.
export const compareSortValues = (a: SortValue, b: SortValue): number => {
  const ca = toComparable(a);
  const cb = toComparable(b);
  const aNaN = isNaNKey(ca);
  const bNaN = isNaNKey(cb);
  if (aNaN || bNaN) return aNaN === bNaN ? 0 : aNaN ? 1 : -1;
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
  return [...items].sort((a, b) => {
    const va = selector(a);
    const vb = selector(b);
    // Unorderable keys stay at the end in both directions rather than flipping
    // to the top on a descending sort.
    const aNaN = isNaNKey(toComparable(va));
    const bNaN = isNaNKey(toComparable(vb));
    if (aNaN || bNaN) return compareSortValues(va, vb);
    return factor * compareSortValues(va, vb);
  });
};
