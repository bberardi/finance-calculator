// Asset enhancement ROI (ROADMAP 9.3): "is this improvement worth it?" — model a
// one-time enhancement to an appreciating asset (a renovation, a pool, a deck) as
// a cost paid today for an immediate value-add that then appreciates with the
// asset. Answers whether, and when, the improvement pays for itself. Pure and
// framework-free (D7); a small closed-form calculator, no forecast engine needed.

const roundToCents = (value: number): number => Math.round(value * 100) / 100;
const round1 = (value: number): number => Math.round(value * 10) / 10;

export interface EnhancementResult {
  // Value recouped per dollar spent, as a percent (valueAdd / cost × 100). The
  // classic renovation-ROI figure; 100% means the value added equals the cost.
  // Undefined when cost is 0 — "recouped per dollar spent" is undefined when
  // nothing was spent, not 0% (which would misleadingly read as no value back).
  recoupPercent: number | undefined;
  // Immediate change to net worth: the value added minus what you paid. Positive
  // means the improvement is worth more than it cost the moment it's done.
  immediateEquityChange: number;
  // Years until the appreciating added value first covers the sunk cost: 0 when it
  // already does (valueAdd ≥ cost), a positive number when appreciation gets it
  // there, or undefined when it never will (added value below cost with no growth).
  breakEvenYears: number | undefined;
  // The added value grown at the asset's appreciation rate to `years`.
  addedValueAtYears: number;
}

// Evaluate an enhancement of `cost` that adds `valueAdd` to an asset appreciating
// at `appreciationRatePct` per year, over a `years` horizon.
export const evaluateEnhancement = (
  cost: number,
  valueAdd: number,
  appreciationRatePct: number,
  years: number
): EnhancementResult => {
  const growth = appreciationRatePct / 100;

  const recoupPercent = cost > 0 ? round1((valueAdd / cost) * 100) : undefined;
  const immediateEquityChange = roundToCents(valueAdd - cost);
  const addedValueAtYears = roundToCents(
    valueAdd * Math.pow(1 + growth, years)
  );

  let breakEvenYears: number | undefined;
  if (valueAdd >= cost) {
    // Already worth at least what it cost.
    breakEvenYears = 0;
  } else if (valueAdd > 0 && growth > 0) {
    // valueAdd·(1 + growth)^t = cost  ⟹  t = ln(cost / valueAdd) / ln(1 + growth).
    // This branch only runs when valueAdd < cost, so the true break-even is
    // strictly positive; clamp the rounded result to the smallest representable
    // tenth of a year so a tiny gap can't round down to 0 and collide with the
    // valueAdd >= cost ("already broke even") sentinel above.
    breakEvenYears = Math.max(
      0.1,
      round1(Math.log(cost / valueAdd) / Math.log(1 + growth))
    );
  }
  // else: added value can never reach the cost (≤ 0, or no appreciation) → undefined.

  return {
    recoupPercent,
    immediateEquityChange,
    breakEvenYears,
    addedValueAtYears,
  };
};
