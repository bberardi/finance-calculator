import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  STORAGE_DATA_KEY,
  STORAGE_ENABLED_KEY,
  STORAGE_FIRST_VISIT_KEY,
  saveData,
  loadData,
  clearData,
  isPersistenceEnabled,
  setPersistenceEnabled,
  hasAcknowledgedFirstVisit,
  acknowledgeFirstVisit,
} from './storage-helpers';
import { Loan } from '../models/loan-model';
import { CompoundingFrequency, Investment } from '../models/investment-model';

// The test environment is Node, where `localStorage` does not exist. Install a
// minimal in-memory Storage so the helpers run exactly as they would in a
// browser, and restore the original (undefined) global afterwards.
class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
}

const setStorage = (storage: unknown): void => {
  (globalThis as { localStorage: unknown }).localStorage = storage;
};

const sampleLoan: Loan = {
  Id: 'loan-1',
  Provider: 'Bank',
  Name: 'Mortgage',
  InterestRate: 6.25,
  Principal: 350000,
  CurrentAmount: 332500,
  MonthlyPayment: 2155.18,
  StartDate: new Date(2023, 4, 1),
  EndDate: new Date(2053, 4, 1),
};

const sampleInvestment: Investment = {
  Id: 'inv-1',
  Provider: 'Brokerage',
  Name: 'Index Fund',
  StartDate: new Date(2024, 0, 1),
  StartingBalance: 10000,
  AverageReturnRate: 7,
  CompoundingPeriod: CompoundingFrequency.Monthly,
  RecurringContribution: 500,
  ContributionFrequency: CompoundingFrequency.Monthly,
};

let originalLocalStorage: PropertyDescriptor | undefined;

beforeEach(() => {
  originalLocalStorage = Object.getOwnPropertyDescriptor(
    globalThis,
    'localStorage'
  );
  setStorage(new MemoryStorage());
});

afterEach(() => {
  if (originalLocalStorage) {
    Object.defineProperty(globalThis, 'localStorage', originalLocalStorage);
  } else {
    delete (globalThis as { localStorage?: unknown }).localStorage;
  }
  vi.restoreAllMocks();
});

describe('saveData / loadData round-trip', () => {
  it('persists inputs and hydrates them back to equivalent entities', () => {
    expect(saveData([sampleLoan], [sampleInvestment])).toBe('saved');

    const loaded = loadData();
    expect(loaded).not.toBeNull();
    expect(loaded!.loans).toHaveLength(1);
    expect(loaded!.investments).toHaveLength(1);

    const loan = loaded!.loans[0];
    expect(loan.Id).toBe(sampleLoan.Id);
    expect(loan.Principal).toBe(sampleLoan.Principal);
    expect(loan.StartDate.getTime()).toBe(sampleLoan.StartDate.getTime());
    expect(loan.EndDate.getTime()).toBe(sampleLoan.EndDate.getTime());

    const inv = loaded!.investments[0];
    expect(inv.Id).toBe(sampleInvestment.Id);
    expect(inv.AverageReturnRate).toBe(sampleInvestment.AverageReturnRate);
    expect(inv.StartDate.getTime()).toBe(sampleInvestment.StartDate.getTime());
  });

  it('persists and hydrates scenarios alongside the inputs', () => {
    const scenarios = [
      {
        Id: 's1',
        Name: 'Pay it down',
        ExtraLoanPayments: { 'loan-1': 250 },
        ExtraContributions: {},
      },
    ];
    expect(saveData([sampleLoan], [], scenarios)).toBe('saved');
    expect(loadData()!.scenarios).toEqual(scenarios);
  });

  it('writes inputs-only current-schema JSON under the data key', () => {
    saveData([sampleLoan], []);
    const raw = (globalThis.localStorage as Storage).getItem(STORAGE_DATA_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    // Same serializer the export path uses: current schema, derived data stripped.
    expect(parsed.schemaVersion).toBe(3);
    expect(parsed.loans).toHaveLength(1);
    expect(parsed.loans[0].Id).toBe(sampleLoan.Id);
    // Inputs only — no computed amortization schedule rides along.
    expect(parsed.loans[0]).not.toHaveProperty('AmortizationSchedule');
  });
});

describe('saveData failure modes', () => {
  it('reports quota-exceeded for a QuotaExceededError', () => {
    vi.spyOn(MemoryStorage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    expect(saveData([sampleLoan], [])).toBe('quota-exceeded');
  });

  it("reports quota-exceeded for Firefox's NS_ERROR_DOM_QUOTA_REACHED", () => {
    vi.spyOn(MemoryStorage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'NS_ERROR_DOM_QUOTA_REACHED');
    });
    expect(saveData([sampleLoan], [])).toBe('quota-exceeded');
  });

  it('reports unavailable for a non-quota DOMException', () => {
    vi.spyOn(MemoryStorage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('nope', 'SecurityError');
    });
    expect(saveData([sampleLoan], [])).toBe('unavailable');
  });

  it('reports unavailable for a non-DOMException error (e.g. no storage)', () => {
    setStorage(undefined);
    expect(saveData([sampleLoan], [])).toBe('unavailable');
  });
});

