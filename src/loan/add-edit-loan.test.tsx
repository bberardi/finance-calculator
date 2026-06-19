// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, userEvent } from '../test/test-utils';
import { AddEditLoan } from './add-edit-loan';
import { Loan } from '../models/loan-model';

const validLoan: Loan = {
  Id: 'edit-1',
  Name: 'My Loan',
  Provider: 'Bank',
  InterestRate: 5,
  Principal: 100000,
  CurrentAmount: 95000,
  MonthlyPayment: 600,
  StartDate: new Date(2024, 0, 1),
  EndDate: new Date(2044, 0, 1),
};

describe('AddEditLoan (form)', () => {
  it('disables Save for a new, empty (invalid) loan', () => {
    renderWithProviders(
      <AddEditLoan open onSave={vi.fn()} onClose={vi.fn()} />
    );
    expect(screen.getByText('Add new loan')).toBeInTheDocument();
    // emptyLoan has no name/provider, a $0 principal, and EndDate == StartDate.
    expect(screen.getByRole('button', { name: 'Add loan' })).toBeDisabled();
  });

  it('saves an edited loan: Save is enabled and onSave gets the new + old loan', async () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    renderWithProviders(
      <AddEditLoan open loan={validLoan} onSave={onSave} onClose={onClose} />
    );

    const save = screen.getByRole('button', { name: 'Save loan' });
    expect(save).toBeEnabled();

    const name = screen.getByLabelText(/Name/);
    await userEvent.clear(name);
    await userEvent.type(name, 'Renamed Loan');

    await userEvent.click(save);

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ Id: 'edit-1', Name: 'Renamed Loan' }),
      expect.objectContaining({ Id: 'edit-1' })
    );
    expect(onClose).toHaveBeenCalled();
  });
});
