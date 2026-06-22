import { describe, it, expect } from 'vitest';
import {
  MONARCH_PROVIDER,
  importAssetFromMonarchBalanceCsv,
  importAssetsFromMonarchBalanceCsvFiles,
  parseCsv,
  parseMonarchAmount,
} from './monarch-helpers';
import { AssetType } from '../models/asset-model';
import { CompoundingFrequency } from '../models/investment-model';

describe('parseCsv', () => {
  it('parses a simple comma-separated grid', () => {
    expect(parseCsv('Date,Amount\n2024-01-01,1000')).toEqual([
      ['Date', 'Amount'],
      ['2024-01-01', '1000'],
    ]);
  });

  it('handles CRLF and a trailing newline without emitting a phantom row', () => {
    expect(parseCsv('a,b\r\nc,d\r\n')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  it('keeps commas and newlines inside quoted fields', () => {
    expect(parseCsv('"a,b","c\nd"')).toEqual([['a,b', 'c\nd']]);
  });

  it('unescapes doubled quotes inside a quoted field', () => {
    expect(parseCsv('"she said ""hi"""')).toEqual([['she said "hi"']]);
  });

  it('strips a leading UTF-8 BOM from the first cell', () => {
    expect(parseCsv('﻿Date,Amount')).toEqual([['Date', 'Amount']]);
  });

  it('returns an empty grid for empty input', () => {
    expect(parseCsv('')).toEqual([]);
  });

  it('flushes a final row that ends mid-field (no trailing newline)', () => {
    expect(parseCsv('a,b')).toEqual([['a', 'b']]);
  });

  it('flushes a final row ending on a trailing comma (empty last field)', () => {
    expect(parseCsv('a,')).toEqual([['a', '']]);
  });

  it('treats a lone CR as a row break', () => {
    expect(parseCsv('a\rb')).toEqual([['a'], ['b']]);
  });

  it('emits an empty-string cell for a blank line', () => {
    expect(parseCsv('a\n\nb')).toEqual([['a'], [''], ['b']]);
  });
});

describe('parseMonarchAmount', () => {
  it('parses a plain positive decimal', () => {
    expect(parseMonarchAmount('1000.50')).toBe(1000.5);
  });

  it('parses a negative amount (debt)', () => {
    expect(parseMonarchAmount('-4200')).toBe(-4200);
  });

  it('parses zero', () => {
    expect(parseMonarchAmount('0')).toBe(0);
  });

  it('tolerates a leading + sign', () => {
    expect(parseMonarchAmount('+50')).toBe(50);
  });

  it('strips dollar signs, commas, and whitespace', () => {
    expect(parseMonarchAmount(' $1,234.50 ')).toBe(1234.5);
  });

  it('parses accounting-style parenthesized negatives', () => {
    expect(parseMonarchAmount('(1,234.50)')).toBe(-1234.5);
  });

  it('parses a leading-decimal value', () => {
    expect(parseMonarchAmount('.5')).toBe(0.5);
  });

  it('returns NaN for an empty string', () => {
    expect(parseMonarchAmount('   ')).toBeNaN();
  });

  it('returns NaN for non-numeric text', () => {
    expect(parseMonarchAmount('abc')).toBeNaN();
  });

  it('returns NaN for an unbalanced leading parenthesis', () => {
    // Hits the `startsWith('(') && endsWith(')')` short-circuit (second false).
    expect(parseMonarchAmount('(123')).toBeNaN();
  });
});

// A compact builder for a Monarch balance-history CSV body.
const csv = (lines: string[]): string => lines.join('\n');

describe('importAssetFromMonarchBalanceCsv', () => {
  it('maps a positive account to a custom asset with the latest balance', () => {
    const asset = importAssetFromMonarchBalanceCsv(
      csv([
        'Date,Amount,Account Name',
        '2024-01-01,1000,Chase Checking',
        '2024-02-01,1500,Chase Checking',
      ]),
      'balances.csv'
    );
    expect(asset).toEqual({
      Id: 'monarch:chase-checking',
      Provider: MONARCH_PROVIDER,
      Name: 'Chase Checking',
      AssetType: AssetType.CustomAsset,
      Balance: 1500,
      GrowthRate: 0,
      CompoundingPeriod: CompoundingFrequency.Monthly,
    });
  });

  it('maps a negative account to a custom liability with a positive amount owed', () => {
    const asset = importAssetFromMonarchBalanceCsv(
      csv(['Date,Amount,Account Name', '2024-02-01,-4200.50,Visa Card']),
      'visa.csv'
    );
    expect(asset.AssetType).toBe(AssetType.CustomLiability);
    expect(asset.Balance).toBe(4200.5);
    expect(asset.Name).toBe('Visa Card');
    expect(asset.Id).toBe('monarch:visa-card');
  });

  it('accepts a bare "Account" header as the name column', () => {
    const asset = importAssetFromMonarchBalanceCsv(
      csv(['Date,Amount,Account', '2024-01-01,1000,Fidelity 401k']),
      'acct.csv'
    );
    expect(asset.Name).toBe('Fidelity 401k');
  });

  it('accepts a "Balance" header as an alias for "Amount"', () => {
    const asset = importAssetFromMonarchBalanceCsv(
      csv(['Date,Balance', '2024-01-01,2500']),
      'savings.csv'
    );
    expect(asset.Balance).toBe(2500);
  });

  it('picks the most recent row even when the file is not date-sorted', () => {
    // Newer row first, older row second: the older row must hit the `< bestTime`
    // branch and be ignored.
    const asset = importAssetFromMonarchBalanceCsv(
      csv(['Date,Amount', '2024-03-01,3000', '2024-01-01,1000']),
      'acct.csv'
    );
    expect(asset.Balance).toBe(3000);
  });

  it('falls back to the file name (sans extension) when there is no name column', () => {
    const asset = importAssetFromMonarchBalanceCsv(
      csv(['Date,Amount', '2024-01-01,1000']),
      'Chase Checking.csv'
    );
    expect(asset.Name).toBe('Chase Checking');
    expect(asset.Id).toBe('monarch:chase-checking');
  });

  it('falls back to the file name when the name column is present but blank', () => {
    const asset = importAssetFromMonarchBalanceCsv(
      csv(['Date,Amount,Account Name', '2024-01-01,1000,']),
      'Ally Savings.csv'
    );
    expect(asset.Name).toBe('Ally Savings');
  });

  it('uses a generic name when the file name is only an extension', () => {
    const asset = importAssetFromMonarchBalanceCsv(
      csv(['Date,Amount', '2024-01-01,1000']),
      '.csv'
    );
    expect(asset.Name).toBe('Monarch account');
    expect(asset.Id).toBe('monarch:monarch-account');
  });

  it('slugifies a name made only of punctuation to a stable fallback id', () => {
    const asset = importAssetFromMonarchBalanceCsv(
      csv(['Date,Amount,Account Name', '2024-01-01,1000,!!!']),
      'weird.csv'
    );
    expect(asset.Name).toBe('!!!');
    expect(asset.Id).toBe('monarch:account');
  });

  it('trims surrounding punctuation when building the id slug', () => {
    const asset = importAssetFromMonarchBalanceCsv(
      csv(['Date,Amount,Account Name', '2024-01-01,1000,[Chase!]']),
      'weird.csv'
    );
    expect(asset.Id).toBe('monarch:chase');
  });

  it('ignores rows with non-numeric amounts', () => {
    const asset = importAssetFromMonarchBalanceCsv(
      csv(['Date,Amount', '2024-01-01,pending', '2024-02-01,1500']),
      'acct.csv'
    );
    expect(asset.Balance).toBe(1500);
  });

  it('tolerates a row shorter than the header (missing amount cell)', () => {
    const asset = importAssetFromMonarchBalanceCsv(
      csv(['Date,Amount,Account Name', '2024-01-01', '2024-02-01,1500,Acct']),
      'acct.csv'
    );
    expect(asset.Balance).toBe(1500);
    expect(asset.Name).toBe('Acct');
  });

  it('uses the last numeric row when every date is unparseable', () => {
    // No row updates `best` (all dates invalid), so `fallback` is used.
    const asset = importAssetFromMonarchBalanceCsv(
      csv(['Date,Amount', 'not-a-date,1000', 'also-bad,2000']),
      'acct.csv'
    );
    expect(asset.Balance).toBe(2000);
  });

  it('treats a blank date cell as undated and uses the numeric fallback', () => {
    const asset = importAssetFromMonarchBalanceCsv(
      csv(['Date,Amount', ',1000']),
      'acct.csv'
    );
    expect(asset.Balance).toBe(1000);
  });

  it('throws for an empty file', () => {
    expect(() =>
      importAssetFromMonarchBalanceCsv('\n  \n', 'empty.csv')
    ).toThrow(/empty/i);
  });

  it('rejects a Monarch transactions export with a helpful message', () => {
    const asset = () =>
      importAssetFromMonarchBalanceCsv(
        csv([
          'Date,Merchant,Category,Account,Original Statement,Notes,Amount,Tags',
          '2024-01-01,Coffee,Dining,Checking,POS,,−5,',
        ]),
        'transactions.csv'
      );
    expect(asset).toThrow(/Transactions export/i);
  });

  it('throws when the Date column is missing', () => {
    expect(() =>
      importAssetFromMonarchBalanceCsv(csv(['Foo,Amount', '1,2']), 'bad.csv')
    ).toThrow(/not a recognized/i);
  });

  it('throws when the Amount/Balance column is missing', () => {
    // Date present, amount absent: exercises the second half of the `||` guard.
    expect(() =>
      importAssetFromMonarchBalanceCsv(
        csv(['Date,Foo', '2024-01-01,2']),
        'bad.csv'
      )
    ).toThrow(/not a recognized/i);
  });

  it('throws when there are no numeric rows', () => {
    expect(() =>
      importAssetFromMonarchBalanceCsv(
        csv(['Date,Amount', '2024-01-01,pending', '2024-02-01,n/a']),
        'acct.csv'
      )
    ).toThrow(/no usable balance rows/i);
  });
});

describe('importAssetsFromMonarchBalanceCsvFiles', () => {
  it('maps several per-account files into a list of assets', () => {
    const assets = importAssetsFromMonarchBalanceCsvFiles([
      { text: csv(['Date,Amount', '2024-01-01,1000']), name: 'Checking.csv' },
      { text: csv(['Date,Amount', '2024-01-01,-500']), name: 'Visa.csv' },
    ]);
    expect(assets).toHaveLength(2);
    expect(assets[0].Name).toBe('Checking');
    expect(assets[0].AssetType).toBe(AssetType.CustomAsset);
    expect(assets[1].Name).toBe('Visa');
    expect(assets[1].AssetType).toBe(AssetType.CustomLiability);
    expect(assets[1].Balance).toBe(500);
  });

  it('propagates an error naming the offending file', () => {
    expect(() =>
      importAssetsFromMonarchBalanceCsvFiles([
        { text: csv(['Date,Amount', '2024-01-01,1000']), name: 'good.csv' },
        { text: 'garbage', name: 'broken.csv' },
      ])
    ).toThrow(/"broken\.csv"/);
  });
});
