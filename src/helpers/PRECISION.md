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

| Quantity                        | Rounded to cents?        | Notes                                                                                                                                                                                                                                                                              |
| ------------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getMonthlyPayment` result      | **Yes**, once, on return | Closed-form PMT, then a single `roundToCents`.                                                                                                                                                                                                                                     |
| Amortization `InterestPayment`  | **Yes**, each term       | `round(balance × monthlyRate)`.                                                                                                                                                                                                                                                    |
| Amortization `PrincipalPayment` | **Yes**, each term       | `round(payment − interest)`, except the closing term — the scheduled final term, or an early payoff once a normal payment would cover the balance — which is set to the exact `remainingBalance` so the loan closes at **0** (never negative) and no rows are emitted past payoff. |
| Amortization `RemainingBalance` | Derived, floored at 0    | Carries the rounded running balance.                                                                                                                                                                                                                                               |
| Investment running value        | **No** between periods   | The running `currentValue` accumulates **unrounded**; only the reported `TotalValue` / `InterestEarned` / `ContributionAmount` on each entry are rounded. This keeps long horizons from accumulating rounding drift.                                                               |
| `forecastLoan` balance          | **Yes**, each month      | Balance is re-rounded every month, so the series carries rounded cents.                                                                                                                                                                                                            |
| `forecastInvestment` value      | **No** between months    | Running value is unrounded; each emitted `ForecastPoint.Value` is rounded. Matches the investment-growth policy above.                                                                                                                                                             |
| `forecastNetWorth` value        | **Yes**, per point       | `round(Σ assets − Σ loan balances)` from the already-rounded per-entity points.                                                                                                                                                                                                    |

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
- **Investments — one engine.** `generateInvestmentGrowth` and
  `forecastInvestment` are both reads of a single engine, `runInvestmentEngine`
  (`investment-helpers.ts`), so they cannot drift. Compounding boundaries and
  contribution dates are anchored to `StartDate` (`k × interval` months from it,
  clamped to month end, never stepped from a previously clamped date — #199).
  Money dated inside a period `[b, b′)` is credited at `b` and earns the full
  period rate at `b′`; the schedule's final partial period earns the linearly
  pro-rated slice `r·(elapsed/period)`. The per-period factor is floored at zero
  (`max(0, 1 + r)`), so a return at or below −100%/period decays to zero rather
  than flipping sign (#221).
- **Forecast points.** Index 0 is the engine's value at `today` (including the
  pro-rated slice of the period in flight). Every later grid point reads the
  value at the last compounding boundary on or before its date plus the money
  dated before it (the chart steps between compounding dates). Hence the
  forecast equals `generateInvestmentGrowth`'s `TotalValue` **to the cent** at
  every compounding boundary, for every compounding/contribution cadence pair
  (including contributions _less_ frequent than compounding, #187), with or
  without step-ups and employer match, and whatever calendar day the forecast is
  run (#165, #217). A contribution dated exactly on a point's date shows from the
  next point, matching the engine's "value at the start of that day".
- **Investments — `CurrentValue` anchor.** The anchor replaces the modeled value
  of the money already in the account: it earns only the remainder of today's
  compounding period at the next boundary (`1 + r·(1 − f)`, #103), then the full
  rate per period; contributions from `today` on are added exactly as the engine
  credits them (employer-match cap already partly consumed by earlier
  contributions this year).

### Step-up anniversary attribution (ROADMAP §8.1)

Each contribution's step-up year is `getInvestmentYear(contributionDate)` in the
one engine, so the schedule, PIT view and forecast always agree on it. A
hand-derived step-up oracle pins the absolute value in `math-reference.test.ts`.
