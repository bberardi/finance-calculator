import { Key, ReactNode, RefObject } from 'react';
import { TableBody, TableCell, TableRow } from '@mui/material';
import { useVirtualizer } from '@tanstack/react-virtual';

// Row windowing for the schedule popouts (roadmap 6.5). A 50-year monthly loan
// is 600+ rows; rendering them all janks mobile scrolling. This renders only
// the rows in (and just around) the viewport, keeping the rest as two spacer
// rows that reserve the correct scroll height.
//
// The spacer-row technique keeps the markup a real <table> — semantic <tbody>,
// <tr>, <td> — so the sticky header, copy/paste, and screen-reader table
// semantics all keep working (unlike a div-based virtual list). Rows are
// measured (not assumed fixed-height) so a wrapped cell can't desync the
// scrollbar.
export interface VirtualizedTableBodyProps {
  // The scrollable ancestor the virtualizer measures against (the
  // TableContainer, given a bounded maxHeight + overflow).
  scrollRef: RefObject<HTMLElement | null>;
  // Number of body rows.
  count: number;
  // Columns spanned by the spacer rows (so they don't disturb the layout).
  colSpan: number;
  // Stable key for the row at `index`.
  rowKey: (index: number) => Key;
  // The <TableCell> children for the row at `index`.
  renderCells: (index: number) => ReactNode;
  // Estimated row height in px; refined by measurement after first paint.
  estimateRowHeight?: number;
}

const SPACER_SX = { padding: 0, border: 0 } as const;

export const VirtualizedTableBody = ({
  scrollRef,
  count,
  colSpan,
  rowKey,
  renderCells,
  estimateRowHeight = 53,
}: VirtualizedTableBodyProps) => {
  const virtualizer = useVirtualizer({
    count,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => estimateRowHeight,
    overscan: 10,
  });

  const items = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();
  // Reserve the off-screen height with one spacer row above and below the
  // rendered window, derived from the virtualizer's measured offsets.
  const paddingTop = items.length > 0 ? items[0].start : 0;
  const paddingBottom =
    items.length > 0 ? totalSize - items[items.length - 1].end : 0;

  return (
    <TableBody>
      {paddingTop > 0 && (
        <TableRow style={{ height: paddingTop }}>
          <TableCell colSpan={colSpan} sx={SPACER_SX} />
        </TableRow>
      )}
      {items.map((item) => (
        <TableRow
          key={rowKey(item.index)}
          data-index={item.index}
          ref={virtualizer.measureElement}
        >
          {renderCells(item.index)}
        </TableRow>
      ))}
      {paddingBottom > 0 && (
        <TableRow style={{ height: paddingBottom }}>
          <TableCell colSpan={colSpan} sx={SPACER_SX} />
        </TableRow>
      )}
    </TableBody>
  );
};
