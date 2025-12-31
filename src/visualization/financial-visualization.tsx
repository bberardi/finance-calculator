import {
  Paper,
  Typography,
  Box,
  FormGroup,
  FormControlLabel,
  Checkbox,
  TextField,
  Grid,
} from '@mui/material';
import { LineChart } from '@mui/x-charts/LineChart';
import { Loan } from '../models/loan-model';
import { Investment } from '../models/investment-model';
import { generateVisualizationData, getMaxVisualizationDate } from '../helpers/visualization-helpers';
import { useState, useMemo, useEffect } from 'react';
import dayjs from 'dayjs';

export type FinancialVisualizationProps = {
  loans: Loan[];
  investments: Investment[];
};

export const FinancialVisualization = ({
  loans,
  investments,
}: FinancialVisualizationProps) => {
  // Calculate default date range
  const defaultEndDate = useMemo(() => {
    return getMaxVisualizationDate(loans, investments);
  }, [loans, investments]);

  const defaultStartYear = new Date().getFullYear();
  const defaultEndYear = defaultEndDate.getFullYear();

  // State for year selectors
  const [startYear, setStartYear] = useState<number>(defaultStartYear);
  const [endYear, setEndYear] = useState<number>(defaultEndYear);

  // Update year range when loans/investments change
  useEffect(() => {
    const newEndDate = getMaxVisualizationDate(loans, investments);
    setStartYear(new Date().getFullYear());
    setEndYear(newEndDate.getFullYear());
  }, [loans, investments]);

  // State to track which lines are visible
  const [visibleLines, setVisibleLines] = useState<{
    [key: string]: boolean;
  }>({});

  // Update visible lines when loans or investments change
  useEffect(() => {
    setVisibleLines((prev) => {
      // Build the list of keys that should exist based on current data
      const validKeys: string[] = [];

      loans.forEach((loan) => {
        validKeys.push(`loan-${loan.Id}`);
      });

      investments.forEach((investment) => {
        validKeys.push(`investment-${investment.Id}`);
      });

      validKeys.push('total-loans', 'total-investments', 'overall-position');

      // Create a new visibleLines object that only includes valid keys
      // Preserve existing visibility where possible; default new keys to true
      const newVisibleLines: { [key: string]: boolean } = {};
      validKeys.forEach((key) => {
        newVisibleLines[key] = prev[key] ?? true;
      });

      return newVisibleLines;
    });
  }, [loans, investments]);

  // Generate visualization data based on selected year range
  const visualizationData = useMemo(() => {
    const start = dayjs().year(startYear).startOf('year').toDate();
    const end = dayjs().year(endYear).endOf('year').toDate();
    return generateVisualizationData(loans, investments, start, end);
  }, [loans, investments, startYear, endYear]);

  // Build series data and legend items (memoized for performance)
  // Note: loans and investments are not in the dependency array because they're
  // already captured through visualizationData (which depends on them)
  const { series, legendItems } = useMemo(() => {
    const seriesData: {
      id: string;
      label: string;
      data: number[];
      curve: 'linear';
      showMark: boolean;
      color: string;
    }[] = [];
    const legendData: { id: string; label: string; color: string }[] = [];

    // Add individual loan series
    loans.forEach((loan) => {
      const lineKey = `loan-${loan.Id}`;
      const isVisible = visibleLines[lineKey] ?? true;

      if (isVisible) {
        seriesData.push({
          id: lineKey,
          label: `${loan.Name} (Loan)`,
          data: visualizationData.map(
            (point) => point.loanValues[loan.Id] || 0
          ),
          curve: 'linear',
          showMark: false,
          color: '#d32f2f', // Red for loans
        });
      }

      legendData.push({
        id: lineKey,
        label: `${loan.Name} (Loan)`,
        color: '#d32f2f',
      });
    });

    // Add individual investment series
    investments.forEach((investment) => {
      const lineKey = `investment-${investment.Id}`;
      const isVisible = visibleLines[lineKey] ?? true;

      if (isVisible) {
        seriesData.push({
          id: lineKey,
          label: `${investment.Name} (Investment)`,
          data: visualizationData.map(
            (point) => point.investmentValues[investment.Id] || 0
          ),
          curve: 'linear',
          showMark: false,
          color: '#2e7d32', // Green for investments
        });
      }

      legendData.push({
        id: lineKey,
        label: `${investment.Name} (Investment)`,
        color: '#2e7d32',
      });
    });

    // Add total loan line
    if (loans.length > 0) {
      const lineKey = 'total-loans';
      const isVisible = visibleLines[lineKey] ?? true;

      if (isVisible) {
        seriesData.push({
          id: lineKey,
          label: 'Total Loans',
          data: visualizationData.map((point) => point.totalLoanValue),
          curve: 'linear',
          showMark: false,
          color: '#c62828',
        });
      }

      legendData.push({
        id: lineKey,
        label: 'Total Loans',
        color: '#c62828',
      });
    }

    // Add total investment line
    if (investments.length > 0) {
      const lineKey = 'total-investments';
      const isVisible = visibleLines[lineKey] ?? true;

      if (isVisible) {
        seriesData.push({
          id: lineKey,
          label: 'Total Investments',
          data: visualizationData.map((point) => point.totalInvestmentValue),
          curve: 'linear',
          showMark: false,
          color: '#1b5e20',
        });
      }

      legendData.push({
        id: lineKey,
        label: 'Total Investments',
        color: '#1b5e20',
      });
    }

    // Add overall position line
    const overallLineKey = 'overall-position';
    const isOverallVisible = visibleLines[overallLineKey] ?? true;

    if (isOverallVisible) {
      seriesData.push({
        id: overallLineKey,
        label: 'Overall Position',
        data: visualizationData.map((point) => point.overallPosition),
        curve: 'linear',
        showMark: false,
        color: '#1976d2', // Blue for overall
      });
    }

    legendData.push({
      id: overallLineKey,
      label: 'Overall Position',
      color: '#1976d2',
    });

    return { series: seriesData, legendItems: legendData };
  }, [visibleLines, visualizationData, loans, investments]);

  // If no data, show message
  if (loans.length === 0 && investments.length === 0) {
    return (
      <Paper sx={{ padding: '20px', marginBottom: '20px' }}>
        <Typography variant="h6" gutterBottom>
          Financial Position Over Time
        </Typography>
        <Typography>
          Add loans and investments to see your financial position visualized
          over time.
        </Typography>
      </Paper>
    );
  }

  // Prepare data for the chart
  const xAxisData = visualizationData.map((point) => point.date);

  // Handle checkbox change to toggle visibility
  const handleToggleLine = (lineId: string) => {
    setVisibleLines((prev) => ({
      ...prev,
      [lineId]: !prev[lineId],
    }));
  };

  return (
    <Paper sx={{ padding: '20px', marginBottom: '20px' }}>
      <Typography variant="h6" gutterBottom>
        Financial Position Over Time
      </Typography>
      
      {/* Year Range Selectors */}
      <Box sx={{ marginBottom: '20px' }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              label="Start Year"
              type="number"
              value={startYear}
              onChange={(e) => {
                const value = e.target.value;
                if (value === '') {
                  return; // Don't allow empty values
                }
                const year = parseInt(value);
                if (!isNaN(year)) {
                  setStartYear(year);
                }
              }}
              error={startYear > endYear}
              helperText={
                startYear > endYear
                  ? 'Start year must be less than or equal to end year'
                  : ''
              }
              inputProps={{ min: 1900, max: 2100 }}
              fullWidth
              size="small"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              label="End Year"
              type="number"
              value={endYear}
              onChange={(e) => {
                const value = e.target.value;
                if (value === '') {
                  return; // Don't allow empty values
                }
                const year = parseInt(value);
                if (!isNaN(year)) {
                  setEndYear(year);
                }
              }}
              error={endYear < startYear}
              helperText={
                endYear < startYear
                  ? 'End year must be greater than or equal to start year'
                  : ''
              }
              inputProps={{ min: 1900, max: 2100 }}
              fullWidth
              size="small"
            />
          </Grid>
        </Grid>
      </Box>

      <Box sx={{ width: '100%', height: 450 }}>
        <LineChart
          xAxis={[
            {
              data: xAxisData,
              scaleType: 'time',
              valueFormatter: (date: Date) => {
                return date.getFullYear().toString();
              },
            },
          ]}
          series={series}
          height={400}
          margin={{ left: 80, right: 20, top: 20, bottom: 30 }}
          sx={{
            '& .MuiChartsLegend-series text': {
              fontSize: '0.875rem !important',
            },
          }}
        />
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            marginTop: '10px',
            gap: '5px',
          }}
        >
          <FormGroup row sx={{ justifyContent: 'center' }}>
            {legendItems.map((item) => (
              <FormControlLabel
                key={item.id}
                control={
                  <Checkbox
                    checked={visibleLines[item.id] ?? true}
                    onChange={() => handleToggleLine(item.id)}
                    size="small"
                    sx={{
                      color: item.color,
                      '&.Mui-checked': {
                        color: item.color,
                      },
                    }}
                  />
                }
                label={
                  <Typography
                    sx={{
                      fontSize: '0.875rem',
                      color:
                        (visibleLines[item.id] ?? true)
                          ? 'inherit'
                          : 'text.disabled',
                    }}
                  >
                    {item.label}
                  </Typography>
                }
              />
            ))}
          </FormGroup>
        </Box>
      </Box>
    </Paper>
  );
};
