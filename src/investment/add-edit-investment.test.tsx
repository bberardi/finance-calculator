// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, userEvent } from '../test/test-utils';
import { AddEditInvestment } from './add-edit-investment';
import { Investment, CompoundingFrequency } from '../models/investment-model';

const validInvestment: Investment = {
  Id: 'edit-1',
  Name: 'My Investment',
  Provider: 'Fidelity',
  StartDate: new Date(2020, 0, 1),
  StartingBalance: 10000,
  AverageReturnRate: 7,
  CompoundingPeriod: CompoundingFrequency.Annually,
};

describe('AddEditInvestment (form)', () => {
  it('disables Save for a new, empty (invalid) investment', () => {
    renderWithProviders(
      <AddEditInvestment open onSave={vi.fn()} onClose={vi.fn()} />
    );
    expect(
      screen.getByRole('heading', { name: 'Add Investment' })
    ).toBeInTheDocument();
    // emptyInvestment has no name/provider, so Save is disabled.
    expect(
      screen.getByRole('button', { name: 'Add Investment' })
    ).toBeDisabled();
  });

  it('saves an edited investment: Save is enabled and onSave gets the new + old investment', async () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    renderWithProviders(
      <AddEditInvestment
        open
        investment={validInvestment}
        onSave={onSave}
        onClose={onClose}
      />
    );

    const save = screen.getByRole('button', { name: 'Save Investment' });
    expect(save).toBeEnabled();

    const name = screen.getByLabelText(/Investment Name/);
    await userEvent.clear(name);
    await userEvent.type(name, 'Renamed Investment');

    await userEvent.click(save);

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ Id: 'edit-1', Name: 'Renamed Investment' }),
      expect.objectContaining({ Id: 'edit-1' })
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('edits an investment’s Current Value and saves it as the forecast anchor (#110)', async () => {
    const onSave = vi.fn();
    renderWithProviders(
      <AddEditInvestment
        open
        investment={validInvestment}
        onSave={onSave}
        onClose={vi.fn()}
      />
    );

    const currentValue = screen.getByLabelText(/Current Value/);
    await userEvent.type(currentValue, '12500');

    await userEvent.click(
      screen.getByRole('button', { name: 'Save Investment' })
    );

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ Id: 'edit-1', CurrentValue: 12500 }),
      expect.objectContaining({ Id: 'edit-1' })
    );
  });

  it('blocks saving when Current Value is negative (#99 rule, now reachable)', async () => {
    const onSave = vi.fn();
    renderWithProviders(
      <AddEditInvestment
        open
        investment={validInvestment}
        onSave={onSave}
        onClose={vi.fn()}
      />
    );

    const currentValue = screen.getByLabelText(/Current Value/);
    await userEvent.type(currentValue, '-100');

    // The #99 negative-CurrentValue rule blocks Save (button disabled), and the
    // per-field error is revealed once the field is touched.
    expect(
      screen.getByRole('button', { name: 'Save Investment' })
    ).toBeDisabled();
    expect(onSave).not.toHaveBeenCalled();
  });
});
