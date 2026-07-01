import { describe, it, expect } from 'vitest';
import {
  DEFAULT_INFLATION_PCT,
  toRealSeries,
  toRealValue,
  toRealValueOverYears,
} from './inflation-helpers';

describe('toRealValueOverYears', () => {
  it('leaves a value unchanged at zero years', () => {
    expect(toRealValueOverYears(1000, 0, 3)).toBe(1000);
  });

  it('discounts by compound inflation over the years (reference values)', () => {
    // 1000 / 1.03^10 = 744.09; 1000 / 1.03^30 = 411.99.
    expect(toRealValueOverYears(1000, 10, 3)).toBeCloseTo(744.09, 2);
    expect(toRealValueOverYears(1000, 30, 3)).toBeCloseTo(411.99, 2);
  });

  it('is a no-op at zero inflation', () => {
    expect(toRealValueOverYears(1000, 30, 0)).toBe(1000);
  });

  it('defaults to the documented inflation rate', () => {
    expect(toRealValueOverYears(1000, 10)).toBeCloseTo(
      1000 / Math.pow(1 + DEFAULT_INFLATION_PCT / 100, 10),
      6
    );
  });
});

describe('toRealValue', () => {
  const today = new Date(2025, 0, 1);

  it('discounts by the years between today and the value date', () => {
    expect(toRealValue(1000, new Date(2035, 0, 1), today, 3)).toBeCloseTo(
      744.09,
      1
    );
    // A value dated today is already in today's dollars.
    expect(toRealValue(1000, today, today, 3)).toBe(1000);
  });
});

describe('toRealSeries', () => {
  const today = new Date(2025, 0, 1);
  const dates = [
    new Date(2025, 0, 1), // today
    new Date(2030, 0, 1), // +5y
    new Date(2035, 0, 1), // +10y
  ];

  it('deflates each point by its date, leaving today unchanged', () => {
    const real = toRealSeries([1000, 1000, 1000], dates, today, 3);
    expect(real[0]).toBe(1000);
    expect(real[1]).toBeCloseTo(862.61, 1); // 1000 / 1.03^5
    expect(real[2]).toBeCloseTo(744.09, 1); // 1000 / 1.03^10
    // Real value declines further out, since more inflation is discounted.
    expect(real[2]).toBeLessThan(real[1]);
  });

  it('returns the nominal series unchanged at zero inflation', () => {
    expect(toRealSeries([1000, 2000, 3000], dates, today, 0)).toEqual([
      1000, 2000, 3000,
    ]);
  });
});
