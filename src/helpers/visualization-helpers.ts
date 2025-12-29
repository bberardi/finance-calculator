import dayjs from 'dayjs';
import { Loan } from '../models/loan-model';
import { Investment } from '../models/investment-model';

export type VisualizationDataPoint = {
  date: Date;
  loanValues: { [loanName: string]: number };
  investmentValues: { [investmentName: string]: number };
  totalLoanValue: number;
  totalInvestmentValue: number;
  overallPosition: number;
};

// Get the maximum date to use for the visualization x-axis
export const getMaxVisualizationDate = (
  loans: Loan[],
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _investments: Investment[]
): Date => {
  const today = new Date();
  const defaultEnd = dayjs(today).add(30, 'year').toDate();

  // Find the latest loan end date
  const maxLoanDate =
    loans.length > 0
      ? new Date(Math.max(...loans.map((loan) => loan.EndDate.getTime())))
      : today;

  // For investments, use 30 years from now as default
  const maxInvestmentDate = defaultEnd;

  // Return the maximum of all dates
  return new Date(Math.max(maxLoanDate.getTime(), maxInvestmentDate.getTime()));
};

// Generate data points for visualization
export const generateVisualizationData = (
  loans: Loan[],
  investments: Investment[],
  startDate?: Date,
  endDate?: Date
): VisualizationDataPoint[] => {
  const dataPoints: VisualizationDataPoint[] = [];

  // Determine the date range
  const start = startDate || new Date();
  const end = endDate || getMaxVisualizationDate(loans, investments);

  // Generate monthly data points
  let currentDate = dayjs(start).startOf('month').toDate();
  const finalDate = dayjs(end).endOf('month').toDate();

  while (currentDate <= finalDate) {
    const point: VisualizationDataPoint = {
      date: new Date(currentDate),
      loanValues: {},
      investmentValues: {},
      totalLoanValue: 0,
      totalInvestmentValue: 0,
      overallPosition: 0,
    };

    // Calculate loan values at this date
    loans.forEach((loan) => {
      const loanValue = getLoanValueAtDate(loan, currentDate);
      point.loanValues[loan.Name] = loanValue;
      point.totalLoanValue += loanValue;
    });

    // Calculate investment values at this date
    investments.forEach((investment) => {
      const investmentValue = getInvestmentValueAtDate(investment, currentDate);
      point.investmentValues[investment.Name] = investmentValue;
      point.totalInvestmentValue += investmentValue;
    });

    // Calculate overall position (investments - loans)
    point.overallPosition = point.totalInvestmentValue - point.totalLoanValue;

    dataPoints.push(point);

    // Move to next month
    currentDate = dayjs(currentDate).add(1, 'month').toDate();
  }

  return dataPoints;
};

// Get loan remaining balance at a specific date
const getLoanValueAtDate = (loan: Loan, date: Date): number => {
  // If date is before loan start, return 0
  if (date < loan.StartDate) {
    return 0;
  }

  // If date is after loan end, return 0
  if (date >= loan.EndDate) {
    return 0;
  }

  // Find the closest amortization entry
  if (!loan.AmortizationSchedule || loan.AmortizationSchedule.length === 0) {
    // If no schedule, use linear interpolation
    const totalMonths =
      (loan.EndDate.getFullYear() - loan.StartDate.getFullYear()) * 12 +
      (loan.EndDate.getMonth() - loan.StartDate.getMonth());
    const elapsedMonths =
      (date.getFullYear() - loan.StartDate.getFullYear()) * 12 +
      (date.getMonth() - loan.StartDate.getMonth());

    const remainingRatio = Math.max(
      0,
      Math.min(1, 1 - elapsedMonths / totalMonths)
    );
    return loan.Principal * remainingRatio;
  }

  // Calculate which term this date corresponds to
  const monthsFromStart =
    (date.getFullYear() - loan.StartDate.getFullYear()) * 12 +
    (date.getMonth() - loan.StartDate.getMonth());

  // Find the corresponding entry (1-indexed)
  const termIndex = Math.min(
    monthsFromStart,
    loan.AmortizationSchedule.length - 1
  );

  if (termIndex < 0) {
    return loan.Principal;
  }

  return loan.AmortizationSchedule[termIndex].RemainingBalance;
};

// Get investment value at a specific date
const getInvestmentValueAtDate = (
  investment: Investment,
  date: Date
): number => {
  // If date is before investment start, return 0
  if (date < investment.StartDate) {
    return 0;
  }

  // If we have projected growth, use it
  if (
    investment.ProjectedGrowth &&
    investment.ProjectedGrowth.length > 0 &&
    date <= new Date()
  ) {
    // For historical data, use the projected growth
    const monthsFromStart =
      (date.getFullYear() - investment.StartDate.getFullYear()) * 12 +
      (date.getMonth() - investment.StartDate.getMonth());

    const periodIndex = Math.min(
      monthsFromStart,
      investment.ProjectedGrowth.length - 1
    );

    if (periodIndex >= 0 && periodIndex < investment.ProjectedGrowth.length) {
      return investment.ProjectedGrowth[periodIndex].TotalValue;
    }
  }

  // For future projections, we need to calculate the value
  // This is a simplified calculation - in practice, you'd use the investment helpers
  const yearsFromStart =
    (date.getTime() - investment.StartDate.getTime()) /
    (1000 * 60 * 60 * 24 * 365.25);

  const annualRate = investment.AverageReturnRate / 100;
  const compoundedValue =
    investment.StartingBalance * Math.pow(1 + annualRate, yearsFromStart);

  // Add contributions if applicable (simplified)
  let contributionValue = 0;
  if (investment.RecurringContribution) {
    const monthsFromStart =
      (date.getFullYear() - investment.StartDate.getFullYear()) * 12 +
      (date.getMonth() - investment.StartDate.getMonth());
    contributionValue = investment.RecurringContribution * monthsFromStart;
  }

  return Math.round((compoundedValue + contributionValue) * 100) / 100;
};
