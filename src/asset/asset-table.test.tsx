// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import {
  renderWithProviders,
  screen,
  userEvent,
  within,
} from '../test/test-utils';
import { AssetTable } from './asset-table';
import { Asset, AssetType } from '../models/asset-model';

const makeAsset = (
  over: Partial<Asset> & { Id: string; Name: string }
): Asset => ({
  Provider: 'Bank',
  AssetType: AssetType.Cash,
  Balance: 1000,
  GrowthRate: 2,
  ...over,
});

const assets = [
  makeAsset({ Id: 'a1', Name: 'Checking', Provider: 'Chase' }),
  makeAsset({
    Id: 'a2',
    Name: 'Collectibles',
    Provider: 'Home Safe',
    AssetType: AssetType.CustomAsset,
  }),
];

const renderTable = (overrides: Partial<Record<string, unknown>> = {}) => {
  const handlers = {
    onAssetEdit: vi.fn(),
    onAssetDelete: vi.fn(),
    onAssetClone: vi.fn(),
    onAssetBulkDelete: vi.fn(),
    ...overrides,
  };
  renderWithProviders(<AssetTable assets={assets} loans={[]} {...handlers} />);
  return handlers;
};

describe('AssetTable (shared HoldingTable config)', () => {
  it('renders a row for each asset, including its type and an Equity column', () => {
    renderTable();
    expect(screen.getByText('Checking')).toBeInTheDocument();
    expect(screen.getByText('Collectibles')).toBeInTheDocument();
    // The Type column (shown by default) renders the friendly type labels.
    expect(screen.getByText('Cash')).toBeInTheDocument();
    expect(screen.getByText('Custom asset')).toBeInTheDocument();
    // Equity column header is present by default; unlinked assets read "—".
    expect(
      screen.getByRole('columnheader', { name: 'Equity' })
    ).toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('filters rows by the search query (name or provider)', async () => {
    renderTable();
    await userEvent.type(screen.getByLabelText('Search assets'), 'home safe');
    expect(screen.queryByText('Checking')).not.toBeInTheDocument();
    expect(screen.getByText('Collectibles')).toBeInTheDocument();
  });

  it('shows a no-match message when the query matches nothing', async () => {
    renderTable();
    await userEvent.type(screen.getByLabelText('Search assets'), 'zzz');
    expect(screen.getByText(/No assets match/i)).toBeInTheDocument();
  });

  it('select-all then bulk Delete hands every asset to onAssetBulkDelete', async () => {
    const { onAssetBulkDelete } = renderTable();
    await userEvent.click(screen.getByLabelText('Select all assets'));
    const toolbar = screen
      .getByText('2 assets selected')
      .closest('.MuiToolbar-root') as HTMLElement;
    // The row actions are also titled "Delete", so scope to the bulk toolbar.
    await userEvent.click(
      within(toolbar).getByRole('button', { name: 'Delete' })
    );
    expect(onAssetBulkDelete).toHaveBeenCalledWith([
      expect.objectContaining({ Id: 'a1' }),
      expect.objectContaining({ Id: 'a2' }),
    ]);
  });

  it('offers the Convert-to-loan action only when its handler is supplied', () => {
    const { unmount } = renderWithProviders(
      <AssetTable
        assets={assets}
        loans={[]}
        onAssetEdit={vi.fn()}
        onAssetDelete={vi.fn()}
        onAssetClone={vi.fn()}
        onAssetBulkDelete={vi.fn()}
      />
    );
    expect(
      screen.queryByRole('button', { name: 'Convert to loan' })
    ).not.toBeInTheDocument();
    unmount();

    renderWithProviders(
      <AssetTable
        assets={assets}
        loans={[]}
        onAssetEdit={vi.fn()}
        onAssetDelete={vi.fn()}
        onAssetClone={vi.fn()}
        onAssetBulkDelete={vi.fn()}
        onAssetConvertToLoan={vi.fn()}
      />
    );
    expect(
      screen.getAllByRole('button', { name: 'Convert to loan' }).length
    ).toBe(assets.length);
  });

  it('offers Enhancement ROI only for a property with a positive growth rate', () => {
    const property = (growthRate: number) =>
      makeAsset({
        Id: 'p1',
        Name: 'Beach House',
        AssetType: AssetType.Property,
        GrowthRate: growthRate,
      });
    const { unmount } = renderWithProviders(
      <AssetTable
        assets={[property(3)]}
        loans={[]}
        onAssetEdit={vi.fn()}
        onAssetDelete={vi.fn()}
        onAssetClone={vi.fn()}
        onAssetBulkDelete={vi.fn()}
      />
    );
    expect(
      screen.getByRole('button', { name: 'Enhancement ROI' })
    ).toBeInTheDocument();
    unmount();

    // A flat or depreciating property doesn't offer it — nothing appreciates to
    // catch up to the cost, and "appreciating -2.5%/yr" would read oddly.
    renderWithProviders(
      <AssetTable
        assets={[property(0), property(-2.5)]}
        loans={[]}
        onAssetEdit={vi.fn()}
        onAssetDelete={vi.fn()}
        onAssetClone={vi.fn()}
        onAssetBulkDelete={vi.fn()}
      />
    );
    expect(
      screen.queryByRole('button', { name: 'Enhancement ROI' })
    ).not.toBeInTheDocument();
  });

  it('hides Enhancement ROI for a non-property asset even with a positive growth rate', () => {
    renderWithProviders(
      <AssetTable
        assets={[
          makeAsset({
            Id: 'c1',
            Name: 'Brokerage',
            AssetType: AssetType.Investment,
            GrowthRate: 7,
          }),
        ]}
        loans={[]}
        onAssetEdit={vi.fn()}
        onAssetDelete={vi.fn()}
        onAssetClone={vi.fn()}
        onAssetBulkDelete={vi.fn()}
      />
    );
    expect(
      screen.queryByRole('button', { name: 'Enhancement ROI' })
    ).not.toBeInTheDocument();
  });

  it('opens the Enhancement ROI calculator on click and closes it cleanly on Escape', async () => {
    renderWithProviders(
      <AssetTable
        assets={[
          makeAsset({
            Id: 'p1',
            Name: 'Beach House',
            AssetType: AssetType.Property,
            GrowthRate: 3,
          }),
        ]}
        loans={[]}
        onAssetEdit={vi.fn()}
        onAssetDelete={vi.fn()}
        onAssetClone={vi.fn()}
        onAssetBulkDelete={vi.fn()}
      />
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Enhancement ROI' })
    );
    expect(
      screen.getByText('Is this improvement worth it?')
    ).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');
    expect(
      screen.queryByText('Is this improvement worth it?')
    ).not.toBeInTheDocument();
  });

  it('can hide the Type and Equity columns and relabel for the Liabilities group', () => {
    renderWithProviders(
      <AssetTable
        assets={[
          makeAsset({
            Id: 'l1',
            Name: 'Personal IOU',
            AssetType: AssetType.CustomLiability,
          }),
        ]}
        loans={[]}
        onAssetEdit={vi.fn()}
        onAssetDelete={vi.fn()}
        onAssetClone={vi.fn()}
        onAssetBulkDelete={vi.fn()}
        showTypeColumn={false}
        showEquityColumn={false}
        searchLabel="Search liabilities"
        itemLabel="liability"
        itemLabelPlural="liabilities"
        balanceHeader="Amount owed"
      />
    );
    expect(screen.getByLabelText('Search liabilities')).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: 'Amount owed' })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('columnheader', { name: 'Type' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('columnheader', { name: 'Equity' })
    ).not.toBeInTheDocument();
  });
});
