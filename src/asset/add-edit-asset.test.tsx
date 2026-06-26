// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen } from '../test/test-utils';
import { AddEditAsset } from './add-edit-asset';
import { Asset, AssetType } from '../models/asset-model';

describe('AddEditAsset initialValues prefill (Monarch import)', () => {
  it('seeds add-mode from initialValues without entering edit mode', () => {
    const seed: Asset = {
      Id: 'a1',
      Provider: 'Ally',
      Name: 'Savings',
      AssetType: AssetType.Cash,
      Balance: 5000,
      GrowthRate: 4,
    };
    renderWithProviders(
      <AddEditAsset
        open
        initialValues={seed}
        loans={[]}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />
    );

    // No `asset` prop → still an add ("Add new asset"), but the fields are
    // pre-filled from the account.
    expect(
      screen.getByRole('heading', { name: /Add new asset/i })
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Name/i)).toHaveValue('Savings');
    expect(screen.getByLabelText(/Provider/i)).toHaveValue('Ally');
    expect(screen.getByLabelText(/Current Balance/i)).toHaveValue('$5,000');
  });
});
