import {
  Paper,
  Typography,
  Box,
  FormGroup,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import { LineChart } from '@mui/x-charts/LineChart';
import { Loan } from '../models/loan-model';
import { Investment } from '../models/investment-model';
import { generateVisualizationData } from '../helpers/visualization-helpers';
import { useState, useMemo, useEffect } from 'react';

export type FinancialVisualizationProps = {
  loans: Loan[];
  investments: Investment[];
};

export const FinancialVisualization = ({
  loans,
  investments,
}: FinancialVisualizationProps) => {
  // State to track which lines are visible
  const [visibleLines, setVisibleLines] = useState<{
    [key: string]: boolean;
  }>({});

  // Update visible lines when loans or investments change
  useEffect(() => {
    setVisibleLines((prev) => {
      const newVisibleLines: { [key: string]: boolean } = { ...prev };
      loans.forEach((loan) => {
        const key = `loan-${loan.Id}`;
        if (!(key in newVisibleLines)) {
          newVisibleLines[key] = true;
        }
      });
      investments.forEach((investment) => {
        const key = `investment-${investment.Id}`;
        if (!(key in newVisibleLines)) {
          newVisibleLines[key] = true;
        }
      });
      if (!('total-loans' in newVisibleLines)) {
        newVisibleLines['total-loans'] = true;
      }
      if (!('total-investments' in newVisibleLines)) {
        newVisibleLines['total-investments'] = true;
      }
      if (!('overall-position' in newVisibleLines)) {
        newVisibleLines['overall-position'] = true;
      }
      return newVisibleLines;
    });
  }, [loans, investments]);

  // Generate visualization data
  const visualizationData = useMemo(
    () => generateVisualizationData(loans, investments),
    [loans, investments]
  );

  // Build series data and legend items (memoized for performance)
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
  }, [loans, investments, visibleLines, visualizationData]);

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
      <Box sx={{ width: '100%', height: 450 }}>
        <LineChart
          xAxis={[
            {
              data: xAxisData,
              scaleType: 'time',
              valueFormatter: (date: Date) => {
                return date.toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                });
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
