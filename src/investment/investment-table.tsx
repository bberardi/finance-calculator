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
import { Investment } from '../models/investment-model';
import { getInvestmentPeriods } from '../helpers/investment-helpers';
import { Calculate, Edit, TrendingUp } from '@mui/icons-material';

export const InvestmentTable = (props: InvestmentTableProps) => {
  // const [selectedPit, setSelectedPit] = useState<Investment | undefined>();
  // const [selectedGrowth, setSelectedGrowth] = useState<Investment | undefined>();
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

  const getCompoundingText = (period: 'monthly' | 'quarterly' | 'annually') => {
    switch (period) {
      case 'monthly':
        return 'Monthly';
      case 'quarterly':
        return 'Quarterly';
      case 'annually':
        return 'Annually';
      default:
        return period;
    }
  };

  const InvestmentActions = ({ investment }: { investment: Investment }) => (
    <Box>
      <IconButton
        onClick={() => props.onInvestmentEdit(investment)}
        color="primary"
      >
        <Edit />
      </IconButton>
      <IconButton
        onClick={() => {/* TODO: setSelectedPit(investment) */}}
        color="secondary"
      >
        <Calculate />
      </IconButton>
      <IconButton
        onClick={() => {/* TODO: setSelectedGrowth(investment) */}}
        color="info"
      >
        <TrendingUp />
      </IconButton>
    </Box>
  );

  const InvestmentCard = ({ investment }: { investment: Investment }) => (
    <Card sx={{ marginBottom: 2 }}>
      <CardContent>
        <Typography variant="h6" component="div">
          {investment.Name}
        </Typography>
        <Typography sx={{ mb: 1.5 }} color="text.secondary">
          {investment.Provider}
        </Typography>
        <Box sx={{ marginBottom: 1 }}>
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <Typography variant="body2">
                <strong>Starting Balance:</strong>
              </Typography>
              <Typography variant="body2">
                {formatCurrency(investment.StartingBalance)}
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="body2">
                <strong>Return Rate:</strong>
              </Typography>
              <Typography variant="body2">
                {formatPercent(investment.AverageReturnRate)}
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="body2">
                <strong>Compounding:</strong>
              </Typography>
              <Typography variant="body2">
                {getCompoundingText(investment.CompoundingPeriod)}
              </Typography>
            </Grid>
            <Grid item xs={6}>
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
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="body2">
            <strong>Periods:</strong> {getInvestmentPeriods(investment)}
          </Typography>
          <InvestmentActions investment={investment} />
        </Box>
      </CardContent>
    </Card>
  );

  return (
    <>
      {/* TODO: Add PIT and Growth popouts similar to loans when needed */}
      
      {isMobile ? (
        <Box>
          {props.investments.map((investment) => (
            <InvestmentCard key={investment.Name} investment={investment} />
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
                <TableRow key={row.Name}>
                  <TableCell>{row.Name}</TableCell>
                  <TableCell>{row.Provider}</TableCell>
                  <TableCell>{formatCurrency(row.StartingBalance)}</TableCell>
                  <TableCell>{formatPercent(row.AverageReturnRate)}</TableCell>
                  <TableCell>{getCompoundingText(row.CompoundingPeriod)}</TableCell>
                  <TableCell>
                    {row.RecurringContribution 
                      ? formatCurrency(row.RecurringContribution)
                      : 'None'}
                  </TableCell>
                  <TableCell>
                    <InvestmentActions investment={row} />
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