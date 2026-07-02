import { describe, it, expect } from 'vitest';
import { evaluateEnhancement } from './enhancement-helpers';

describe('evaluateEnhancement', () => {
  it('reports recoup %, immediate equity, and appreciated value for a partial-recoup remodel', () => {
    // $30k spent, $21k of value added, home appreciating 3%/yr, 10-year view.
    const result = evaluateEnhancement(30000, 21000, 3, 10);
    expect(result.recoupPercent).toBe(70); // 21000 / 30000
    expect(result.immediateEquityChange).toBe(-9000); // 21000 − 30000
    // 21000 · 1.03^10 = 28222.243937…, rounded to cents by the helper — exact.
    expect(result.addedValueAtYears).toBe(28222.24);
    // ln(30000/21000) / ln(1.03) = 12.0666…, rounded to 1 decimal — exact.
    expect(result.breakEvenYears).toBe(12.1);
  });

  it('breaks even immediately when the value added exceeds the cost', () => {
    const result = evaluateEnhancement(20000, 25000, 3, 5);
    expect(result.recoupPercent).toBe(125);
    expect(result.immediateEquityChange).toBe(5000);
    expect(result.breakEvenYears).toBe(0);
    // 25000 · 1.03^5 = 28981.851858…, rounded to cents — exact.
    expect(result.addedValueAtYears).toBe(28981.85);
  });

  it('never breaks even when the added value is below cost and there is no appreciation', () => {
    const result = evaluateEnhancement(30000, 21000, 0, 10);
    expect(result.breakEvenYears).toBeUndefined();
    // No growth: the added value stays put.
    expect(result.addedValueAtYears).toBe(21000);
  });

  it('never breaks even when nothing of value is added', () => {
    const result = evaluateEnhancement(10000, 0, 3, 5);
    expect(result.recoupPercent).toBe(0);
    expect(result.immediateEquityChange).toBe(-10000);
    expect(result.breakEvenYears).toBeUndefined();
    expect(result.addedValueAtYears).toBe(0);
  });

  it('guards a zero cost (no division): recoupPercent is undefined, not a misleading 0%', () => {
    const result = evaluateEnhancement(0, 5000, 3, 5);
    expect(result.recoupPercent).toBeUndefined();
    expect(result.immediateEquityChange).toBe(5000);
    expect(result.breakEvenYears).toBe(0);
    // 5000 · 1.03^5 = 5796.370371…, rounded to cents — exact.
    expect(result.addedValueAtYears).toBe(5796.37);
  });

  it('clamps a near-immediate break-even to the smallest positive tenth of a year, never 0', () => {
    // valueAdd (100) is strictly below cost (100.01), so break-even must be a
    // positive number of years — but at 100% growth the raw time to close that
    // 1-cent gap is ~0.000144 years, which round1 alone would round down to 0.0
    // and collide with the "already broke even" (valueAdd >= cost) sentinel.
    const result = evaluateEnhancement(100.01, 100, 100, 1);
    expect(result.breakEvenYears).toBe(0.1);
  });
});
