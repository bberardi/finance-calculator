import { describe, it, expect } from 'vitest';
import {
  FinanceState,
  financeReducer,
  initialFinanceState,
} from './finance-reducer';
import { Loan } from '../models/loan-model';
import { Investment, CompoundingFrequency } from '../models/investment-model';
import { Scenario } from '../models/scenario-model';

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

    it('merges into stashed real data while sample data is loaded, surviving a later clear (#83)', () => {
      // Start with the user's real data, load samples (real data is stashed),
      // then import. The import must land in the stash, not the visible samples,
      // so it survives ClearSampleData rather than being silently dropped.
      const withUserData = stateWith({ loans: [makeLoan('real')] });
      const loaded = financeReducer(withUserData, {
        type: 'LoadSampleData',
        loans: [makeLoan('sample')],
        investments: [],
      });

      const afterImport = financeReducer(loaded, {
        type: 'ImportMerge',
        loans: [makeLoan('imported')],
        investments: [],
      });

      // Samples stay visible and untouched; the import goes to the stash.
      expect(afterImport.loans.map((l) => l.Id)).toEqual(['sample']);
      expect(afterImport.stashedLoans?.map((l) => l.Id).sort()).toEqual([
        'imported',
        'real',
      ]);

      // Clearing samples restores the real data WITH the import included.
      const cleared = financeReducer(afterImport, { type: 'ClearSampleData' });
      expect(cleared.loans.map((l) => l.Id).sort()).toEqual([
        'imported',
        'real',
      ]);
    });
  });

  describe('Sample data load/clear (roadmap 0.9)', () => {
    it('LoadSampleData stashes user data and shows sample data', () => {
      const userLoans = [makeLoan('user-1')];
      const userInvestments = [makeInvestment('user-inv-1')];
      const start = stateWith({
        loans: userLoans,
        investments: userInvestments,
      });
      const sampleLoans = [makeLoan('sample-1')];
      const sampleInvestments = [makeInvestment('sample-inv-1')];

      const next = financeReducer(start, {
        type: 'LoadSampleData',
        loans: sampleLoans,
        investments: sampleInvestments,
      });

      expect(next.sampleDataLoaded).toBe(true);
      expect(next.loans).toEqual(sampleLoans);
      expect(next.investments).toEqual(sampleInvestments);
      expect(next.stashedLoans).toEqual(userLoans);
      expect(next.stashedInvestments).toEqual(userInvestments);
    });

    it('ClearSampleData restores the stashed user data and clears sample data', () => {
      const userLoans = [makeLoan('user-1')];
      const userInvestments = [makeInvestment('user-inv-1')];
      const loaded = stateWith({
        sampleDataLoaded: true,
        loans: [makeLoan('sample-1')],
        investments: [makeInvestment('sample-inv-1')],
        stashedLoans: userLoans,
        stashedInvestments: userInvestments,
      });

      const next = financeReducer(loaded, { type: 'ClearSampleData' });

      expect(next.sampleDataLoaded).toBe(false);
      expect(next.loans).toEqual(userLoans);
      expect(next.investments).toEqual(userInvestments);
      expect(next.stashedLoans).toBeNull();
      expect(next.stashedInvestments).toBeNull();
    });

    it('round-trips: load then clear restores the exact original data', () => {
      const userLoans = [makeLoan('a'), makeLoan('b')];
      const userInvestments = [makeInvestment('x')];
      const start = stateWith({
        loans: userLoans,
        investments: userInvestments,
      });

      const loaded = financeReducer(start, {
        type: 'LoadSampleData',
        loans: [makeLoan('sample')],
        investments: [makeInvestment('sample-inv')],
      });
      const cleared = financeReducer(loaded, { type: 'ClearSampleData' });

      expect(cleared.sampleDataLoaded).toBe(false);
      expect(cleared.loans).toEqual(userLoans);
      expect(cleared.investments).toEqual(userInvestments);
    });

    it('sample data never destroys user data even when starting empty', () => {
      const start = initialFinanceState;
      const loaded = financeReducer(start, {
        type: 'LoadSampleData',
        loans: [makeLoan('sample')],
        investments: [],
      });
      const cleared = financeReducer(loaded, { type: 'ClearSampleData' });
      expect(cleared.loans).toEqual([]);
      expect(cleared.investments).toEqual([]);
    });

    it('edits made while sample data is loaded are discarded on clear (stash wins)', () => {
      const userLoans = [makeLoan('real')];
      const start = stateWith({ loans: userLoans });

      // Load sample data, then the user fiddles with the samples.
      const loaded = financeReducer(start, {
        type: 'LoadSampleData',
        loans: [makeLoan('sample')],
        investments: [],
      });
      const edited = financeReducer(loaded, {
        type: 'AddLoan',
        loan: makeLoan('added-while-sample'),
      });
      expect(edited.loans.map((l) => l.Id)).toEqual([
        'sample',
        'added-while-sample',
      ]);

      // Clearing discards those edits and restores the real data.
      const cleared = financeReducer(edited, { type: 'ClearSampleData' });
      expect(cleared.loans).toEqual(userLoans);
      expect(cleared.stashedLoans).toBeNull();
    });

    it('LoadSampleData is idempotent and does not overwrite an existing stash', () => {
      const userLoans = [makeLoan('real')];
      const loaded = financeReducer(stateWith({ loans: userLoans }), {
        type: 'LoadSampleData',
        loans: [makeLoan('sample-1')],
        investments: [],
      });
      const loadedAgain = financeReducer(loaded, {
        type: 'LoadSampleData',
        loans: [makeLoan('sample-2')],
        investments: [],
      });
      // Stash must still hold the original user data, not sample-1.
      expect(loadedAgain.stashedLoans).toEqual(userLoans);
      expect(loadedAgain).toBe(loaded);
    });

    it('ClearSampleData is a no-op when sample data is not loaded', () => {
      const start = stateWith({ loans: [makeLoan('a')] });
      const next = financeReducer(start, { type: 'ClearSampleData' });
      expect(next).toBe(start);
    });
  });

  describe('scenarios', () => {
    const makeScenario = (id: string, name = `Scenario ${id}`): Scenario => ({
      Id: id,
      Name: name,
      ExtraLoanPayments: {},
      ExtraContributions: {},
    });

    it('AddScenario appends a scenario', () => {
      const next = financeReducer(initialFinanceState, {
        type: 'AddScenario',
        scenario: makeScenario('s1'),
      });
      expect(next.scenarios.map((s) => s.Id)).toEqual(['s1']);
    });

    it('UpdateScenario replaces in place by Id', () => {
      const start = stateWith({
        scenarios: [makeScenario('s1'), makeScenario('s2')],
      });
      const next = financeReducer(start, {
        type: 'UpdateScenario',
        scenario: makeScenario('s1', 'Renamed'),
      });
      expect(next.scenarios.map((s) => s.Name)).toEqual([
        'Renamed',
        'Scenario s2',
      ]);
    });

    it('DeleteScenario removes by Id and clears it if it was active', () => {
      const start = stateWith({
        scenarios: [makeScenario('s1'), makeScenario('s2')],
        activeScenarioId: 's1',
      });
      const next = financeReducer(start, { type: 'DeleteScenario', id: 's1' });
      expect(next.scenarios.map((s) => s.Id)).toEqual(['s2']);
      expect(next.activeScenarioId).toBeNull();
    });

    it('DeleteScenario keeps the active selection when a different scenario is removed', () => {
      const start = stateWith({
        scenarios: [makeScenario('s1'), makeScenario('s2')],
        activeScenarioId: 's2',
      });
      const next = financeReducer(start, { type: 'DeleteScenario', id: 's1' });
      expect(next.activeScenarioId).toBe('s2');
    });

    it('SetActiveScenario sets and clears the active id', () => {
      const start = stateWith({ scenarios: [makeScenario('s1')] });
      expect(
        financeReducer(start, { type: 'SetActiveScenario', id: 's1' })
          .activeScenarioId
      ).toBe('s1');
      expect(
        financeReducer(stateWith({ activeScenarioId: 's1' }), {
          type: 'SetActiveScenario',
          id: null,
        }).activeScenarioId
      ).toBeNull();
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
