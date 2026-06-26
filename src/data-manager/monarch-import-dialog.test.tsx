// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, userEvent } from '../test/test-utils';
import { MonarchImportDialog } from './monarch-import-dialog';
import { Asset, AssetType } from '../models/asset-model';

// A parsed Monarch account as the dialog receives it: name/provider/balance plus
// the parser's sign-based default type (a debt → custom liability).
const account = (over: Partial<Asset> = {}): Asset => ({
  Id: 'acc-1',
  Provider: 'Chase',
  Name: 'Chase Mortgage',
  AssetType: AssetType.CustomLiability,
  Balance: 250000,
  GrowthRate: 0,
  ...over,
});

const setup = () => {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  renderWithProviders(
    <MonarchImportDialog
      open
      accounts={[account()]}
      existingLoans={[]}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
  return { onConfirm, onCancel };
};

// Open the single row's Type select and choose an option by label.
const selectType = async (label: string) => {
  await userEvent.click(screen.getByRole('combobox'));
  await userEvent.click(await screen.findByRole('option', { name: label }));
};

describe('MonarchImportDialog type editors (loan/investment/asset split)', () => {
  it('offers Loan and Investment alongside the asset types', async () => {
    setup();
    await userEvent.click(screen.getByRole('combobox'));
    expect(
      await screen.findByRole('option', { name: 'Loan' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: 'Investment' })
    ).toBeInTheDocument();
  });

  it('commits a custom-liability account as-is, with no editor', async () => {
    const { onConfirm } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Import 1' }));
    expect(onConfirm).toHaveBeenCalledWith({
      loans: [],
      assets: [
        expect.objectContaining({
          Id: 'acc-1',
          AssetType: AssetType.CustomLiability,
        }),
      ],
    });
  });

  it('promoting to Loan opens the loan editor (seeded) and commits a loan', async () => {
    const { onConfirm } = setup();
    await selectType('Loan');

    // The loan editor opens in add-mode, pre-filled from the account.
    expect(
      await screen.findByRole('heading', { name: 'Add new loan' })
    ).toBeInTheDocument();
    // The seeded loan (principal = balance, 0% by default, payment auto-derived)
    // is valid, so it can be saved straight away.
    await userEvent.click(screen.getByRole('button', { name: 'Add loan' }));

    await userEvent.click(screen.getByRole('button', { name: 'Import 1' }));
    expect(onConfirm).toHaveBeenCalledWith({
      loans: [
        expect.objectContaining({ Name: 'Chase Mortgage', Principal: 250000 }),
      ],
      assets: [],
    });
  });

  it('promoting to Investment commits an AssetType.Investment asset', async () => {
    const { onConfirm } = setup();
    await selectType('Investment');

    expect(
      await screen.findByRole('heading', { name: 'Add Investment' })
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'Add Investment' })
    );

    await userEvent.click(screen.getByRole('button', { name: 'Import 1' }));
    expect(onConfirm).toHaveBeenCalledWith({
      loans: [],
      assets: [
        expect.objectContaining({
          AssetType: AssetType.Investment,
          Balance: 250000,
        }),
      ],
    });
  });

  it('cancelling an editor leaves the row at its prior (custom) type', async () => {
    const { onConfirm } = setup();
    await selectType('Loan');
    await screen.findByRole('heading', { name: 'Add new loan' });

    // The import dialog underneath is aria-hidden while the editor is open, so
    // this Cancel targets the editor.
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await userEvent.click(screen.getByRole('button', { name: 'Import 1' }));
    expect(onConfirm).toHaveBeenCalledWith({
      loans: [],
      assets: [
        expect.objectContaining({ AssetType: AssetType.CustomLiability }),
      ],
    });
  });
});
