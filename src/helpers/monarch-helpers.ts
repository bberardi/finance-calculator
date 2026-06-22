import dayjs from 'dayjs';
import { Asset, AssetType } from '../models/asset-model';
import { CompoundingFrequency } from '../models/investment-model';

// Import Monarch Money "account balance history" CSV exports into PathWise
// Assets. Monarch has no single "all accounts" export; the only file that
// carries balances is the per-account balance history (one CSV per account),
// whose columns are `Date,Amount` with an optional trailing `Account Name`.
// Debt accounts are exported with a negated amount, so the *sign* of the latest
// balance is the only reliable asset-vs-liability signal — there is no account
// type/institution column anywhere in the export.
//
// Mapping (one account per file):
//   - latest row (by date) → today's Balance
//   - amount >= 0 → AssetType.CustomAsset
//   - amount <  0 → AssetType.CustomLiability, Balance = |amount| (owed)
//   - Name  → the Account Name column, else the file name (sans extension)
//   - Provider → "Monarch" (no institution is exported; the user can refine it)
//   - GrowthRate → 0 (Monarch exports no growth rate; the user fills it in)
//
// D7 boundary: pure TypeScript + Day.js, no React/MUI. The result flows through
// the same merge-by-Id import pipeline as JSON, so a stable, content-derived Id
// (`monarch:<slug of name>`) makes a re-import *update* the same entry in place
// rather than create a duplicate.

// The institution placeholder for imported accounts (the export omits it).
export const MONARCH_PROVIDER = 'Monarch';

// Fallback display name when neither the Account Name column nor the file name
// yields anything usable.
const DEFAULT_ACCOUNT_NAME = 'Monarch account';

// Header names (normalized to lower-case, trimmed) that mark a *transactions*
// export rather than a balance history one — used to reject the wrong file with
// a helpful message instead of silently misreading a single transaction.
const TRANSACTION_MARKERS = ['merchant', 'category', 'original statement'];

// A single Monarch CSV awaiting parse: its text plus the original file name,
// which is the name fallback when the CSV omits the Account Name column.
export interface MonarchCsvFile {
  text: string;
  name: string;
}

// The latest usable row distilled from a file: the signed balance and, when the
// CSV carries it, the account's display name.
interface BalanceCandidate {
  amount: number;
  name?: string;
}

/**
 * Parse CSV text into a grid of string cells. A small, dependency-free RFC-4180
 * tokenizer: handles quoted fields (commas and newlines inside quotes), escaped
 * quotes (`""`), CRLF or LF line endings, a leading UTF-8 BOM, and a trailing
 * newline (no phantom final row).
 */
export const parseCsv = (text: string): string[][] => {
  // Strip a leading UTF-8 BOM so the first header cell matches cleanly.
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  const endField = () => {
    row.push(field);
    field = '';
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
  };

  while (i < src.length) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ',') {
      endField();
      i += 1;
      continue;
    }
    if (ch === '\r') {
      endRow();
      i += src[i + 1] === '\n' ? 2 : 1;
      continue;
    }
    if (ch === '\n') {
      endRow();
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }
  // Flush a final row only when there is pending content (so a trailing newline
  // does not emit an empty row).
  if (field !== '' || row.length > 0) {
    endRow();
  }
  return rows;
};

/**
 * Parse a Monarch amount cell into a finite number, or `NaN` when it is not a
 * number. Monarch exports plain decimals (negative for debt), but this tolerates
 * stray `$`/comma/space formatting and parenthesized negatives so a lightly
 * hand-edited file still imports.
 */
export const parseMonarchAmount = (raw: string): number => {
  let s = raw.trim();
  let negative = false;
  // Accounting-style "(1,234.50)" negatives.
  if (s.startsWith('(') && s.endsWith(')')) {
    negative = true;
    s = s.slice(1, -1).trim();
  }
  s = s.replace(/[$,\s]/g, '');
  if (s.startsWith('+')) {
    s = s.slice(1);
  } else if (s.startsWith('-')) {
    negative = !negative;
    s = s.slice(1);
  }
  // Must be a bare decimal once signs/symbols are stripped (no exponents, so the
  // result is always finite).
  if (!/^\d*\.?\d+$/.test(s)) {
    return NaN;
  }
  const n = Number(s);
  return negative ? -n : n;
};

