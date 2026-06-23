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
  Card,
  CardContent,
  Typography,
  Grid,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { Asset, AssetType } from '../models/asset-model';
import { Loan } from '../models/loan-model';
import { forecastHomeEquity } from '../helpers/forecast-helpers';
import { isAssetLiability } from '../helpers/asset-helpers';
import { formatCurrency, formatPercent } from '../helpers/format-helpers';
import { sortBy, SortDirection, SortValue } from '../helpers/sort-helpers';
import { filterBySearch } from '../helpers/filter-helpers';
import { ContentCopy, Delete, Edit, SwapHoriz } from '@mui/icons-material';
import { EntityRowActions, RowAction } from '../components/entity-row-actions';
import { TableSearchField } from '../components/table-search-field';
import { BulkActionsToolbar } from '../components/bulk-actions-toolbar';
import { useRowSelection } from '../hooks/use-row-selection';

// Human-readable labels for each asset type, used in the table and cards.
const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  [AssetType.Cash]: 'Cash',
  [AssetType.Property]: 'Property',
  [AssetType.Investment]: 'Investment',
  [AssetType.CustomAsset]: 'Custom asset',
  [AssetType.CustomLiability]: 'Custom liability',
};

interface AssetRowHandlers {
  onEdit: (asset: Asset) => void;
  onClone: (asset: Asset) => void;
  onDelete: (asset: Asset) => void;
  // Cross-model conversion (custom liability → loan). Optional: only the
  // Liabilities table wires it, so the action is hidden in the Assets table.
  onConvertToLoan?: (asset: Asset) => void;
}

// An asset plus its engine-derived display value: today's home equity for a
// property linked to a mortgage (7.2), undefined for everything else.
interface AssetRow {
  asset: Asset;
  equity?: number;
}

const assetActions = (
  asset: Asset,
  handlers: AssetRowHandlers
): RowAction[] => {
  const actions: RowAction[] = [
    {
      icon: <Edit />,
      title: 'Edit',
      onClick: () => handlers.onEdit(asset),
    },
    {
      icon: <ContentCopy />,
      title: 'Duplicate',
      onClick: () => handlers.onClone(asset),
    },
  ];
  const { onConvertToLoan } = handlers;
  if (onConvertToLoan) {
    actions.push({
      icon: <SwapHoriz />,
      title: 'Convert to loan',
      onClick: () => onConvertToLoan(asset),
    });
  }
  actions.push({
    icon: <Delete />,
    title: 'Delete',
    onClick: () => handlers.onDelete(asset),
    color: 'error',
  });
  return actions;
};

type AssetColumnId =
  | 'Name'
  | 'Provider'
  | 'AssetType'
  | 'Balance'
  | 'GrowthRate';

interface AssetColumn {
  id: AssetColumnId;
  label: string;
  numeric: boolean;
  value: (row: AssetRow) => SortValue;
  render: (row: AssetRow) => ReactNode;
}

const equityText = (row: AssetRow): string =>
  row.equity === undefined ? '—' : formatCurrency(row.equity);

