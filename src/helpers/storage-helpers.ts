// On-device persistence (D4 / Phase 1, issue #20). Versioned save/load/clear of
// the inputs-only schema, plus the persistence-enabled preference itself.
//
// D7 boundary: this stays framework-free — it touches only the Web Storage API
// (a browser global, not an import) and reuses the existing export/import
// serializers, so it remains unit-testable in Node with a stubbed
// `localStorage`.
//
// Two design rules from issue #20 / the roadmap:
//   - Inputs only. Serialization goes through `exportToJson`, which already
//     emits the schema-v2, derived-data-free payload (G2 / D5).
//   - Hydration must degrade gracefully. Loading runs through the D8 migration
//     ladder and then the same validator as JSON import (D4); anything corrupt,
//     partial, unmigratable, or unreadable is dropped (returns `null`) instead
//     of throwing, so stale or tampered storage can never white-screen the app.

import { Loan } from '../models/loan-model';
import { Investment } from '../models/investment-model';
import { Scenario } from '../models/scenario-model';
import { exportToJson, importFromJson } from './data-helpers';

/** Where the user's data lives in `localStorage`. */
export const STORAGE_DATA_KEY = 'pathwise:data';
/** Where the "save on this device" preference lives (persisted per issue #20). */
export const STORAGE_ENABLED_KEY = 'pathwise:persistence-enabled';
/** Whether the first-visit on-device-data notice has been dismissed (1.3). */
export const STORAGE_FIRST_VISIT_KEY = 'pathwise:first-visit-acknowledged';

/** Outcome of a save attempt, so the UI can give honest feedback (1.2). */
export type SaveStatus = 'saved' | 'quota-exceeded' | 'unavailable';

/**
 * Was a write rejected because the storage quota is full? Browsers signal this
 * with a `DOMException` named `QuotaExceededError` (Chromium/WebKit) or
 * `NS_ERROR_DOM_QUOTA_REACHED` (Firefox). Anything else is an "unavailable"
 * failure (storage disabled, private-mode restrictions, SSR, …).
 */
const isQuotaExceededError = (error: unknown): boolean =>
  error instanceof DOMException &&
  (error.name === 'QuotaExceededError' ||
    error.name === 'NS_ERROR_DOM_QUOTA_REACHED');

/**
 * Persist the current inputs (schema v2, derived data stripped). Returns a
 * status rather than throwing so callers can surface quota/availability issues
 * without a try/catch at every site.
 */
export const saveData = (
  loans: Loan[],
  investments: Investment[],
  scenarios: Scenario[] = []
): SaveStatus => {
  try {
    globalThis.localStorage.setItem(
      STORAGE_DATA_KEY,
      exportToJson(loans, investments, scenarios)
    );
    return 'saved';
  } catch (error) {
    return isQuotaExceededError(error) ? 'quota-exceeded' : 'unavailable';
  }
};

/**
 * Hydrate previously-saved inputs, or `null` when there is nothing valid to
 * load. Runs through the D8 migration ladder and the JSON-import validator, and
 * treats every failure mode — unreadable storage, malformed JSON, an
 * unmigratable version, or data that fails validation — as "no saved data".
 */
export const loadData = (): {
  loans: Loan[];
  investments: Investment[];
  scenarios: Scenario[];
} | null => {
  let raw: string | null;
  try {
    raw = globalThis.localStorage.getItem(STORAGE_DATA_KEY);
  } catch {
    // Storage unreadable (disabled, private mode, SSR) — behave as if empty.
    return null;
  }

  if (raw === null) {
    return null;
  }

  try {
    // importFromJson runs the payload through the D8 migration ladder and the
    // shared validator, so older stored schemas upgrade forward here too.
    return importFromJson(raw);
  } catch (error) {
    // Corrupt, partial, or unmigratable data must never white-screen the app
    // (D4): drop it and start clean.
    console.warn('PathWise: discarding unreadable saved data.', error);
    return null;
  }
};

/** Remove any persisted data. Best-effort; silent if storage is unavailable. */
export const clearData = (): void => {
  try {
    globalThis.localStorage.removeItem(STORAGE_DATA_KEY);
  } catch {
    // Nothing to clear if storage is unavailable.
  }
};

/**
 * Is on-device persistence currently enabled? The preference itself is stored
 * (issue #20), so it survives a reload. Defaults to `false` (opt-in) and treats
 * unreadable storage as disabled.
 */
export const isPersistenceEnabled = (): boolean => {
  try {
    return globalThis.localStorage.getItem(STORAGE_ENABLED_KEY) === 'true';
  } catch {
    return false;
  }
};

/**
 * Record the persistence preference. Best-effort: failing to store the flag
 * shouldn't break the toggle interaction. Clearing the stored *data* on disable
 * is the caller's responsibility (orchestrated in the UI, 1.2) so this stays a
 * single-purpose setter.
 */
export const setPersistenceEnabled = (enabled: boolean): void => {
  try {
    if (enabled) {
      globalThis.localStorage.setItem(STORAGE_ENABLED_KEY, 'true');
    } else {
      globalThis.localStorage.removeItem(STORAGE_ENABLED_KEY);
    }
  } catch {
    // Persisting the preference is best-effort; ignore storage failures.
  }
};

/**
 * Has the first-visit "your data stays on this device" notice been dismissed
 * (1.3)? Unreadable storage is treated as "not yet seen" so the privacy story
 * still surfaces; the trade-off is it may reappear when storage is unavailable.
 */
export const hasAcknowledgedFirstVisit = (): boolean => {
  try {
    return globalThis.localStorage.getItem(STORAGE_FIRST_VISIT_KEY) === 'true';
  } catch {
    return false;
  }
};

/** Record that the first-visit notice has been dismissed. Best-effort. */
export const acknowledgeFirstVisit = (): void => {
  try {
    globalThis.localStorage.setItem(STORAGE_FIRST_VISIT_KEY, 'true');
  } catch {
    // Best-effort; if we can't record it the notice may reappear next visit.
  }
};
