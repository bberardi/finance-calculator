import {
  Box,
  Card,
  CardContent,
  Checkbox,
  Typography,
  Grid,
} from '@mui/material';
import {
  Investment,
  CompoundingFrequency,
  StepUpType,
} from '../models/investment-model';
import { getInvestmentPeriods } from '../helpers/investment-helpers';
import { currentInvestmentValue } from '../helpers/forecast-helpers';
import { formatCurrency, formatPercent } from '../helpers/format-helpers';
import {
  Calculate,
  ContentCopy,
  Delete,
  Edit,
  TrendingUp,
} from '@mui/icons-material';
import { lazy, Suspense, useState } from 'react';
import { EntityRowActions, RowAction } from '../components/entity-row-actions';
import { DialogFallback } from '../components/dialog-fallback';
import { HoldingColumn, HoldingTable } from '../components/holding-table';

// Code-split the popouts (roadmap 6.6): modal, opened on demand, and pulling in
// date pickers + the table virtualizer — kept out of the initial bundle.
const PitPopout = lazy(() =>
  import('./pit-popout').then((m) => ({ default: m.PitPopout }))
);
const GrowthSchedulePopout = lazy(() =>
  import('./growth-schedule-popout').then((m) => ({
    default: m.GrowthSchedulePopout,
  }))
);

// Callbacks an investment row/card needs. Passed down from the table so the row
// and card components can live at module scope (no remount-on-render).
interface InvestmentRowHandlers {
  onGrowth: (investment: Investment) => void;
  onPit: (investment: Investment) => void;
  onEdit: (investment: Investment) => void;
  onClone: (investment: Investment) => void;
  onDelete: (investment: Investment) => void;
}

// Best-known current value for the table column and totals: the explicit
// CurrentValue when set, else the value the engine projects to today. Reuses
// the same anchor the dashboard's "Total assets" reads so the two never
// disagree for a past-dated investment with CurrentValue unset. (#125)
const currentValue = (investment: Investment): number =>
  currentInvestmentValue(investment);

const investmentActions = (
  investment: Investment,
  handlers: InvestmentRowHandlers
): RowAction[] => [
  {
    icon: <TrendingUp />,
    title: 'View Growth Schedule',
    onClick: () => handlers.onGrowth(investment),
  },
  {
    icon: <Calculate />,
    title: 'Point-in-Time Calculator',
    onClick: () => handlers.onPit(investment),
  },
  {
    icon: <Edit />,
    title: 'Edit Investment',
    onClick: () => handlers.onEdit(investment),
  },
  {
    icon: <ContentCopy />,
    title: 'Duplicate Investment',
    onClick: () => handlers.onClone(investment),
  },
  {
    icon: <Delete />,
    title: 'Delete Investment',
    onClick: () => handlers.onDelete(investment),
    color: 'error',
  },
];

const formatContribution = (investment: Investment): string => {
  if (!investment.RecurringContribution) return 'None';
  const base = formatCurrency(investment.RecurringContribution);
  if (
    !investment.ContributionStepUpType ||
    !investment.ContributionStepUpAmount
  )
    return base;
  const stepUp =
    investment.ContributionStepUpType === StepUpType.Flat
      ? `+${formatCurrency(investment.ContributionStepUpAmount)}/yr`
      : `+${formatPercent(investment.ContributionStepUpAmount)}/yr`;
  return `${base} (${stepUp})`;
};

const getCompoundingText = (period: CompoundingFrequency) => {
  switch (period) {
    case CompoundingFrequency.Monthly:
      return 'Monthly';
    case CompoundingFrequency.Quarterly:
      return 'Quarterly';
    case CompoundingFrequency.Annually:
      return 'Annually';
    default:
      return period;
  }
};

const sumBy = (items: Investment[], pick: (i: Investment) => number): string =>
  formatCurrency(items.reduce((sum, i) => sum + pick(i), 0));

const INVESTMENT_COLUMNS: HoldingColumn<Investment>[] = [
  {
    id: 'Name',
    label: 'Name',
    numeric: false,
    value: (i) => i.Name,
    render: (i) => i.Name,
    footer: () => <strong>Totals</strong>,
  },
  {
    id: 'Provider',
    label: 'Provider',
    numeric: false,
    value: (i) => i.Provider,
    render: (i) => i.Provider,
  },
  {
    id: 'StartingBalance',
    label: 'Starting Balance',
    numeric: true,
    value: (i) => i.StartingBalance,
    render: (i) => formatCurrency(i.StartingBalance),
    footer: (items) => (
      <strong>{sumBy(items, (i) => i.StartingBalance)}</strong>
    ),
  },
  {
    id: 'CurrentValue',
    label: 'Current Value',
    numeric: true,
    value: (i) => currentValue(i),
    render: (i) => formatCurrency(currentValue(i)),
    footer: (items) => <strong>{sumBy(items, (i) => currentValue(i))}</strong>,
  },
  {
    id: 'AverageReturnRate',
    label: 'Return Rate',
    numeric: true,
    value: (i) => i.AverageReturnRate,
    render: (i) => formatPercent(i.AverageReturnRate, 3),
  },
  {
    id: 'CompoundingPeriod',
    label: 'Compounding',
    numeric: false,
    value: (i) => getCompoundingText(i.CompoundingPeriod),
    render: (i) => getCompoundingText(i.CompoundingPeriod),
  },
  {
    id: 'RecurringContribution',
    label: 'Recurring Contribution',
    numeric: true,
    value: (i) => i.RecurringContribution ?? 0,
    render: (i) => formatContribution(i),
  },
];