const AssetCard = ({
  row,
  handlers,
  selected,
  onSelect,
  showType,
}: {
  row: AssetRow;
  handlers: AssetRowHandlers;
  selected: boolean;
  onSelect: () => void;
  showType: boolean;
}) => {
  const { asset } = row;
  return (
    <Card sx={{ marginBottom: 2 }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
          <Checkbox
            checked={selected}
            onChange={onSelect}
            slotProps={{ input: { 'aria-label': `Select ${asset.Name}` } }}
            sx={{ mt: -1, ml: -1 }}
          />
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h6" component="div" gutterBottom>
              {asset.Name}
            </Typography>
            <Typography
              variant="body2"
              gutterBottom
              sx={{ color: 'text.secondary' }}
            >
              {asset.Provider}
              {showType ? ` · ${ASSET_TYPE_LABELS[asset.AssetType]}` : ''}
            </Typography>
          </Box>
        </Box>
        <Grid container spacing={2}>
          <Grid size={6}>
            <Typography variant="body2">
              <strong>{isAssetLiability(asset) ? 'Owed:' : 'Balance:'}</strong>{' '}
              {formatCurrency(asset.Balance)}
            </Typography>
          </Grid>
          <Grid size={6}>
            <Typography variant="body2">
              <strong>Rate:</strong> {formatPercent(asset.GrowthRate)}
            </Typography>
          </Grid>
          {row.equity !== undefined && (
            <Grid size={6}>
              <Typography variant="body2">
                <strong>Equity:</strong> {equityText(row)}
              </Typography>
            </Grid>
          )}
        </Grid>
        <Box sx={{ marginTop: 2 }}>
          <EntityRowActions actions={assetActions(asset, handlers)} isMobile />
        </Box>
      </CardContent>
    </Card>
  );
};

// Table of simple holdings (Phase 7). Reused for two groups with different
// framing: the Assets section (cash / property / custom assets — Type and Equity
// columns shown) and the Liabilities section's custom liabilities (a single
// type, so those columns are hidden and the labels read "liability"/"Owed").
export const AssetTable = (props: AssetTableProps) => {
  const {
    showTypeColumn = true,
    showEquityColumn = true,
    searchLabel = 'Search assets',
    itemLabel = 'asset',
    itemLabelPlural = 'assets',
    balanceHeader = 'Balance',
  } = props;

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [sortColumn, setSortColumn] = useState<AssetColumnId>('Balance');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const [query, setQuery] = useState('');
  const selection = useRowSelection();

  const { retain } = selection;
  useEffect(() => {
    retain(props.assets.map((a) => a.Id));
  }, [props.assets, retain]);

  const handlers: AssetRowHandlers = {
    onEdit: props.onAssetEdit,
    onClone: props.onAssetClone,
    onDelete: props.onAssetDelete,
    onConvertToLoan: props.onAssetConvertToLoan,
  };

  // Sortable data columns, built from props so the Type column can be dropped
  // and the balance header relabelled per group.
  const columns = useMemo<AssetColumn[]>(() => {
    const cols: AssetColumn[] = [
      {
        id: 'Name',
        label: 'Name',
        numeric: false,
        value: (r) => r.asset.Name,
        render: (r) => r.asset.Name,
      },
      {
        id: 'Provider',
        label: 'Provider',
        numeric: false,
        value: (r) => r.asset.Provider,
        render: (r) => r.asset.Provider,
      },
    ];
    if (showTypeColumn) {
      cols.push({
        id: 'AssetType',
        label: 'Type',
        numeric: false,
        value: (r) => ASSET_TYPE_LABELS[r.asset.AssetType],
        render: (r) => ASSET_TYPE_LABELS[r.asset.AssetType],
      });
    }
    cols.push(
      {
        id: 'Balance',
        label: balanceHeader,
        numeric: true,
        value: (r) => r.asset.Balance,
        render: (r) => formatCurrency(r.asset.Balance),
      },
      {
        id: 'GrowthRate',
        label: 'Rate',
        numeric: true,
        value: (r) => r.asset.GrowthRate,
        render: (r) => formatPercent(r.asset.GrowthRate),
      }
    );
    return cols;
  }, [showTypeColumn, balanceHeader]);

  // Engine-derived rows: today's home equity for a property linked to a
  // mortgage that still exists (7.2). Memoized so it recomputes only when the
  // assets or loans change.
  const today = useMemo(() => new Date(), []);
  const rows = useMemo<AssetRow[]>(() => {
    return props.assets.map((asset) => {
      const linkedLoan =
        asset.AssetType === AssetType.Property && asset.LinkedLoanId
          ? props.loans.find((l) => l.Id === asset.LinkedLoanId)
          : undefined;
      const equity = linkedLoan
        ? forecastHomeEquity(asset, linkedLoan, today, today)[0].Value
        : undefined;
      return { asset, equity };
    });
  }, [props.assets, props.loans, today]);

  const column = columns.find((c) => c.id === sortColumn) ?? columns[0];
  const sortedRows = useMemo(
    () => sortBy(rows, column.value, sortDirection),
    [rows, column, sortDirection]
  );

  const visibleRows = useMemo(
    () =>
      filterBySearch(sortedRows, query, (r) => [
        r.asset.Name,
        r.asset.Provider,
      ]),
    [sortedRows, query]
  );

  const handleSort = (id: AssetColumnId) => {
    if (sortColumn === id) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(id);
      setSortDirection('asc');
    }
  };

  const visibleAssets = visibleRows.map((r) => r.asset);
  const totalBalance = visibleAssets.reduce((sum, a) => sum + a.Balance, 0);

  const selectedAssets = props.assets.filter((a) => selection.isSelected(a.Id));
  const visibleIds = visibleRows.map((r) => r.asset.Id);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selection.isSelected(id));
  const someVisibleSelected = visibleIds.some((id) => selection.isSelected(id));

  const onBulkDuplicate = () => {
    selectedAssets.forEach((asset) => props.onAssetClone(asset));
    selection.clear();
  };
  const onBulkDelete = () => props.onAssetBulkDelete(selectedAssets);

  const noMatches = visibleRows.length === 0 && query.trim() !== '';

  return (
    <>
      <TableSearchField value={query} onChange={setQuery} label={searchLabel} />
      <BulkActionsToolbar
        count={selectedAssets.length}
        itemLabel={itemLabel}
        itemLabelPlural={itemLabelPlural}
        onDuplicate={onBulkDuplicate}
        onDelete={onBulkDelete}
        onClear={selection.clear}
      />

      {noMatches ? (
        <Typography color="text.secondary" sx={{ py: 2 }}>
          No {itemLabelPlural} match “{query}”.
        </Typography>
      ) : isMobile ? (
        <Box>
          {visibleRows.map((row) => (
            <AssetCard
              key={row.asset.Id}
              row={row}
              handlers={handlers}
              selected={selection.isSelected(row.asset.Id)}
              onSelect={() => selection.toggle(row.asset.Id)}
              showType={showTypeColumn}
            />
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
                    <TableSortLabel
                      active={sortColumn === col.id}
                      direction={sortColumn === col.id ? sortDirection : 'asc'}
                      onClick={() => handleSort(col.id)}
                    >
                      {col.label}
                    </TableSortLabel>
                  </TableCell>
                ))}
                {showEquityColumn && (
                  <TableCell align="right">Equity</TableCell>
                )}
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visibleRows.map((row) => {
                const isSelected = selection.isSelected(row.asset.Id);
                return (
                  <TableRow key={row.asset.Id} selected={isSelected}>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={isSelected}
                        onChange={() => selection.toggle(row.asset.Id)}
                        slotProps={{
                          input: {
                            'aria-label': `Select ${row.asset.Name}`,
                          },
                        }}
                      />
                    </TableCell>
                    {columns.map((col) => (
                      <TableCell
                        key={col.id}
                        align={col.numeric ? 'right' : 'left'}
                      >
                        {col.render(row)}
                      </TableCell>
                    ))}
                    {showEquityColumn && (
                      <TableCell align="right">{equityText(row)}</TableCell>
                    )}
                    <TableCell>
                      <EntityRowActions
                        actions={assetActions(row.asset, handlers)}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell padding="checkbox" />
                {columns.map((col) => {
                  if (col.id === 'Name') {
                    return (
                      <TableCell key={col.id}>
                        <strong>Totals</strong>
                      </TableCell>
                    );
                  }
                  if (col.id === 'Balance') {
                    return (
                      <TableCell key={col.id} align="right">
                        <strong>{formatCurrency(totalBalance)}</strong>
                      </TableCell>
                    );
                  }
                  return (
                    <TableCell
                      key={col.id}
                      align={col.numeric ? 'right' : 'left'}
                    />
                  );
                })}
                {showEquityColumn && <TableCell />}
                <TableCell />
              </TableRow>
            </TableFooter>
          </Table>
        </TableContainer>
      )}
    </>
  );
};

export type AssetTableProps = {
  assets: Asset[];
  loans: Loan[];
  onAssetEdit: (a: Asset) => void;
  onAssetDelete: (a: Asset) => void;
  onAssetClone: (a: Asset) => void;
  onAssetBulkDelete: (assets: Asset[]) => void;
  // Convert a custom liability into a loan (opens the loan form pre-filled).
  // Only supplied for the Liabilities table, so it is hidden elsewhere.
  onAssetConvertToLoan?: (a: Asset) => void;
  // Display tuning so the same table serves the Assets and Liabilities groups.
  showTypeColumn?: boolean;
  showEquityColumn?: boolean;
  searchLabel?: string;
  itemLabel?: string;
  itemLabelPlural?: string;
  balanceHeader?: string;
};
