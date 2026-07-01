import { describe, it, expect } from 'vitest';
import { evaluateEnhancement } from './enhancement-helpers';

describe('evaluateEnhancement', () => {
  it('reports recoup %, immediate equity, and appreciated value for a partial-recoup remodel', () => {
    // $30k spent, $21k of value added, home appreciating 3%/yr, 10-year view.
    const result = evaluateEnhancement(30000, 21000, 3, 10);
    expect(result.recoupPercent).toBe(70); // 21000 / 30000
    expect(result.immediateEquityChange).toBe(-9000); // 21000 − 30000
    // 21000 · 1.03^10 = 28,222.24.
    expect(result.addedValueAtYears).toBeCloseTo(28222.24, 2);
    // Appreciation lifts the added value past the cost after ~12.1 years.
    expect(result.breakEvenYears).toBeCloseTo(12.1, 1);
  });

  it('breaks even immediately when the value added exceeds the cost', () => {
    const result = evaluateEnhancement(20000, 25000, 3, 5);
    expect(result.recoupPercent).toBe(125);
    expect(result.immediateEquityChange).toBe(5000);
    expect(result.breakEvenYears).toBe(0);
    expect(result.addedValueAtYears).toBeCloseTo(28981.85, 2); // 25000 · 1.03^5
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

  it('guards a zero cost (no division), treating any value added as immediate gain', () => {
    const result = evaluateEnhancement(0, 5000, 3, 5);
    expect(result.recoupPercent).toBe(0);
    expect(result.immediateEquityChange).toBe(5000);
    expect(result.breakEvenYears).toBe(0);
    expect(result.addedValueAtYears).toBeCloseTo(5796.37, 2);
  });
});
