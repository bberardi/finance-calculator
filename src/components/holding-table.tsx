import {
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableFooter,
  TableSortLabel,
  Checkbox,
  Paper,
  Box,
  Typography,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import { Fragment, ReactNode, useEffect, useMemo, useState } from 'react';
import { sortBy, SortDirection, SortValue } from '../helpers/sort-helpers';
import { filterBySearch } from '../helpers/filter-helpers';
import { EntityRowActions, RowAction } from './entity-row-actions';
import { TableSearchField } from './table-search-field';
import { BulkActionsToolbar } from './bulk-actions-toolbar';
import { useRowSelection } from '../hooks/use-row-selection';

// One column of a holdings table. `render` produces the body cell; `value`
// drives click-to-sort (omit it together with `sortable: false` for a derived,
// non-sortable column such as home equity); `footer`, when present, produces
// that column's cell in the totals row.
export interface HoldingColumn<T> {
  id: string;
  label: string;
  numeric: boolean;
  // Whether the column header is a sort control. Defaults to true; when true,
  // `value` must be supplied.
  sortable?: boolean;
  value?: (item: T) => SortValue;
  render: (item: T) => ReactNode;
  footer?: (items: T[]) => ReactNode;
}

export interface HoldingTableProps<T> {
  items: T[];
  // Stable (module-scoped/memoized) accessors — they feed effect/memo deps.
  getRowId: (item: T) => string;
  searchFields: (item: T) => string[];
  columns: HoldingColumn<T>[];
  // Render-time only (not in any dependency array), so inline closures are fine.
  getRowName: (item: T) => string;
  rowActions: (item: T) => RowAction[];
  renderCard: (args: {
    item: T;
    selected: boolean;
    onSelect: () => void;
    isMobile: boolean;
  }) => ReactNode;
  defaultSortColumnId: string;
  defaultSortDirection?: SortDirection;
  searchLabel: string;
  itemLabel: string;
  itemLabelPlural: string;
  // The selection is cleared after a duplicate (the originals stay) but left
  // as-is after a delete (confirmed deletions drop out of the count on their
  // own, via the parent's confirm + soft-undo flow).
  onBulkDuplicate: (items: T[]) => void;
  onBulkDelete: (items: T[]) => void;
}

// The shared scaffolding behind the investment and asset tables (roadmap 6.4):
// text search, multi-select with a bulk-action toolbar, click-to-sort columns,
// a responsive card/table switch, and a totals footer. Everything specific to a
// holding kind — its columns, cell/footer content, card layout, and row
// actions — is supplied by the caller, so both tables share one consistent,
// single-source-of-truth implementation of the chrome.
export function HoldingTable<T>({
  items,
  getRowId,
  searchFields,
  columns,
  getRowName,
  rowActions,
  renderCard,
  defaultSortColumnId,
  defaultSortDirection = 'desc',
  searchLabel,
  itemLabel,
  itemLabelPlural,
  onBulkDuplicate,
  onBulkDelete,
}: HoldingTableProps<T>) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [sortColumn, setSortColumn] = useState(defaultSortColumnId);
  const [sortDirection, setSortDirection] =
    useState<SortDirection>(defaultSortDirection);

  const [query, setQuery] = useState('');
  const selection = useRowSelection();

  // Keep the selection in sync with the rows that currently exist: a deleted
  // row leaves the Set, so a bulk-delete undo restores rows unselected instead
  // of re-selecting them (PR #109 review follow-up).
  const { retain } = selection;
  useEffect(() => {
    retain(items.map(getRowId));
  }, [items, getRowId, retain]);

  const column = columns.find((c) => c.id === sortColumn) ?? columns[0];
  const sortedItems = useMemo(
    () => sortBy(items, column.value ?? (() => 0), sortDirection),
    [items, column, sortDirection]
  );

  const visibleItems = useMemo(
    () => filterBySearch(sortedItems, query, searchFields),
    [sortedItems, query, searchFields]
  );

  const handleSort = (id: string) => {
    if (sortColumn === id) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(id);
      setSortDirection('asc');
    }
  };

  // Effective selection: selected rows that still exist.
  const selectedItems = items.filter((i) => selection.isSelected(getRowId(i)));
  const visibleIds = visibleItems.map(getRowId);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selection.isSelected(id));
  const someVisibleSelected = visibleIds.some((id) => selection.isSelected(id));

  const handleBulkDuplicate = () => {
    onBulkDuplicate(selectedItems);
    selection.clear();
  };
  const handleBulkDelete = () => onBulkDelete(selectedItems);

  const noMatches = visibleItems.length === 0 && query.trim() !== '';

  return (
    <>
      <TableSearchField value={query} onChange={setQuery} label={searchLabel} />
      <BulkActionsToolbar
        count={selectedItems.length}
        itemLabel={itemLabel}
        itemLabelPlural={itemLabelPlural}
        onDuplicate={handleBulkDuplicate}
        onDelete={handleBulkDelete}
        onClear={selection.clear}
      />

      {noMatches ? (
        <Typography color="text.secondary" sx={{ py: 2 }}>
          No {itemLabelPlural} match “{query}”.
        </Typography>
      ) : isMobile ? (
        <Box>
          {visibleItems.map((item) => (
            <Fragment key={getRowId(item)}>
              {renderCard({
                item,
                selected: selection.isSelected(getRowId(item)),
                onSelect: () => selection.toggle(getRowId(item)),
                isMobile,
              })}
            </Fragment>
          ))}
        </Box>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={allVisibleSelected}
                    indeterminate={someVisibleSelected && !allVisibleSelected}
                    onChange={(e) =>
                      selection.setMany(visibleIds, e.target.checked)
                    }
                    slotProps={{
                      input: { 'aria-label': `Select all ${itemLabelPlural}` },
                    }}
                  />
                </TableCell>
                {columns.map((col) => (
                  <TableCell
                    key={col.id}
                    align={col.numeric ? 'right' : 'left'}
                    sortDirection={
                      sortColumn === col.id ? sortDirection : false
                    }
                  >
                    {col.sortable === false ? (
                      col.label
                    ) : (
                      <TableSortLabel
                        active={sortColumn === col.id}
                        direction={
                          sortColumn === col.id ? sortDirection : 'asc'
                        }
                        onClick={() => handleSort(col.id)}
                      >
                        {col.label}
                      </TableSortLabel>
                    )}
                  </TableCell>
                ))}
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visibleItems.map((item) => {
                const id = getRowId(item);
                const isSelected = selection.isSelected(id);
                return (
                  <TableRow key={id} selected={isSelected}>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={isSelected}
                        onChange={() => selection.toggle(id)}
                        slotProps={{
                          input: { 'aria-label': `Select ${getRowName(item)}` },
                        }}
                      />
                    </TableCell>
                    {columns.map((col) => (
                      <TableCell
                        key={col.id}
                        align={col.numeric ? 'right' : 'left'}
                      >
                        {col.render(item)}
                      </TableCell>
                    ))}
                    <TableCell>
                      <EntityRowActions actions={rowActions(item)} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell padding="checkbox" />
                {columns.map((col) => (
                  <TableCell
                    key={col.id}
                    align={col.numeric ? 'right' : 'left'}
                  >
                    {col.footer ? col.footer(visibleItems) : null}
                  </TableCell>
                ))}
                <TableCell />
              </TableRow>
            </TableFooter>
          </Table>
        </TableContainer>
      )}
    </>
  );
}
