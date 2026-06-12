import { describe, it, expect } from 'vitest';
import {
  FinanceState,
  financeReducer,
  initialFinanceState,
} from './finance-reducer';
import { Loan } from '../models/loan-model';
import { Investment, CompoundingFrequency } from '../models/investment-model';

const makeLoan = (id: string, overrides: Partial<Loan> = {}): Loan => ({
  Id: id,
  Provider: `Provider ${id}`,
  Name: `Loan ${id}`,
  InterestRate: 5,
  StartDate: new Date('2024-01-01'),
  EndDate: new Date('2044-01-01'),
  Principal: 100000,
  CurrentAmount: 95000,
  MonthlyPayment: 500,
  ...overrides,
});

const makeInvestment = (
  id: string,
  overrides: Partial<Investment> = {}
): Investment => ({
  Id: id,
  Provider: `Provider ${id}`,
  Name: `Investment ${id}`,
  StartDate: new Date('2024-01-01'),
  StartingBalance: 10000,
  AverageReturnRate: 7,
  CompoundingPeriod: CompoundingFrequency.Monthly,
  ...overrides,
});

const stateWith = (overrides: Partial<FinanceState>): FinanceState => ({
  ...initialFinanceState,
  ...overrides,
});

describe('financeReducer', () => {
  describe('AddLoan', () => {
    it('appends a loan to an empty list', () => {
      const loan = makeLoan('a');
      const next = financeReducer(initialFinanceState, {
        type: 'AddLoan',
        loan,
      });
      expect(next.loans).toEqual([loan]);
    });

    it('appends to the end, preserving existing order', () => {
      const start = stateWith({ loans: [makeLoan('a'), makeLoan('b')] });
      const loan = makeLoan('c');
      const next = financeReducer(start, { type: 'AddLoan', loan });
      expect(next.loans.map((l) => l.Id)).toEqual(['a', 'b', 'c']);
    });

    it('does not mutate the input state', () => {
      const start = stateWith({ loans: [makeLoan('a')] });
      const snapshot = start.loans;
      financeReducer(start, { type: 'AddLoan', loan: makeLoan('b') });
      expect(start.loans).toBe(snapshot);
      expect(start.loans).toHaveLength(1);
    });
  });

  describe('UpdateLoan (regression for #48)', () => {
    it('replaces the matching loan in place, preserving order', () => {
      const start = stateWith({
        loans: [makeLoan('a'), makeLoan('b'), makeLoan('c')],
      });
      const updated = makeLoan('b', { Name: 'Updated B', Principal: 1 });
      const next = financeReducer(start, { type: 'UpdateLoan', loan: updated });

      // Order must be unchanged (the bug moved edited items to the bottom).
      expect(next.loans.map((l) => l.Id)).toEqual(['a', 'b', 'c']);
      expect(next.loans[1]).toEqual(updated);
    });

    it('updating the first item keeps it first', () => {
      const start = stateWith({
        loans: [makeLoan('a'), makeLoan('b'), makeLoan('c')],
      });
      const updated = makeLoan('a', { Name: 'New A' });
      const next = financeReducer(start, { type: 'UpdateLoan', loan: updated });
      expect(next.loans.map((l) => l.Id)).toEqual(['a', 'b', 'c']);
      expect(next.loans[0].Name).toBe('New A');
    });

    it('is a no-op when the Id is not present', () => {
      const start = stateWith({ loans: [makeLoan('a')] });
      const next = financeReducer(start, {
        type: 'UpdateLoan',
        loan: makeLoan('z'),
      });
      expect(next.loans.map((l) => l.Id)).toEqual(['a']);
    });
  });

  describe('DeleteLoan (regression for #49)', () => {
    it('removes the loan with the matching Id', () => {
      const start = stateWith({
        loans: [makeLoan('a'), makeLoan('b'), makeLoan('c')],
      });
      const next = financeReducer(start, { type: 'DeleteLoan', id: 'b' });
      expect(next.loans.map((l) => l.Id)).toEqual(['a', 'c']);
    });

    it('is a no-op when the Id is not present', () => {
      const start = stateWith({ loans: [makeLoan('a')] });
      const next = financeReducer(start, { type: 'DeleteLoan', id: 'z' });
      expect(next.loans.map((l) => l.Id)).toEqual(['a']);
    });
  });

  describe('InsertLoanAt (delete soft-undo, roadmap 0.7)', () => {
    it('delete then undo restores the identical loan at its original index', () => {
      const a = makeLoan('a');
      const b = makeLoan('b', { Name: 'Middle', Principal: 42 });
      const c = makeLoan('c');
      const start = stateWith({ loans: [a, b, c] });

      // Delete the middle loan, remembering its index (1).
      const index = start.loans.findIndex((l) => l.Id === 'b');
      const deleted = financeReducer(start, { type: 'DeleteLoan', id: 'b' });
      expect(deleted.loans.map((l) => l.Id)).toEqual(['a', 'c']);

      // Undo restores it at the same position, byte-for-byte identical.
      const undone = financeReducer(deleted, {
        type: 'InsertLoanAt',
        loan: b,
        index,
      });
      expect(undone.loans.map((l) => l.Id)).toEqual(['a', 'b', 'c']);
      expect(undone.loans[1]).toEqual(b);
    });

    it('inserts at the front when index is 0', () => {
      const start = stateWith({ loans: [makeLoan('b'), makeLoan('c')] });
      const next = financeReducer(start, {
        type: 'InsertLoanAt',
        loan: makeLoan('a'),
        index: 0,
      });
      expect(next.loans.map((l) => l.Id)).toEqual(['a', 'b', 'c']);
    });

    it('clamps an out-of-range index by appending (list shrank meanwhile)', () => {
      // Original index was 5, but the list only has one item now.
      const start = stateWith({ loans: [makeLoan('a')] });
      const next = financeReducer(start, {
        type: 'InsertLoanAt',
        loan: makeLoan('z'),
        index: 5,
      });
      expect(next.loans.map((l) => l.Id)).toEqual(['a', 'z']);
    });

    it('restores into an emptied list', () => {
      const restored = makeLoan('only');
      const next = financeReducer(initialFinanceState, {
        type: 'InsertLoanAt',
        loan: restored,
        index: 0,
      });
      expect(next.loans).toEqual([restored]);
    });

    it('is a no-op when the same Id is already present (double undo)', () => {
      const start = stateWith({ loans: [makeLoan('a'), makeLoan('b')] });
      const next = financeReducer(start, {
        type: 'InsertLoanAt',
        loan: makeLoan('a', { Name: 'Dup' }),
        index: 0,
      });
      expect(next).toBe(start);
    });

    it('does not mutate the input state', () => {
      const start = stateWith({ loans: [makeLoan('a')] });
      const snapshot = start.loans;
      financeReducer(start, {
        type: 'InsertLoanAt',
        loan: makeLoan('b'),
        index: 0,
      });
      expect(start.loans).toBe(snapshot);
      expect(start.loans).toHaveLength(1);
    });
  });

  describe('AddInvestment', () => {
    it('appends an investment, preserving order', () => {
      const start = stateWith({
        investments: [makeInvestment('a'), makeInvestment('b')],
      });
      const next = financeReducer(start, {
        type: 'AddInvestment',
        investment: makeInvestment('c'),
      });
      expect(next.investments.map((i) => i.Id)).toEqual(['a', 'b', 'c']);
    });
  });

  describe('UpdateInvestment (regression for #48)', () => {
    it('replaces the matching investment in place, preserving order', () => {
      const start = stateWith({
        investments: [
          makeInvestment('a'),
          makeInvestment('b'),
          makeInvestment('c'),
        ],
      });
      const updated = makeInvestment('b', { Name: 'Updated B' });
      const next = financeReducer(start, {
        type: 'UpdateInvestment',
        investment: updated,
      });
      expect(next.investments.map((i) => i.Id)).toEqual(['a', 'b', 'c']);
      expect(next.investments[1]).toEqual(updated);
    });
  });

  describe('DeleteInvestment (regression for #49)', () => {
    it('removes the investment with the matching Id', () => {
      const start = stateWith({
        investments: [
          makeInvestment('a'),
          makeInvestment('b'),
          makeInvestment('c'),
        ],
      });
      const next = financeReducer(start, {
        type: 'DeleteInvestment',
        id: 'b',
      });
      expect(next.investments.map((i) => i.Id)).toEqual(['a', 'c']);
    });
  });

  describe('InsertInvestmentAt (delete soft-undo, roadmap 0.7)', () => {
    it('delete then undo restores the identical investment at its original index', () => {
      const x = makeInvestment('x');
      const y = makeInvestment('y', { Name: 'Middle', StartingBalance: 7 });
      const z = makeInvestment('z');
      const start = stateWith({ investments: [x, y, z] });

      const index = start.investments.findIndex((i) => i.Id === 'y');
      const deleted = financeReducer(start, {
        type: 'DeleteInvestment',
        id: 'y',
      });
      expect(deleted.investments.map((i) => i.Id)).toEqual(['x', 'z']);

      const undone = financeReducer(deleted, {
        type: 'InsertInvestmentAt',
        investment: y,
        index,
      });
      expect(undone.investments.map((i) => i.Id)).toEqual(['x', 'y', 'z']);
      expect(undone.investments[1]).toEqual(y);
    });

    it('clamps an out-of-range index by appending', () => {
      const start = stateWith({ investments: [makeInvestment('x')] });
      const next = financeReducer(start, {
        type: 'InsertInvestmentAt',
        investment: makeInvestment('z'),
        index: 9,
      });
      expect(next.investments.map((i) => i.Id)).toEqual(['x', 'z']);
    });

    it('is a no-op when the same Id is already present', () => {
      const start = stateWith({ investments: [makeInvestment('x')] });
      const next = financeReducer(start, {
        type: 'InsertInvestmentAt',
        investment: makeInvestment('x', { Name: 'Dup' }),
        index: 0,
      });
      expect(next).toBe(start);
    });
  });

  describe('ImportMerge', () => {
    it('adds new items by Id', () => {
      const start = stateWith({
        loans: [makeLoan('a')],
        investments: [makeInvestment('x')],
      });
      const next = financeReducer(start, {
        type: 'ImportMerge',
        loans: [makeLoan('b')],
        investments: [makeInvestment('y')],
      });
      expect(next.loans.map((l) => l.Id).sort()).toEqual(['a', 'b']);
      expect(next.investments.map((i) => i.Id).sort()).toEqual(['x', 'y']);
    });

    it('overwrites existing items with the same Id (merge-by-Id semantics)', () => {
      const start = stateWith({ loans: [makeLoan('a', { Name: 'Old' })] });
      const next = financeReducer(start, {
        type: 'ImportMerge',
        loans: [makeLoan('a', { Name: 'New' })],
        investments: [],
      });
      expect(next.loans).toHaveLength(1);
      expect(next.loans[0].Name).toBe('New');
    });

    it('mixes adds and updates in a single merge', () => {
      const start = stateWith({
        loans: [makeLoan('a', { Name: 'Old A' }), makeLoan('b')],
      });
      const next = financeReducer(start, {
        type: 'ImportMerge',
        loans: [makeLoan('a', { Name: 'New A' }), makeLoan('c')],
        investments: [],
      });
      const byId = new Map(next.loans.map((l) => [l.Id, l]));
      expect(byId.get('a')?.Name).toBe('New A');
      expect(byId.has('b')).toBe(true);
      expect(byId.has('c')).toBe(true);
      expect(next.loans).toHaveLength(3);
    });

    it('empty import leaves data unchanged', () => {
      const start = stateWith({
        loans: [makeLoan('a')],
        investments: [makeInvestment('x')],
      });
      const next = financeReducer(start, {
        type: 'ImportMerge',
        loans: [],
        investments: [],
      });
      expect(next.loans.map((l) => l.Id)).toEqual(['a']);
      expect(next.investments.map((i) => i.Id)).toEqual(['x']);
    });
  });

  describe('Test data toggle (issue #47)', () => {
    it('EnableTestData stashes user data and shows fake data', () => {
      const userLoans = [makeLoan('user-1')];
      const userInvestments = [makeInvestment('user-inv-1')];
      const start = stateWith({
        loans: userLoans,
        investments: userInvestments,
      });
      const fakeLoans = [makeLoan('fake-1')];
      const fakeInvestments = [makeInvestment('fake-inv-1')];

      const next = financeReducer(start, {
        type: 'EnableTestData',
        loans: fakeLoans,
        investments: fakeInvestments,
      });

      expect(next.testDataEnabled).toBe(true);
      expect(next.loans).toEqual(fakeLoans);
      expect(next.investments).toEqual(fakeInvestments);
      expect(next.stashedLoans).toEqual(userLoans);
      expect(next.stashedInvestments).toEqual(userInvestments);
    });

    it('DisableTestData restores the stashed user data and clears fake data', () => {
      const userLoans = [makeLoan('user-1')];
      const userInvestments = [makeInvestment('user-inv-1')];
      const enabled = stateWith({
        testDataEnabled: true,
        loans: [makeLoan('fake-1')],
        investments: [makeInvestment('fake-inv-1')],
        stashedLoans: userLoans,
        stashedInvestments: userInvestments,
      });

      const next = financeReducer(enabled, { type: 'DisableTestData' });

      expect(next.testDataEnabled).toBe(false);
      expect(next.loans).toEqual(userLoans);
      expect(next.investments).toEqual(userInvestments);
      expect(next.stashedLoans).toBeNull();
      expect(next.stashedInvestments).toBeNull();
    });

    it('round-trips: enable then disable restores the exact original data', () => {
      const userLoans = [makeLoan('a'), makeLoan('b')];
      const userInvestments = [makeInvestment('x')];
      const start = stateWith({
        loans: userLoans,
        investments: userInvestments,
      });

      const enabled = financeReducer(start, {
        type: 'EnableTestData',
        loans: [makeLoan('fake')],
        investments: [makeInvestment('fake-inv')],
      });
      const disabled = financeReducer(enabled, { type: 'DisableTestData' });

      expect(disabled.testDataEnabled).toBe(false);
      expect(disabled.loans).toEqual(userLoans);
      expect(disabled.investments).toEqual(userInvestments);
    });

    it('test data never destroys user data even when starting empty', () => {
      const start = initialFinanceState;
      const enabled = financeReducer(start, {
        type: 'EnableTestData',
        loans: [makeLoan('fake')],
        investments: [],
      });
      const disabled = financeReducer(enabled, { type: 'DisableTestData' });
      expect(disabled.loans).toEqual([]);
      expect(disabled.investments).toEqual([]);
    });

    it('edits made while test data is enabled are discarded on disable (stash wins)', () => {
      const userLoans = [makeLoan('real')];
      const start = stateWith({ loans: userLoans });

      // Enable test data, then the user fiddles with the fake data.
      const enabled = financeReducer(start, {
        type: 'EnableTestData',
        loans: [makeLoan('fake')],
        investments: [],
      });
      const edited = financeReducer(enabled, {
        type: 'AddLoan',
        loan: makeLoan('added-while-fake'),
      });
      expect(edited.loans.map((l) => l.Id)).toEqual([
        'fake',
        'added-while-fake',
      ]);

      // Disabling discards those edits and restores the real data.
      const disabled = financeReducer(edited, { type: 'DisableTestData' });
      expect(disabled.loans).toEqual(userLoans);
      expect(disabled.stashedLoans).toBeNull();
    });

    it('EnableTestData is idempotent and does not overwrite an existing stash', () => {
      const userLoans = [makeLoan('real')];
      const enabled = financeReducer(stateWith({ loans: userLoans }), {
        type: 'EnableTestData',
        loans: [makeLoan('fake-1')],
        investments: [],
      });
      const enabledAgain = financeReducer(enabled, {
        type: 'EnableTestData',
        loans: [makeLoan('fake-2')],
        investments: [],
      });
      // Stash must still hold the original user data, not fake-1.
      expect(enabledAgain.stashedLoans).toEqual(userLoans);
      expect(enabledAgain).toBe(enabled);
    });

    it('DisableTestData is a no-op when test data is already off', () => {
      const start = stateWith({ loans: [makeLoan('a')] });
      const next = financeReducer(start, { type: 'DisableTestData' });
      expect(next).toBe(start);
    });
  });

  describe('unknown action', () => {
    it('returns the state unchanged', () => {
      const start = stateWith({ loans: [makeLoan('a')] });
      // @ts-expect-error intentionally passing an invalid action
      const next = financeReducer(start, { type: 'Nonsense' });
      expect(next).toBe(start);
    });
  });
});
