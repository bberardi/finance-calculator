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
  IconButton,
} from '@mui/material';
import { Investment, CompoundingFrequency } from '../models/investment-model';
import { getInvestmentPeriods } from '../helpers/investment-helpers';
import { Calculate, Edit, TrendingUp } from '@mui/icons-material';
import { useState } from 'react';
import { PitPopout } from './pit-popout';
import { GrowthSchedulePopout } from './growth-schedule-popout';

export const InvestmentTable = (props: InvestmentTableProps) => {
  const [selectedPit, setSelectedPit] = useState<Investment | undefined>();
  const [selectedGrowth, setSelectedGrowth] = useState<
    Investment | undefined
  >();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString(undefined, {
      style: 'currency',
      currency: 'USD',
    });
  };

  const formatPercent = (rate: number) => {
    return `${rate.toFixed(3)}%`;
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

  const InvestmentActions = ({
    investment,
    isMobile = false,
  }: {
    investment: Investment;
    isMobile?: boolean;
  }) => (
    <Box
      sx={{
        display: 'flex',
        justifyContent: isMobile ? 'space-around' : 'flex-start',
        gap: isMobile ? 0 : 1,
      }}
    >
      <IconButton
        onClick={() => setSelectedGrowth(investment)}
        color="primary"
        size={isMobile ? 'medium' : 'small'}
        title="View Growth Schedule"
      >
        <TrendingUp />
      </IconButton>
      <IconButton
        onClick={() => setSelectedPit(investment)}
        color="primary"
        size={isMobile ? 'medium' : 'small'}
        title="Point-in-Time Calculator"
      >
        <Calculate />
      </IconButton>
      <IconButton
        onClick={() => props.onInvestmentEdit(investment)}
        color="primary"
        size={isMobile ? 'medium' : 'small'}
        title="Edit Investment"
      >
        <Edit />
      </IconButton>
    </Box>
  );

  const InvestmentCard = ({ investment }: { investment: Investment }) => (
    <Card
      sx={{
        marginBottom: 2,
        borderRadius: '12px',
        background: 'rgba(255, 255, 255, 0.7)',
        backdropFilter: 'blur(10px)',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
        border: '1px solid rgba(255, 255, 255, 0.5)',
        transition: 'all 0.3s ease',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: '0 8px 24px rgba(58, 123, 200, 0.15)',
        },
      }}
    >
      <CardContent>
        <Typography variant="h6" component="div">
          {investment.Name}
        </Typography>
        <Typography sx={{ mb: 1.5 }} color="text.secondary">
          {investment.Provider}
        </Typography>
        <Box sx={{ marginBottom: 1 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Typography variant="body2">
                <strong>Starting Balance:</strong>
              </Typography>
              <Typography variant="body2">
                {formatCurrency(investment.StartingBalance)}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="body2">
                <strong>Return Rate:</strong>
              </Typography>
              <Typography variant="body2">
                {formatPercent(investment.AverageReturnRate)}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="body2">
                <strong>Compounding:</strong>
              </Typography>
              <Typography variant="body2">
                {getCompoundingText(investment.CompoundingPeriod)}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="body2">
                <strong>Recurring:</strong>
              </Typography>
              <Typography variant="body2">
                {investment.RecurringContribution
                  ? formatCurrency(investment.RecurringContribution)
                  : 'None'}
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
          <InvestmentActions investment={investment} isMobile={isMobile} />
        </Box>
      </CardContent>
    </Card>
  );

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
            <InvestmentCard key={investment.Name} investment={investment} />
          ))}
        </Box>
      ) : (
        <TableContainer
          component={Paper}
          sx={{
            borderRadius: '12px',
            background: 'rgba(255, 255, 255, 0.5)',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.5)',
          }}
        >
          <Table>
            <TableHead>
              <TableRow
                sx={{
                  background:
                    'linear-gradient(135deg, #3a7bc8 0%, #2d5a8c 100%)',
                  '& .MuiTableCell-head': {
                    color: 'white',
                    fontWeight: 600,
                    fontSize: '0.95rem',
                    letterSpacing: '0.5px',
                  },
                }}
              >
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
                <TableRow
                  key={row.Name}
                  sx={{
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      backgroundColor: 'rgba(58, 123, 200, 0.08)',
                      transform: 'scale(1.01)',
                    },
                    '&:last-child td, &:last-child th': { border: 0 },
                  }}
                >
                  <TableCell>{row.Name}</TableCell>
                  <TableCell>{row.Provider}</TableCell>
                  <TableCell>{formatCurrency(row.StartingBalance)}</TableCell>
                  <TableCell>{formatPercent(row.AverageReturnRate)}</TableCell>
                  <TableCell>
                    {getCompoundingText(row.CompoundingPeriod)}
                  </TableCell>
                  <TableCell>
                    {row.RecurringContribution
                      ? formatCurrency(row.RecurringContribution)
                      : 'None'}
                  </TableCell>
                  <TableCell>
                    <InvestmentActions investment={row} isMobile={false} />
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
};
