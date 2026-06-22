// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import {
  renderWithProviders,
  screen,
  userEvent,
  waitForElementToBeRemoved,
} from '../test/test-utils';
import { DataManager } from './data-manager';
import { exportToJson } from '../helpers/data-helpers';
import { Loan } from '../models/loan-model';

const loan: Loan = {
  Id: 'imp-1',
  Name: 'Imported Loan',
  Provider: 'Bank',
  InterestRate: 5,
  Principal: 1000,
  CurrentAmount: 1000,
  MonthlyPayment: 50,
  StartDate: new Date(2024, 0, 1),
  EndDate: new Date(2025, 0, 1),
};

const importFile = () =>
  new File([exportToJson([loan], [], [])], 'data.json', {
    type: 'application/json',
  });

const fileInput = (container: HTMLElement) =>
  container.querySelector('input[accept=".json"]') as HTMLInputElement;

// A Monarch "account balance history" CSV for one account.
const monarchFile = () =>
  new File(
    [
      'Date,Amount,Account Name\n2024-01-01,1000,Chase Checking\n2024-02-01,1500,Chase Checking\n',
    ],
    'balances.csv',
    { type: 'text/csv' }
  );

const monarchInput = (container: HTMLElement) =>
  container.querySelector('input[accept=".csv"]') as HTMLInputElement;

describe('DataManager import preview + undo (roadmap 6.3)', () => {
  it('previews the merge and only commits on confirm, then offers undo', async () => {
    const { container } = renderWithProviders(<DataManager />);

    await userEvent.upload(fileInput(container), importFile());

    // The pre-merge preview appears and lists the entity — nothing merged yet.
    expect(await screen.findByText('Review import')).toBeInTheDocument();
    expect(screen.getByText('Imported Loan')).toBeInTheDocument();
    expect(screen.queryByText(/Imported 1 item/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Import' }));

    // Confirmed → soft-undo snackbar with an UNDO action. findByRole waits for
    // the preview dialog to finish closing (its modal aria-hidden otherwise
    // masks the snackbar) before the UNDO button becomes accessible.
    expect(
      await screen.findByRole('button', { name: 'UNDO' })
    ).toBeInTheDocument();
    expect(screen.getByText(/Imported 1 item/)).toBeInTheDocument();
  });

  it('cancelling the preview imports nothing', async () => {
    const { container } = renderWithProviders(<DataManager />);

    await userEvent.upload(fileInput(container), importFile());
    await screen.findByText('Review import');

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    // The dialog closes via an exit transition, so wait for it to leave the DOM.
    await waitForElementToBeRemoved(() => screen.queryByText('Review import'));
    expect(screen.queryByText(/Imported/)).not.toBeInTheDocument();
  });
});

describe('DataManager Monarch CSV import', () => {
  it('previews a Monarch balance CSV as an asset and commits on confirm', async () => {
    const { container } = renderWithProviders(<DataManager />);

    await userEvent.upload(monarchInput(container), monarchFile());

    // The shared review dialog lists the imported account; nothing merged yet.
    expect(await screen.findByText('Review import')).toBeInTheDocument();
    expect(screen.getByText('Chase Checking')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Import' }));

    expect(
      await screen.findByRole('button', { name: 'UNDO' })
    ).toBeInTheDocument();
    expect(screen.getByText(/Imported 1 item/)).toBeInTheDocument();
  });
});
