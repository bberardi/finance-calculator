// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, userEvent } from '../test/test-utils';
import { LoanTable } from './loan-table';
import { Loan } from '../models/loan-model';

const makeLoan = (
  over: Partial<Loan> & { Id: string; Name: string; Provider: string }
): Loan => ({
  InterestRate: 5,
  Principal: 100000,
  CurrentAmount: 95000,
  MonthlyPayment: 600,
  StartDate: new Date(2024, 0, 1),
  EndDate: new Date(2044, 0, 1),
  ...over,
});

const loans = [
  makeLoan({ Id: 'l1', Name: 'Home Mortgage', Provider: 'Chase' }),
  makeLoan({ Id: 'l2', Name: 'Car Loan', Provider: 'Toyota' }),
];

const renderTable = (overrides: Partial<Record<string, unknown>> = {}) => {
  const handlers = {
    onLoanEdit: vi.fn(),
    onLoanDelete: vi.fn(),
    onLoanClone: vi.fn(),
    onLoanBulkDelete: vi.fn(),
    ...overrides,
  };
  renderWithProviders(<LoanTable loans={loans} {...handlers} />);
  return handlers;
};

describe('LoanTable (roadmap 6.4)', () => {
  it('renders a row for each loan', () => {
    renderTable();
    expect(screen.getByText('Home Mortgage')).toBeInTheDocument();
    expect(screen.getByText('Car Loan')).toBeInTheDocument();
  });

  it('filters rows by the search query (name or provider)', async () => {
    renderTable();
    await userEvent.type(screen.getByLabelText('Search loans'), 'toyota');
    expect(screen.queryByText('Home Mortgage')).not.toBeInTheDocument();
    expect(screen.getByText('Car Loan')).toBeInTheDocument();
  });

  it('shows a no-match message when the query matches nothing', async () => {
    renderTable();
    await userEvent.type(screen.getByLabelText('Search loans'), 'zzz');
    expect(screen.getByText(/No loans match/i)).toBeInTheDocument();
  });

  it('selecting a row reveals the bulk toolbar and Duplicate clones the selection', async () => {
    const { onLoanClone } = renderTable();
    // No toolbar until something is selected.
    expect(screen.queryByText(/selected/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByLabelText('Select Home Mortgage'));
    expect(screen.getByText('1 loan selected')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Duplicate' }));
    expect(onLoanClone).toHaveBeenCalledTimes(1);
    expect(onLoanClone).toHaveBeenCalledWith(
      expect.objectContaining({ Id: 'l1' })
    );
  });

  it('select-all then bulk Delete hands every loan to onLoanBulkDelete', async () => {
    const { onLoanBulkDelete } = renderTable();
    await userEvent.click(screen.getByLabelText('Select all loans'));
    expect(screen.getByText('2 loans selected')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onLoanBulkDelete).toHaveBeenCalledWith([
      expect.objectContaining({ Id: 'l1' }),
      expect.objectContaining({ Id: 'l2' }),
    ]);
  });
});
