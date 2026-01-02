import dayjs from 'dayjs';
import { Loan } from '../models/loan-model';
import { Investment } from '../models/investment-model';
import { generateInvestmentGrowth, getInvestmentPeriods } from './investment-helpers';

export type VisualizationDataPoint = {
  date: Date;
  loanValues: { [loanId: string]: number };
  investmentValues: { [investmentId: string]: number };
  totalLoanValue: number;
  totalInvestmentValue: number;
  overallPosition: number;
};

// Get the maximum date to use for the visualization x-axis
// Returns 30 years from today if there are investments, or the latest loan end date
export const getMaxVisualizationDate = (
  loans: Loan[],
  investments: Investment[]
): Date => {
  const today = new Date();

  // Find the latest loan end date
  const maxLoanDate =
    loans.length > 0
      ? new Date(Math.max(...loans.map((loan) => loan.EndDate.getTime())))
      : today;

  // Only use 30 years from now as default if there are investments
  if (investments.length > 0) {
    const defaultEnd = dayjs(today).add(30, 'year').toDate();
    return new Date(Math.max(maxLoanDate.getTime(), defaultEnd.getTime()));
  }

  // If no investments, just use the max loan date
  return maxLoanDate;
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

  // Generate yearly data points (first day of each year)
  let currentDate = dayjs(start).startOf('year').toDate();
  const finalDate = dayjs(end).endOf('year').toDate();

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
      point.loanValues[loan.Id] = loanValue;
      point.totalLoanValue += loanValue;
    });

    // Calculate investment values at this date
    investments.forEach((investment) => {
      const investmentValue = getInvestmentValueAtDate(investment, currentDate);
      point.investmentValues[investment.Id] = investmentValue;
      point.totalInvestmentValue += investmentValue;
    });

    // Calculate overall position (investments - loans)
    point.overallPosition = point.totalInvestmentValue - point.totalLoanValue;

    dataPoints.push(point);

    // Move to next year
    currentDate = dayjs(currentDate).add(1, 'year').toDate();
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

  // Calculate which term this date corresponds to (months from start, 0-indexed)
  const monthsFromStart =
    (date.getFullYear() - loan.StartDate.getFullYear()) * 12 +
    (date.getMonth() - loan.StartDate.getMonth());

  // At monthsFromStart=0 (loan start date), we haven't made any payments yet
  // So return the initial principal
  if (monthsFromStart === 0) {
    return loan.Principal;
  }

  // After the first month, we've made payment for Term 1 (index 0)
  // Find the corresponding entry
  // AmortizationSchedule Term is 1-indexed, but array is 0-indexed
  // monthsFromStart=1 should access Term 1 which is at index 0
  const termIndex = Math.min(
    monthsFromStart - 1,
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
    investment.ProjectedGrowth.length > 0
  ) {
    // Use getInvestmentPeriods to calculate the period index consistently
    // This accounts for partial periods and matches the logic used throughout the codebase
    const periodIndex = getInvestmentPeriods(investment, date) - 1; // Subtract 1 because periods are 1-indexed

    // Clamp to valid range
    const clampedIndex = Math.max(0, Math.min(periodIndex, investment.ProjectedGrowth.length - 1));

    if (clampedIndex >= 0 && clampedIndex < investment.ProjectedGrowth.length) {
      return investment.ProjectedGrowth[clampedIndex].TotalValue;
    }
  }

  // If no ProjectedGrowth or date is beyond it, generate growth up to this date
  const growth = generateInvestmentGrowth(investment, date);
  if (growth.length > 0) {
    return growth[growth.length - 1].TotalValue;
  }

  return investment.StartingBalance;
};
