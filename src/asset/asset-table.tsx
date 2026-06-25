import {
  Box,
  Card,
  CardContent,
  Checkbox,
  Typography,
  Grid,
} from '@mui/material';
import { useMemo } from 'react';
import { Asset, AssetType } from '../models/asset-model';
import { Loan } from '../models/loan-model';
import { forecastHomeEquity } from '../helpers/forecast-helpers';
import { isAssetLiability } from '../helpers/asset-helpers';
import { formatCurrency, formatPercent } from '../helpers/format-helpers';
import { ContentCopy, Delete, Edit, SwapHoriz } from '@mui/icons-material';
import { EntityRowActions, RowAction } from '../components/entity-row-actions';
import { HoldingColumn, HoldingTable } from '../components/holding-table';

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

const equityText = (row: AssetRow): string =>
  row.equity === undefined ? '—' : formatCurrency(row.equity);

// Stable accessors for HoldingTable's effect/memo dependencies.
const assetRowId = (row: AssetRow): string => row.asset.Id;
const assetSearchFields = (row: AssetRow): string[] => [
  row.asset.Name,
  row.asset.Provider,
];

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
// All the shared table chrome lives in HoldingTable; this configures it.
export const AssetTable = (props: AssetTableProps) => {
  const {
    showTypeColumn = true,
    showEquityColumn = true,
    searchLabel = 'Search assets',
    itemLabel = 'asset',
    itemLabelPlural = 'assets',
    balanceHeader = 'Balance',
  } = props;

  const handlers: AssetRowHandlers = {
    onEdit: props.onAssetEdit,
    onClone: props.onAssetClone,
    onDelete: props.onAssetDelete,
    onConvertToLoan: props.onAssetConvertToLoan,
  };

  // Sortable data columns, built from props so the Type column can be dropped
  // and the balance header relabelled per group. The Equity column is derived
  // (home equity) and therefore non-sortable.
  const columns = useMemo<HoldingColumn<AssetRow>[]>(() => {
    const cols: HoldingColumn<AssetRow>[] = [
      {
        id: 'Name',
        label: 'Name',
        numeric: false,
        value: (r) => r.asset.Name,
        render: (r) => r.asset.Name,
        footer: () => <strong>Totals</strong>,
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
        footer: (rows) => (
          <strong>
            {formatCurrency(rows.reduce((sum, r) => sum + r.asset.Balance, 0))}
          </strong>
        ),
      },
      {
        id: 'GrowthRate',
        label: 'Rate',
        numeric: true,
        value: (r) => r.asset.GrowthRate,
        render: (r) => formatPercent(r.asset.GrowthRate),
      }
    );
    if (showEquityColumn) {
      cols.push({
        id: 'Equity',
        label: 'Equity',
        numeric: true,
        sortable: false,
        render: (r) => equityText(r),
      });
    }
    return cols;
  }, [showTypeColumn, showEquityColumn, balanceHeader]);

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

  return (
    <HoldingTable<AssetRow>
      items={rows}
      getRowId={assetRowId}
      searchFields={assetSearchFields}
      columns={columns}
      getRowName={(r) => r.asset.Name}
      rowActions={(r) => assetActions(r.asset, handlers)}
      renderCard={({ item, selected, onSelect }) => (
        <AssetCard
          row={item}
          handlers={handlers}
          selected={selected}
          onSelect={onSelect}
          showType={showTypeColumn}
        />
      )}
      defaultSortColumnId="Balance"
      searchLabel={searchLabel}
      itemLabel={itemLabel}
      itemLabelPlural={itemLabelPlural}
      onBulkDuplicate={(selected) =>
        selected.forEach((r) => props.onAssetClone(r.asset))
      }
      onBulkDelete={(selected) =>
        props.onAssetBulkDelete(selected.map((r) => r.asset))
      }
    />
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
