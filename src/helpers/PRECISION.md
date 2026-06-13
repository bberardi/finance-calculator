# Precision & Consistency Policy (Math Correctness Charter §4, layer 5)

This document is the single, authoritative statement of how PathWise's financial
math rounds, and of how its two projection engines are kept consistent. It exists
so that rounding is **a decision, not an accident**: every test in the
`src/helpers/**` suite asserts exact values (`toBe`) where this policy defines
them, and every `toBeCloseTo` carries a comment justifying its tolerance against
the rules below.

## 1. Unit and rounding function

- **Money is reasoned about in cents.** The canonical rounding step is
  `Math.round(value * 100) / 100` (spelled `roundToCents` in the helpers).
- `Math.round` is **round-half-up toward +∞** (`2.005 → 2.01`, `-2.005 → -2.00`).
  This is the JavaScript default and is applied uniformly; we do not use
  banker's rounding.
- Rates are **not** rounded. An annual percentage is divided to a periodic rate
  (`rate / 100 / periodsPerYear`) and used at full floating-point precision.

## 2. Where values round (per module)

| Quantity                        | Rounded to cents?        | Notes                                                                                                                                                                                                                |
| ------------------------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getMonthlyPayment` result      | **Yes**, once, on return | Closed-form PMT, then a single `roundToCents`.                                                                                                                                                                       |
| Amortization `InterestPayment`  | **Yes**, each term       | `round(balance × monthlyRate)`.                                                                                                                                                                                      |
| Amortization `PrincipalPayment` | **Yes**, each term       | `round(payment − interest)`, except the final term, which is set to the exact `remainingBalance` so the loan closes at **0** (never negative).                                                                       |
| Amortization `RemainingBalance` | Derived, floored at 0    | Carries the rounded running balance.                                                                                                                                                                                 |
| Investment running value        | **No** between periods   | The running `currentValue` accumulates **unrounded**; only the reported `TotalValue` / `InterestEarned` / `ContributionAmount` on each entry are rounded. This keeps long horizons from accumulating rounding drift. |
| `forecastLoan` balance          | **Yes**, each month      | Balance is re-rounded every month, so the series carries rounded cents.                                                                                                                                              |
| `forecastInvestment` value      | **No** between months    | Running value is unrounded; each emitted `ForecastPoint.Value` is rounded. Matches the investment-growth policy above.                                                                                               |
| `forecastNetWorth` value        | **Yes**, per point       | `round(Σ assets − Σ loan balances)` from the already-rounded per-entity points.                                                                                                                                      |

### Intermediate-rounding consequence

Because the amortization helper rounds `interest` and `principal`
**separately each term**, while `forecastLoan` rounds the **net** balance change
each month, the two could in principle differ by a cent. In practice they do
not — see §4 — but any consistency assertion that ever needs slack must justify
it as "± intra-step rounding order," never as an unexplained fudge factor.

## 3. Exact vs. tolerance in tests

- **Exact (`toBe`)** is required for: `getMonthlyPayment` outputs, every
  amortization entry field, payoff-to-zero, net-worth additivity, and any value
  this policy pins to the cent.
- **`toBeCloseTo`** is permitted only for: comparisons against an externally
  published figure whose own rounding differs from ours (e.g. a spreadsheet's
  `CUMIPMT` totals a per-period rounded series differently than we do), and
  closed-form references evaluated in floating point. Each such use names its
  source and tolerance.

## 4. Cross-implementation consistency (Charter §4, layer 2)

The forecast engine (`forecast-helpers.ts`) and the term/period schedule helpers
(`loan-helpers.ts`, `investment-helpers.ts`) compute the same quantities two ways
and **must not drift**. The enforced, tested guarantees:

- **Loans — exact.** `forecastLoan(loan, EndDate, 0, today = StartDate)` with
  `CurrentAmount = Principal` reproduces `generateAmortizationSchedule`'s
  `RemainingBalance` **month-for-month to the cent** (`forecast-consistency.test.ts`).
- **Investments — exact at compounding boundaries.** `forecastInvestment`
  anchored at the start matches `generateInvestmentGrowth`'s `TotalValue` **to the
  cent** at every compounding boundary (month `period × 12 / periodsPerYear`),
  for monthly/quarterly/annual compounding with monthly/quarterly contributions
  and **no step-up**.

### Known divergence (documented, not yet reconciled)

With **yearly step-ups enabled**, the two investment engines assign a
contribution that lands on an anniversary to **different year numbers** (an
off-by-one in anniversary attribution: the period-indexed
`generateInvestmentGrowth` first steps up one period later than the monthly-grid
`forecastInvestment`). Without step-ups the engines are identical to the cent, so
this is purely a step-up **timing** question, not a compounding error. It is
called out here and — so the suite is not silent about it — encoded as an
executable tripwire in `forecast-consistency.test.ts`: the test
_"forecastInvestment and generateInvestmentGrowth diverge with a yearly step-up"_
uses Vitest's `it.fails` to assert the engines **agree**, which currently throws.
The day the off-by-one is reconciled that body stops throwing and the test flips
red, forcing the fixer to convert it into a normal passing `it` — exactly the
"failing regression test committed before the fix" the Charter's process rule
requires. Until then, the boundary-consistency tests cover only the no-step-up
cases that are provably exact.
