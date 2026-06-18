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

  const isSelected = useCallback(
    (id: string) => selectedIds.has(id),
    [selectedIds]
  );

  return { selectedIds, isSelected, toggle, setMany, clear };
};