// Stable accessors for HoldingTable's effect/memo dependencies.
const investmentId = (investment: Investment): string => investment.Id;
const investmentSearchFields = (investment: Investment): string[] => [
  investment.Name,
  investment.Provider,
];

const InvestmentCard = ({
  investment,
  handlers,
  isMobile,
  selected,
  onSelect,
}: {
  investment: Investment;
  handlers: InvestmentRowHandlers;
  isMobile: boolean;
  selected: boolean;
  onSelect: () => void;
}) => (
  <Card sx={{ marginBottom: 2 }}>
    <CardContent>
      <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
        <Checkbox
          checked={selected}
          onChange={onSelect}
          slotProps={{ input: { 'aria-label': `Select ${investment.Name}` } }}
          sx={{ mt: -1, ml: -1 }}
        />
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h6" component="div">
            {investment.Name}
          </Typography>
          <Typography sx={{ color: 'text.secondary', mb: 1.5 }}>
            {investment.Provider}
          </Typography>
        </Box>
      </Box>
      <Box sx={{ marginBottom: 1 }}>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Typography variant="body2">
              <strong>Starting Balance:</strong>
            </Typography>
            <Typography variant="body2">
              {formatCurrency(investment.StartingBalance)}
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Typography variant="body2">
              <strong>Current Value:</strong>
            </Typography>
            <Typography variant="body2">
              {formatCurrency(currentValue(investment))}
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Typography variant="body2">
              <strong>Return Rate:</strong>
            </Typography>
            <Typography variant="body2">
              {formatPercent(investment.AverageReturnRate, 3)}
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Typography variant="body2">
              <strong>Recurring:</strong>
            </Typography>
            <Typography variant="body2">
              {formatContribution(investment)}
            </Typography>
          </Grid>
        </Grid>
      </Box>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexDirection: { xs: 'column', sm: 'row' },
          gap: { xs: 1, sm: 0 },
        }}
      >
        <Typography variant="body2">
          <strong>Periods:</strong> {getInvestmentPeriods(investment)}
        </Typography>
        <EntityRowActions
          actions={investmentActions(investment, handlers)}
          isMobile={isMobile}
        />
      </Box>
    </CardContent>
  </Card>
);

export const InvestmentTable = (props: InvestmentTableProps) => {
  const [selectedPit, setSelectedPit] = useState<Investment | undefined>();
  const [selectedGrowth, setSelectedGrowth] = useState<
    Investment | undefined
  >();

  const handlers: InvestmentRowHandlers = {
    onGrowth: setSelectedGrowth,
    onPit: setSelectedPit,
    onEdit: props.onInvestmentEdit,
    onClone: props.onInvestmentClone,
    onDelete: props.onInvestmentDelete,
  };

  return (
    <>
      <Suspense fallback={<DialogFallback />}>
        {selectedPit && (
          <PitPopout
            investment={selectedPit}
            onClose={() => setSelectedPit(undefined)}
          />
        )}
        {selectedGrowth && (
          <GrowthSchedulePopout
            investment={selectedGrowth}
            onClose={() => setSelectedGrowth(undefined)}
          />
        )}
      </Suspense>

      <HoldingTable<Investment>
        items={props.investments}
        getRowId={investmentId}
        searchFields={investmentSearchFields}
        columns={INVESTMENT_COLUMNS}
        getRowName={(i) => i.Name}
        rowActions={(i) => investmentActions(i, handlers)}
        renderCard={({ item, selected, onSelect, isMobile }) => (
          <InvestmentCard
            investment={item}
            handlers={handlers}
            isMobile={isMobile}
            selected={selected}
            onSelect={onSelect}
          />
        )}
        // Default ordering: highest expected return first.
        defaultSortColumnId="AverageReturnRate"
        searchLabel="Search investments"
        itemLabel="investment"
        itemLabelPlural="investments"
        onBulkDuplicate={(items) =>
          items.forEach((i) => props.onInvestmentClone(i))
        }
        onBulkDelete={props.onInvestmentBulkDelete}
      />
    </>
  );
};

export type InvestmentTableProps = {
  investments: Investment[];
  onInvestmentEdit: (investment: Investment) => void;
  onInvestmentDelete: (investment: Investment) => void;
  onInvestmentClone: (investment: Investment) => void;
  onInvestmentBulkDelete: (investments: Investment[]) => void;
};
