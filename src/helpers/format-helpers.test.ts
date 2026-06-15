import { describe, it, expect } from 'vitest';
import {
  formatCurrency,
  formatCurrencyCompact,
  formatPercent,
} from './format-helpers';

describe('formatCurrency', () => {
  it('formats a whole-dollar amount with two fraction digits', () => {
    expect(formatCurrency(300000)).toBe('$300,000.00');
  });

  it('formats a fractional amount, rounding to cents', () => {
    expect(formatCurrency(1234.5)).toBe('$1,234.50');
    expect(formatCurrency(1234.567)).toBe('$1,234.57');
  });

  it('formats zero', () => {
    expect(formatCurrency(0)).toBe('$0.00');
  });

  it('formats negative values with a leading minus', () => {
    expect(formatCurrency(-1234.5)).toBe('-$1,234.50');
    expect(formatCurrency(-0.01)).toBe('-$0.01');
  });

  it('formats large values with grouping separators', () => {
    expect(formatCurrency(1000000)).toBe('$1,000,000.00');
    expect(formatCurrency(1234567890.12)).toBe('$1,234,567,890.12');
  });

  it('formats small sub-dollar values', () => {
    expect(formatCurrency(0.5)).toBe('$0.50');
    expect(formatCurrency(0.009)).toBe('$0.01');
  });

  it('matches the prior toLocaleString output exactly', () => {
    // Guard against drift from the implementation it replaced.
    for (const value of [0, 12.34, 99999.99, -42.5, 5000000]) {
      const expected = value.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      expect(formatCurrency(value)).toBe(expected);
    }
  });
});

describe('formatCurrencyCompact', () => {
  it('abbreviates thousands and millions', () => {
    expect(formatCurrencyCompact(6000)).toBe('$6K');
    expect(formatCurrencyCompact(1234567)).toBe('$1.2M');
  });

  it('formats zero and negatives', () => {
    expect(formatCurrencyCompact(0)).toBe('$0');
    expect(formatCurrencyCompact(-6000)).toBe('-$6K');
  });

  it('leaves small values without an abbreviation suffix', () => {
    expect(formatCurrencyCompact(500)).toBe('$500');
  });
});

describe('formatPercent', () => {
  it('defaults to two fraction digits (loan-table behavior)', () => {
    expect(formatPercent(5)).toBe('5.00%');
    expect(formatPercent(3.5)).toBe('3.50%');
  });

  it('honors a custom fraction-digit count (investment-table behavior)', () => {
    expect(formatPercent(5.5, 3)).toBe('5.500%');
    expect(formatPercent(2.1, 3)).toBe('2.100%');
  });

  it('formats zero', () => {
    expect(formatPercent(0)).toBe('0.00%');
    expect(formatPercent(0, 3)).toBe('0.000%');
  });

  it('formats negative percentages', () => {
    expect(formatPercent(-2.5)).toBe('-2.50%');
    expect(formatPercent(-2.5, 3)).toBe('-2.500%');
  });

  it('formats large percentages with grouping', () => {
    expect(formatPercent(1000)).toBe('1,000.00%');
    expect(formatPercent(100)).toBe('100.00%');
  });

  it('rounds to the requested precision', () => {
    expect(formatPercent(3.567)).toBe('3.57%');
    expect(formatPercent(12.345, 3)).toBe('12.345%');
  });

  it('matches the prior loan percent output (percent style /100, 2 digits)', () => {
    for (const value of [5, 5.5, 0, -2.5, 100, 12.345]) {
      const expected = (value / 100).toLocaleString('en-US', {
        style: 'percent',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      expect(formatPercent(value)).toBe(expected);
    }
  });
});
