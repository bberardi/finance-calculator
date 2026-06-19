// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, userEvent } from '../test/test-utils';
import { InvestmentTable } from './investment-table';
import { Investment, CompoundingFrequency } from '../models/investment-model';

const makeInvestment = (
  over: Partial<Investment> & { Id: string; Name: string; Provider: string }
): Investment => ({
  StartingBalance: 10000,
  AverageReturnRate: 7,
  CompoundingPeriod: CompoundingFrequency.Annually,
  StartDate: new Date(2020, 0, 1),
  ...over,
});

const investments = [
  makeInvestment({ Id: 'i1', Name: 'Retirement Fund', Provider: 'Fidelity' }),
  makeInvestment({ Id: 'i2', Name: 'Brokerage Account', Provider: 'Vanguard' }),
];

const renderTable = (overrides: Partial<Record<string, unknown>> = {}) => {
  const handlers = {
    onInvestmentEdit: vi.fn(),
    onInvestmentDelete: vi.fn(),
    onInvestmentClone: vi.fn(),
    onInvestmentBulkDelete: vi.fn(),
    ...overrides,
  };
  renderWithProviders(
    <InvestmentTable investments={investments} {...handlers} />
  );
  return handlers;
};

describe('InvestmentTable (roadmap 6.4)', () => {
  it('renders a row for each investment', () => {
    renderTable();
    expect(screen.getByText('Retirement Fund')).toBeInTheDocument();
    expect(screen.getByText('Brokerage Account')).toBeInTheDocument();
  });

  it('filters rows by the search query (name or provider)', async () => {
    renderTable();
    await userEvent.type(
      screen.getByLabelText('Search investments'),
      'vanguard'
    );
    expect(screen.queryByText('Retirement Fund')).not.toBeInTheDocument();
    expect(screen.getByText('Brokerage Account')).toBeInTheDocument();
  });

  it('shows a no-match message when the query matches nothing', async () => {
    renderTable();
    await userEvent.type(screen.getByLabelText('Search investments'), 'zzz');
    expect(screen.getByText(/No investments match/i)).toBeInTheDocument();
  });

  it('selecting a row reveals the bulk toolbar and Duplicate clones the selection', async () => {
    const { onInvestmentClone } = renderTable();
    // No toolbar until something is selected.
    expect(screen.queryByText(/selected/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByLabelText('Select Retirement Fund'));
    expect(screen.getByText('1 investment selected')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Duplicate' }));
    expect(onInvestmentClone).toHaveBeenCalledTimes(1);
    expect(onInvestmentClone).toHaveBeenCalledWith(
      expect.objectContaining({ Id: 'i1' })
    );
  });

  it('select-all then bulk Delete hands every investment to onInvestmentBulkDelete', async () => {
    const { onInvestmentBulkDelete } = renderTable();
    await userEvent.click(screen.getByLabelText('Select all investments'));
    expect(screen.getByText('2 investments selected')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onInvestmentBulkDelete).toHaveBeenCalledWith([
      expect.objectContaining({ Id: 'i1' }),
      expect.objectContaining({ Id: 'i2' }),
    ]);
  });
});