const normalizeHeader = (header: string): string => header.trim().toLowerCase();

// Safe cell read: a data row may be shorter than the header, so a missing cell
// reads as an empty string rather than undefined.
const cellAt = (cells: string[], index: number): string => cells[index] ?? '';

// File name → display name: drop the extension and trim; fall back to a generic
// label when nothing is left.
const nameFromFilename = (filename: string): string => {
  const base = filename.replace(/\.[^.]*$/, '').trim();
  return base === '' ? DEFAULT_ACCOUNT_NAME : base;
};

// Display name → stable, content-derived Id slug. Keeps a re-import of the same
// account idempotent (it overwrites rather than duplicates).
const slugify = (name: string): string => {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug === '' ? 'account' : slug;
};

/**
 * Parse one Monarch "account balance history" CSV into a single Asset. Throws a
 * descriptive, file-named error when the text is empty, is actually a
 * transactions export, lacks the Date/Amount columns, or has no numeric rows.
 */
export const importAssetFromMonarchBalanceCsv = (
  csvText: string,
  filename: string
): Asset => {
  // Drop fully-blank rows (e.g. a stray blank line) so they never count as data.
  const rows = parseCsv(csvText).filter((cells) =>
    cells.some((cell) => cell.trim() !== '')
  );
  if (rows.length === 0) {
    throw new Error(`"${filename}" is empty — no Monarch balance data found.`);
  }

  const header = rows[0].map(normalizeHeader);
  if (TRANSACTION_MARKERS.some((marker) => header.includes(marker))) {
    throw new Error(
      `"${filename}" looks like a Monarch Transactions export. Upload an account balance history CSV (Date, Amount) instead.`
    );
  }

  const dateIdx = header.indexOf('date');
  const amountIdx = header.findIndex((h) => h === 'amount' || h === 'balance');
  if (dateIdx === -1 || amountIdx === -1) {
    throw new Error(
      `"${filename}" is not a recognized Monarch balance history CSV (expected "Date" and "Amount" columns).`
    );
  }
  const nameIdx = header.findIndex(
    (h) => h === 'account name' || h === 'account'
  );

  // Pick the most recent row with a parseable amount. Don't assume the file is
  // date-sorted; tie-break to the later row in file order. If no row has a valid
  // date, fall back to the last row that had a numeric amount.
  let best: BalanceCandidate | undefined;
  let bestTime = -Infinity;
  let fallback: BalanceCandidate | undefined;
  for (const cells of rows.slice(1)) {
    const amount = parseMonarchAmount(cellAt(cells, amountIdx));
    if (Number.isNaN(amount)) {
      continue;
    }
    const rawName = nameIdx === -1 ? '' : cellAt(cells, nameIdx).trim();
    const candidate: BalanceCandidate = {
      amount,
      name: rawName === '' ? undefined : rawName,
    };
    fallback = candidate;

    const rawDate = cellAt(cells, dateIdx).trim();
    const parsed = rawDate === '' ? undefined : dayjs(rawDate);
    if (parsed && parsed.isValid() && parsed.valueOf() >= bestTime) {
      bestTime = parsed.valueOf();
      best = candidate;
    }
  }

  const chosen = best ?? fallback;
  if (!chosen) {
    throw new Error(
      `"${filename}" has no usable balance rows (no numeric amounts found).`
    );
  }

  const accountName = chosen.name ?? nameFromFilename(filename);
  const isLiability = chosen.amount < 0;
  return {
    Id: `monarch:${slugify(accountName)}`,
    Provider: MONARCH_PROVIDER,
    Name: accountName,
    AssetType: isLiability ? AssetType.CustomLiability : AssetType.CustomAsset,
    // Always a positive balance — a liability stores its debt as a positive
    // amount owed, exactly like the rest of the Asset model.
    Balance: Math.abs(chosen.amount),
    GrowthRate: 0,
    CompoundingPeriod: CompoundingFrequency.Monthly,
  };
};

/**
 * Parse several Monarch balance CSVs (one account per file) into Assets. Throws
 * on the first malformed file, naming it, so nothing is half-imported.
 */
export const importAssetsFromMonarchBalanceCsvFiles = (
  files: MonarchCsvFile[]
): Asset[] =>
  files.map((file) => importAssetFromMonarchBalanceCsv(file.text, file.name));
