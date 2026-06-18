import { useCallback, useState } from 'react';

// Multi-select state for the loan/investment tables (roadmap 6.4). Selection is
// tracked by entity Id (a Set) so it survives sorting and filtering — a selected
// row stays selected even when it scrolls out of the current filtered view.
export interface RowSelection {
  selectedIds: Set<string>;
  isSelected: (id: string) => boolean;
  toggle: (id: string) => void;
  // Add or remove a batch of ids at once (used by the header "select all").
  setMany: (ids: string[], selected: boolean) => void;
  // Drop any selected ids that are not in `ids` — used to keep the selection in
  // sync with the rows that currently exist, so a deleted row leaves the Set
  // (and an undo restores it unselected rather than re-selecting it).
  retain: (ids: string[]) => void;
  clear: () => void;
}

export const useRowSelection = (): RowSelection => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const setMany = useCallback((ids: string[], selected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (selected) {
          next.add(id);
        } else {
          next.delete(id);
        }
      }
      return next;
    });
  }, []);

  const clear = useCallback(() => setSelectedIds(new Set()), []);

  const retain = useCallback((ids: string[]) => {
    const keep = new Set(ids);
    setSelectedIds((prev) => {
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (keep.has(id)) {
          next.add(id);
        } else {
          changed = true;
        }
      }
      // Return the same reference when nothing was pruned so this is a no-op
      // render (the effect that calls it runs on every rows change).
      return changed ? next : prev;
    });
  }, []);

  const isSelected = useCallback(
    (id: string) => selectedIds.has(id),
    [selectedIds]
  );

  return { selectedIds, isSelected, toggle, setMany, retain, clear };
};
