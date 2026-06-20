import { test, expect, Page, Locator } from '@playwright/test';

// End-to-end smoke test for PathWise's critical path (roadmap 6.2): add
// positions → run the "next dollar" optimizer → turn the top plan into a chart
// scenario. The math core (Vitest, 100% gate) and individual components (RTL +
// jsdom) are tested elsewhere; this guards the wiring between them in a real
// browser — the one thing unit tests can't see.
//
// Form fields are targeted by ARIA role/name rather than getByLabel: MUI renders
// the required marker into the <label> ("Name *"), so the label text isn't a
// clean match, but each control's computed accessible name is ("Name").

const APP_URL = '/finance-calculator/';

// The app persists nothing unless the user opts in, but clear our keys before
// the bundle boots so a previous run (or a reused dev server) can't seed state.
const startClean = async (page: Page) => {
  await page.addInitScript(() => {
    try {
      localStorage.removeItem('pathwise:data');
      localStorage.removeItem('pathwise:persistence-enabled');
      localStorage.removeItem('pathwise:first-visit-acknowledged');
    } catch {
      // localStorage may be unavailable; the app defaults to empty regardless.
    }
  });
};

// MUI X renders a date input as a segmented group of month/day/year spinbuttons.
// Fill each section explicitly — typing all the digits in one go can drop a
// section, leaving an invalid (NaN) date.
const setDate = async (
  group: Locator,
  month: string,
  day: string,
  year: string
) => {
  await group.getByRole('spinbutton', { name: 'Month' }).fill(month);
  await group.getByRole('spinbutton', { name: 'Day' }).fill(day);
  await group.getByRole('spinbutton', { name: 'Year' }).fill(year);
};

test('add positions, optimize, and view the top plan as a scenario', async ({
  page,
}) => {
  await startClean(page);
  await page.goto(APP_URL);

  // --- Add a loan (the command bar's "Add Loan", not the onboarding CTA) ---
  await page.getByRole('button', { name: 'Add Loan', exact: true }).click();
  const loanDialog = page.getByRole('dialog');
  await expect(
    loanDialog.getByRole('heading', { name: 'Add new loan' })
  ).toBeVisible();
  await loanDialog
    .getByRole('textbox', { name: 'Name', exact: true })
    .fill('Test Mortgage');
  await loanDialog
    .getByRole('textbox', { name: 'Loan Provider' })
    .fill('Test Bank');
  await loanDialog.getByRole('textbox', { name: 'Principal' }).fill('300000');
  await loanDialog
    .getByRole('textbox', { name: 'Current Amount' })
    .fill('280000');
  await loanDialog.getByRole('textbox', { name: 'Interest Rate' }).fill('5');
  // End Date defaults to today (== Start Date), which is invalid; push it out so
  // the monthly payment computes and the form becomes submittable.
  await setDate(
    loanDialog.getByRole('group', { name: 'End Date' }),
    '12',
    '01',
    '2054'
  );
  const addLoan = loanDialog.getByRole('button', { name: 'Add loan' });
  await expect(addLoan).toBeEnabled();
  await addLoan.click();
  await expect(loanDialog).toBeHidden();

  // --- Add an investment (scope the submit to the dialog: the command bar has a
  // same-named "Add Investment" button) ---
  await page
    .getByRole('button', { name: 'Add Investment', exact: true })
    .click();
  const invDialog = page.getByRole('dialog');
  await expect(
    invDialog.getByRole('heading', { name: 'Add Investment' })
  ).toBeVisible();
  await invDialog
    .getByRole('textbox', { name: 'Investment Name' })
    .fill('Test Index Fund');
  await invDialog
    .getByRole('textbox', { name: 'Provider', exact: true })
    .fill('Test Brokerage');
  await invDialog
    .getByRole('textbox', { name: 'Starting Balance' })
    .fill('10000');
  await invDialog
    .getByRole('textbox', { name: 'Average Return Rate' })
    .fill('7');
  const addInv = invDialog.getByRole('button', {
    name: 'Add Investment',
    exact: true,
  });
  await expect(addInv).toBeEnabled();
  await addInv.click();
  await expect(invDialog).toBeHidden();

  // --- Run the optimizer: it's reactive (a Web Worker), so entering an amount
  // is the trigger — there's no submit button. ---
  await page
    .getByText('Where should my next dollar go?')
    .scrollIntoViewIfNeeded();
  await page.getByRole('textbox', { name: 'Extra per month' }).fill('500');
  await expect(
    page.getByRole('table', { name: 'Ranked allocation plans' })
  ).toBeVisible();
  const viewTopPlan = page
    .getByRole('button', { name: 'View as scenario' })
    .first();
  await expect(viewTopPlan).toBeVisible();

  // --- View the top plan as a scenario: a success snackbar confirms it, and the
  // impact summary ("… vs. baseline") proves it overlaid on the forecast. ---
  await viewTopPlan.click();
  await expect(
    page.getByText(/now overlaid on the forecast chart above/)
  ).toBeVisible();
  await expect(page.getByText(/vs\. baseline/)).toBeVisible();
});
