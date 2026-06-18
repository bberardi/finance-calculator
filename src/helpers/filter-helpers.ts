// Text search/filter for the loan & investment tables (roadmap 6.4). Pure and
// generic so the table UI stays a thin consumer: each table supplies the
// searchable fields for a row, and the same matching rule applies everywhere.

// Case-insensitive substring match of `query` against an item's searchable
// `fields`. An empty or whitespace-only query is the "no filter" state and
// matches everything, so the tables show all rows until the user types.
export const matchesQuery = (fields: string[], query: string): boolean => {
  const q = query.trim().toLowerCase();
  if (q === '') {
    return true;
  }
  return fields.some((field) => field.toLowerCase().includes(q));
};

// Filter `items` to those whose searchable fields match `query`. Order is
// preserved and the input array is never mutated.
export const filterBySearch = <T>(
  items: T[],
  query: string,
  getFields: (item: T) => string[]
): T[] => items.filter((item) => matchesQuery(getFields(item), query));