describe('loadData failure modes', () => {
  it('returns null when nothing has been saved', () => {
    expect(loadData()).toBeNull();
  });

  it('returns null when storage is unreadable', () => {
    setStorage(undefined);
    expect(loadData()).toBeNull();
  });

  it('discards malformed JSON instead of throwing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    (globalThis.localStorage as Storage).setItem(
      STORAGE_DATA_KEY,
      'not json {'
    );
    expect(loadData()).toBeNull();
    expect(warn).toHaveBeenCalled();
  });

  it('discards data with an unsupported schema version', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    (globalThis.localStorage as Storage).setItem(
      STORAGE_DATA_KEY,
      JSON.stringify({ schemaVersion: 999, loans: [], investments: [] })
    );
    expect(loadData()).toBeNull();
  });

  it('discards structurally-valid data that fails import validation', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    (globalThis.localStorage as Storage).setItem(
      STORAGE_DATA_KEY,
      JSON.stringify({
        schemaVersion: 2,
        loans: [{ Id: 'x' }], // missing required fields
        investments: [],
      })
    );
    expect(loadData()).toBeNull();
  });
});

describe('clearData', () => {
  it('removes persisted data', () => {
    saveData([sampleLoan], []);
    clearData();
    expect(loadData()).toBeNull();
  });

  it('is silent when storage is unavailable', () => {
    setStorage(undefined);
    expect(() => clearData()).not.toThrow();
  });
});

describe('persistence preference', () => {
  it('defaults to disabled', () => {
    expect(isPersistenceEnabled()).toBe(false);
  });

  it('persists the enabled flag and reads it back', () => {
    setPersistenceEnabled(true);
    expect(
      (globalThis.localStorage as Storage).getItem(STORAGE_ENABLED_KEY)
    ).toBe('true');
    expect(isPersistenceEnabled()).toBe(true);
  });

  it('clears the flag when disabled', () => {
    setPersistenceEnabled(true);
    setPersistenceEnabled(false);
    expect(
      (globalThis.localStorage as Storage).getItem(STORAGE_ENABLED_KEY)
    ).toBeNull();
    expect(isPersistenceEnabled()).toBe(false);
  });

  it('treats any non-"true" stored value as disabled', () => {
    (globalThis.localStorage as Storage).setItem(STORAGE_ENABLED_KEY, 'yes');
    expect(isPersistenceEnabled()).toBe(false);
  });

  it('treats unreadable storage as disabled', () => {
    setStorage(undefined);
    expect(isPersistenceEnabled()).toBe(false);
  });

  it('ignores storage failures when recording the preference', () => {
    setStorage(undefined);
    expect(() => setPersistenceEnabled(true)).not.toThrow();
    expect(() => setPersistenceEnabled(false)).not.toThrow();
  });
});

describe('first-visit notice acknowledgement', () => {
  it('reports not-yet-acknowledged by default', () => {
    expect(hasAcknowledgedFirstVisit()).toBe(false);
  });

  it('records and reads back the acknowledgement', () => {
    acknowledgeFirstVisit();
    expect(
      (globalThis.localStorage as Storage).getItem(STORAGE_FIRST_VISIT_KEY)
    ).toBe('true');
    expect(hasAcknowledgedFirstVisit()).toBe(true);
  });

  it('treats unreadable storage as not-yet-acknowledged', () => {
    setStorage(undefined);
    expect(hasAcknowledgedFirstVisit()).toBe(false);
  });

  it('ignores storage failures when recording the acknowledgement', () => {
    setStorage(undefined);
    expect(() => acknowledgeFirstVisit()).not.toThrow();
  });
});
