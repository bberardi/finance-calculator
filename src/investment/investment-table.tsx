import {
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Paper,
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Investment,
  CompoundingFrequency,
  StepUpType,
} from '../models/investment-model';
import { getInvestmentPeriods } from '../helpers/investment-helpers';
import { formatCurrency, formatPercent } from '../helpers/format-helpers';
import { Calculate, Delete, Edit, TrendingUp } from '@mui/icons-material';
import { useState } from 'react';
import { PitPopout } from './pit-popout';
import { GrowthSchedulePopout } from './growth-schedule-popout';
import { EntityRowActions, RowAction } from '../components/entity-row-actions';

// Callbacks an investment row/card needs. Passed down from the table so the row
// and card components can live at module scope (no remount-on-render).
interface InvestmentRowHandlers {
  onGrowth: (investment: Investment) => void;
  onPit: (investment: Investment) => void;
  onEdit: (investment: Investment) => void;
  onDelete: (investment: Investment) => void;
}

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
      : `+${investment.ContributionStepUpAmount}%/yr`;
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

const InvestmentCard = ({
  investment,
  handlers,
  isMobile,
}: {
  investment: Investment;
  handlers: InvestmentRowHandlers;
  isMobile: boolean;
}) => (
  <Card sx={{ marginBottom: 2 }}>
    <CardContent>
      <Typography variant="h6" component="div">
        {investment.Name}
      </Typography>
      <Typography
        sx={{
          color: 'text.secondary',
          mb: 1.5,
        }}
      >
        {investment.Provider}
      </Typography>
      <Box sx={{ marginBottom: 1 }}>
        <Grid container spacing={2}>
          <Grid
            size={{
              xs: 12,
              sm: 6,
            }}
          >
            <Typography variant="body2">
              <strong>Starting Balance:</strong>
            </Typography>
            <Typography variant="body2">
              {formatCurrency(investment.StartingBalance)}
            </Typography>
          </Grid>
          <Grid
            size={{
              xs: 12,
              sm: 6,
            }}
          >
            <Typography variant="body2">
              <strong>Return Rate:</strong>
            </Typography>
            <Typography variant="body2">
              {formatPercent(investment.AverageReturnRate, 3)}
            </Typography>
          </Grid>
          <Grid
            size={{
              xs: 12,
              sm: 6,
            }}
          >
            <Typography variant="body2">
              <strong>Compounding:</strong>
            </Typography>
            <Typography variant="body2">
              {getCompoundingText(investment.CompoundingPeriod)}
            </Typography>
          </Grid>
          <Grid
            size={{
              xs: 12,
              sm: 6,
            }}
          >
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
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const handlers: InvestmentRowHandlers = {
    onGrowth: setSelectedGrowth,
    onPit: setSelectedPit,
    onEdit: props.onInvestmentEdit,
    onDelete: props.onInvestmentDelete,
  };

  return (
    <>
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

      {isMobile ? (
        <Box>
          {props.investments.map((investment) => (
            <InvestmentCard
              key={investment.Id}
              investment={investment}
              handlers={handlers}
              isMobile={isMobile}
            />
          ))}
        </Box>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Provider</TableCell>
                <TableCell>Starting Balance</TableCell>
                <TableCell>Return Rate</TableCell>
                <TableCell>Compounding</TableCell>
                <TableCell>Recurring Contribution</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {props.investments.map((row) => (
                <TableRow key={row.Id}>
                  <TableCell>{row.Name}</TableCell>
                  <TableCell>{row.Provider}</TableCell>
                  <TableCell>{formatCurrency(row.StartingBalance)}</TableCell>
                  <TableCell>
                    {formatPercent(row.AverageReturnRate, 3)}
                  </TableCell>
                  <TableCell>
                    {getCompoundingText(row.CompoundingPeriod)}
                  </TableCell>
                  <TableCell>{formatContribution(row)}</TableCell>
                  <TableCell>
                    <EntityRowActions
                      actions={investmentActions(row, handlers)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </>
  );
};

export type InvestmentTableProps = {
  investments: Investment[];
  onInvestmentEdit: (investment: Investment) => void;
  onInvestmentDelete: (investment: Investment) => void;
};
