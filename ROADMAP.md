# PathWise Roadmap

> **BLUF**: PathWise forecasts net worth from all your loans, investments, and assets to answer one question most calculators can't: _"Where should my extra money go?"_ That question was answered at **v1.0.0** — this roadmap now sequences what comes after.

---

## 1. Product Vision

**The gap PathWise fills**: Free calculators handle one loan _or_ one investment at a time. Real decisions ("put $300/mo toward the mortgage, the car loan, or the brokerage account?") require seeing all positions together and comparing what-ifs across them.

**The destination — reached at v1.0.0, extended through v1.1**: PathWise already shows all of someone's loans, investments, and assets in one place, persists that data on-device, visualizes every position and overall net worth over time, overlays what-if scenarios on those projections, and — the founding question — ranks where an extra $X/month does the most good. The per-release record of how it got here is in the [CHANGELOG](./CHANGELOG.md).

Everything past this point (Phases 9–14) is forward-looking expansion, sequenced but revisitable.

---

## 2. Current State (v1.2 — Phases 0–8 shipped)

PathWise is feature-complete against its founding vision (v1.0.0), holds a whole-balance-sheet net worth (v1.1, Phase 7), and has sharpened the optimizer's answers across Phase 8 — employer match, one-time lump sums, true monthly payment, and allocation strategy presets & comparison (v1.2). The shipped, per-release history lives in [CHANGELOG.md](./CHANGELOG.md), and the current feature list in [README.md](./README.md); what follows is the forward-looking plan.

---

## 3. Key Technical Decisions

Decisions made up front so phases didn't relitigate them. All are now implemented; each records the outcome and any still-live guidance.

- **D1 — Charting: `@mui/x-charts` v9.** ✅ Confirmed by the Phase 2 spike. Matches the MUI stack (theming, dark mode, legend show/hide, tooltips, dashed scenario overlays), MIT-licensed. Recharts was the named fallback; not needed.
- **D2 — State: React Context + `useReducer`.** ✅ Phase 0 (#50). Two collections + UI state in one reducer; no store library. Revisit (Zustand) only if state grows unwieldy.
- **D3 — Forecast engine: one pure, date-indexed, scenario-aware module.** ✅ `src/helpers/forecast-helpers.ts` is the _only_ place projections are computed (`forecastLoan`/`forecastInvestment`/`forecastNetWorth`, anchored to today's balances); `loan-helpers`/`investment-helpers` remain the inner math on a common monthly axis.
- **D4 — Persistence: `localStorage`, opt-in, inputs-only, versioned.** ✅ Phase 1 (#20). Explicit toggle, disabling clears storage, hydration reuses import validation and runs the D8 ladder.
- **D5 — Versioned export schema.** ✅ v2 in Phase 0 (#41), v3 for scenarios in Phase 4, v4 for assets in Phase 7. Import accepts older versions via the D8 ladder.
- **D6 — Keep MUI; modernize deps.** ✅ Phase 0 (#54). No UI-library switch; stack modernized in one pass (MUI 6→9, x-date-pickers 7→9, React 18→19, Vite 5→8), which also unblocked x-charts v9.
- **D7 — Core math is a boundary-enforced layer, not a separate package (yet).** ✅ ESLint forbids `src/helpers/**` and `src/models/**` from importing `react`/`react-dom`/`@mui/*` or any UI folder — purity is a build failure. Kept the engine worker-safe for the Phase 5 optimizer. _Packaging deferred_ until a **graduation trigger**: a genuine second consumer (CLI, second frontend, or publishing `@pathwise/engine`, Phase 11). The boundary makes the eventual `packages/core` extraction a file move, not a refactor.
- **D8 — One versioned schema-migration ladder.** ✅ Seeded in Phase 1; first real step (v2→v3, scenarios) in Phase 4, second (v3→v4, assets) in Phase 7. JSON import and `localStorage` hydration both route through a single `schemaVersion`-keyed `migrate(data)` ladder, so every future bump adds exactly one tested migration step.

---

## 4. Math Correctness Charter (non-negotiable)

PathWise's entire value proposition is that users trust its numbers enough to move real money based on them. A plausible-looking chart on top of a subtly wrong formula is worse than no chart at all. Therefore: **every financial calculation must be provably correct, and the proof must be executable** — tests, not review confidence. This charter applies to the existing helpers and to every future phase. No PR that touches math merges without meeting it.

### Verification layers

Each layer catches a class of error the others miss; all five are required for the math modules (`src/helpers/**`).

| Layer                                   | What it proves                                            | How                                                                                                                                                                                                                                                                                         |
| --------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1. Reference (oracle) tests**         | Formulas match the financial canon                        | Every formula is asserted against externally computed values: spreadsheet functions (`PMT`, `FV`, `IPMT`, `CUMIPMT`), published amortization tables, or closed-form hand derivations. Minimum **two independent reference points per formula**, source cited in a comment next to the test. |
| **2. Cross-implementation consistency** | The forecast engine and the schedule helpers can't drift  | `forecastLoan` run from `today = StartDate` with `CurrentAmount = Principal` must reproduce `generateAmortizationSchedule` month-for-month within the rounding policy; `forecastInvestment` anchored at the start must match `generateInvestmentGrowth` at every compounding boundary.      |
| **3. Property / invariant tests**       | The math can't be wrong in ways nobody thought to example | Property-based tests (fast-check) over randomized inputs assert invariants: money conservation in cents; balances never negative; more extra payment ⇒ never-later payoff and never-more lifetime interest; net worth = Σ investments − Σ loans pointwise; step-ups only at anniversaries.  |
| **4. Edge-case catalog**                | Boundaries behave                                         | Named tests for: leap-day starts; month-end dates (Jan 31 + 1 month); zero and extreme rates; one-month terms; payment < interest; horizon = today; horizon mid-month; 50-year horizons; float accumulation over 600+ months staying within the rounding policy.                            |
| **5. Precision policy**                 | Rounding is a decision, not an accident                   | One documented policy (`PRECISION.md`) for where values round to cents and where unrounded intermediates are allowed. Tests assert exact values (`toBe`) wherever the policy defines them; every `toBeCloseTo` carries a comment justifying its tolerance.                                  |

### Enforcement

- **Coverage gate**: 100% line + branch coverage on `src/helpers/**`, wired into CI as a hard threshold. (UI code gets pragmatic targets in Phase 6.)
- **Mutation testing**: Stryker over `src/helpers/**` on a scheduled/pre-release run; surviving mutants triaged to zero or explicitly waived with a comment.
- **Process rules**: a formula change and its reference tests ship in the same PR; every math bug found gets a failing regression test committed before the fix; UI components never re-implement math (enforced by the D7 boundary).

---

## 5. Phased Roadmap

Everything shipped through **v1.2 (Phase 8)** now lives in the [CHANGELOG](./CHANGELOG.md) — this section tracks only what is still planned. Phases keep their original numbers for continuity with the shipped history.

### Non-goals (identity guardrails for all phases below)

Declared once, up front, so future feature debates have a reference point. Every Phase 9–14 item passes three filters: it serves the core question (forecasting net worth and deciding where money goes), it works with no backend (client-side, data stays on device), and it doesn't turn PathWise into a budgeting app.

- **No transaction/expense tracking, categorization, or budgets** — the BLUF says not a budgeting app; this is the line.
- **No bank account linking** (Plaid etc.) — requires a backend and credentials; would destroy the privacy story.
- **No real-time market data** — PathWise models average rates, not tickers; keeps results deterministic and avoids API keys. (The exploratory holdings/property context item in Phase 9 stays within this line: any news feed is user-supplied and opt-in, stored on device, never hosted by PathWise.)
- **No tax advice** — computing someone's tax _return_ is out of scope. (A flat, user-set effective-tax-rate haircut on investment gains — post-processing in the same vein as the inflation toggle — stays in-bounds and is tracked as Phase 15.1; it discounts a projection, it does not compute anyone's taxes.)

---

### Phase 9 — Honest Uncertainty — _target v1.3_

Stop overstating certainty on long horizons, and model the growth/decline of the assets Phase 7 added (shipped v1.1); 9.3–9.4 build on that property model.

| #   | Work item                                                            | Notes / acceptance                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| --- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 9.1 | **Monte Carlo mode** ✅ _shipped v1.11.0_                            | Replaces the single average-return line with volatility-driven percentile bands (a 10th–90th fan chart around the median), seeded/reproducible. Implemented as a lightweight GBM overlay on the deterministic forecast — so it runs inline and memoized, no Web Worker needed. Biggest credibility upgrade.                                                                                                                                                                                                                                             |
| 9.2 | **Inflation toggle** ✅ _shipped v1.12.0_                            | Real vs. nominal view: a dashboard toggle discounts the forecast chart (Monte Carlo fan included) and the +5/+10/+30y net-worth milestones to today's dollars at an assumed 3%/yr. Pure post-processing on the nominal forecast — no engine change.                                                                                                                                                                                                                                                                                                     |
| 9.3 | **Asset appreciation & enhancement** ✅ _shipped v1.13.0_            | Model an existing asset appreciating or being enhanced (add a pool/deck, renovation ROI); answers "is this improvement worth it?" A property row opens a closed-form calculator: enter an improvement's cost and the value it adds, see the recoup %, the immediate net-worth change, and — as the added value appreciates with the home — when it breaks even.                                                                                                                                                                                         |
| 9.4 | **Holdings & property context (news/research)** ✅ _shipped v1.14.0_ | User-curated research links **and area real-estate references** attached per holding (investments and property), each with an optional note. Zero-backend and in-character: links are stored on device, travel with export/import, and are **never fetched** — the app stays offline/deterministic/key-free. Every URL is normalized and validated as a safe `http(s)` link before it can be added or imported. Shipped as an on-device link manager rather than a live RSS/API feed reader, keeping the "no real-time data / no API keys" line intact. |

---

### Phase 10 — From Calculator to Plan — _target v1.4_

Move from "what is" to "what happens," and make the math legible.

| #    | Work item                                   | Notes / acceptance                                                                                                                                                                                                                                                    |
| ---- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 10.1 | **Life-event timeline**                     | Dated one-time events that modify the forecast (buy a house, tuition, windfall, sell a car). Generalizes scenarios from "extra $/month" to events.                                                                                                                    |
| 10.2 | **Payoff strategies (avalanche/snowball)**  | Ordered-payoff modes with freed-payment redirection after each payoff — the "snowball" API slot reserved in 5.1.                                                                                                                                                      |
| 10.3 | **Retirement / FI mode**                    | Annual-spending input → FI number, projected FI date, coast-FI date. Introduces a lightweight spending-drawdown model over the engine.                                                                                                                                |
| 10.4 | **"Show the math" mode**                    | Step-by-step calculation breakdowns behind any number (popover) + a filled-in glossary. Serves the founding "no math done by the user" ethos.                                                                                                                         |
| 10.5 | **Contextual field help & inline glossary** | Short helper text / info tooltips on inputs (Current Value vs. Starting Balance, compounding frequency, step-up) linked to the README glossary. Complements 10.4 by guiding _inputs_ rather than explaining outputs; reduces input errors and mis-anchored forecasts. |

---

### Phase 11 — Beyond Personal — _target v2.0_

Take PathWise off the single device without taking on a backend.

| #    | Work item                                   | Notes / acceptance                                                                                                                                                                       |
| ---- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 11.1 | **Shareable links**                         | Compressed state in the URL fragment — share a scenario with zero backend; also doubles as a backup. Serialization (D5).                                                                 |
| 11.2 | **PWA / offline install**                   | Installable app, works offline — a natural fit since there's no backend to lose. Uses the Phase 6.7 icons.                                                                               |
| 11.3 | **Printable / PDF report**                  | One-page position summary (holdings, net-worth chart, milestones, active plan) — the artifact for a financial conversation.                                                              |
| 11.4 | **Publish the engine** (`@pathwise/engine`) | Release the charter-verified forecast/optimizer core as an open-source npm package — the D7 graduation trigger; core moves to `packages/core`.                                           |
| 11.5 | **CSV export of schedules & positions**     | CSV alongside the existing JSON for the amortization/growth schedules and the position list — lets users take the numbers into the spreadsheets and accountants' tools they already use. |
| 11.6 | **Forecast chart image export (PNG/SVG)**   | One-click download of the current chart — a lightweight, immediate version of the 11.3 PDF report, sharable with no backend.                                                             |

---

### Phase 12 — Accessibility & Interaction Polish — _target v2.1_

Close the accessibility gaps left after Phase 6 and make the multi-position
workflow fast for power users. Surfaced by a June 2026 UX/codebase review; each
item passes the §5 non-goal filters.

| #    | Work item                                | Notes / acceptance                                                                                                                                                                                                                                                      |
| ---- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 12.1 | **Live-region announcements**            | `aria-live`/`role="alert"` so screen readers hear dynamic results — optimizer re-rank, snackbar undo offers, sort and data-load changes. Phase 6.1 shipped labels/landmarks/skip-link but no announcements, leaving the most dynamic surfaces silent to assistive tech. |
| 12.2 | **`prefers-reduced-motion` support**     | Gate dialog/alert/chart transitions on the OS "reduce motion" preference — a WCAG 2.3.3 expectation currently unhandled; cheap to add and removes a vestibular trigger.                                                                                                 |
| 12.3 | **Keyboard shortcuts & command palette** | App-level accelerators (add loan, add investment, undo, toggle persistence) plus a `Ctrl/Cmd-K` palette and a discoverable shortcut help sheet. Navigation today is native tabbing only; speeds up the power-user workflow.                                             |
| 12.4 | **General edit-level undo**              | Extend the existing soft-undo (today scoped to delete and import merges) to cover form edits — saving an edit over a good value currently has no recovery path, unlike every other mutation in the app.                                                                 |

---

### Phase 13 — Data Safety & Goal-Setting — _target v2.2_

Surfaced by a June 2026 follow-up UX/codebase review. These close a data-loss
gap, turn the read-only milestones into something users can aim at, and finish
the spreadsheet round-trip. Each item passes the §5 non-goal filters
(client-side, data stays on device, not a budgeting app). Items are grouped by
category; the rationale column says why each earns a slot.

**Data safety (UX)**

| #    | Work item                 | Rationale / acceptance                                                                                                                                                                                                                                                                                                                                                                                                          |
| ---- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 13.1 | **Unsaved-changes guard** | A `beforeunload` warning when positions exist but on-device persistence is **off**, so an accidental refresh or tab-close can't silently wipe everything the user just entered. There is no such guard today (no `beforeunload` listener anywhere), and the opt-in persistence toggle is the only safety net — a user who hasn't opted in loses all data on reload. Cheap, no backend, prevents the worst first-run experience. |

**New features**

| #    | Work item                    | Rationale / acceptance                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ---- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 13.2 | **Net-worth / savings goal** | A user-set target (e.g. "$1M by 2040" or "debt-free by 2030") drawn as a reference line on the forecast chart, with a projected hit/miss and ETA against the current plan. The milestone callouts today are read-only _projections_ (`milestone-helpers.ts`); a goal turns them into something the optimizer and scenarios can be aimed at — directly serving the founding "where should my money go?" question. Pairs with the Phase 10 FI mode (10.3). |

**Portability**

| #    | Work item                             | Rationale / acceptance                                                                                                                                                                                                                                                                                                                                                                                    |
| ---- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 13.3 | **CSV import (round-trip with 11.5)** | Pair the planned CSV _export_ (11.5) with CSV _import_ of positions, so users can bulk-add loans/investments/assets from the spreadsheets they already keep instead of one dialog at a time. Import is JSON-only today (`data-manager.tsx` accepts `.json` only); CSV is the format most users' existing position data actually lives in. Reuses the D8 validation/migration boundary on the parsed rows. |

**Power-user UX**

| #    | Work item                          | Rationale / acceptance                                                                                                                                                                                                                                                                                                               |
| ---- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 13.4 | **Quick filters by type & status** | Filtering today is a name/provider substring match only (`filter-helpers.ts`); add quick toggles to filter the positions view by type (loan / investment / cash / property / custom) and by active-scenario membership. Helps users with many positions find a row fast — a small, purely-derived UI addition with no engine impact. |

---

### Phase 14 — Dashboard Insight — _target v2.3_

Surfaced by a June 2026 follow-up UX/codebase review. This phase adds the one
read-only dashboard view the "where is my money?" story is still missing. The
item passes the §5 non-goal filters (client-side, data stays on device, not a
budgeting app); the rationale column says why it earns a slot.

**Dashboard insight (UX / visualization)**

| #    | Work item                           | Rationale / acceptance                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ---- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 14.3 | **Net-worth composition breakdown** | The dashboard today is four scalar cards (`net-worth-summary.tsx`) and a time-series forecast chart; there is no _composition_ view answering "what is my money in **right now**?" Add a derived allocation breakdown (donut or stacked bar) of current net worth across investments / cash / property / other assets vs. debt. Purely derived from `summarizePositions`, no engine or schema change, and it directly serves the founding "where does my next dollar go?" framing by showing where the dollars already are. |

---

### Phase 15 — Credibility & Accessibility Follow-ups — _target v2.4_

Surfaced by a July 2026 UX/codebase review. Two items close a stated-but-unplanned
gap and a chart-accessibility gap the earlier reviews left open; two extend the
honesty and onboarding stories. Each passes the §5 non-goal filters (client-side,
data stays on device, not a budgeting app); the rationale column says why each
earns a slot.

**Credibility (extends Phase 9 — Honest Uncertainty)**

| #    | Work item                                   | Rationale / acceptance                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ---- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 15.1 | **After-tax view toggle**                   | A dashboard toggle applies a flat, user-set _effective_ tax rate to investment **gains** (not principal, and not a tax return), completing the nominal → today's-dollars → after-tax honesty trio. The assumptions panel already advertises this — `assumptions-panel.tsx` reads "an after-tax view is still planned" — but nothing on the roadmap tracks it. Pure post-processing on the nominal forecast, exactly like the Phase 9.2 inflation toggle; no engine change. Resolves the mismatch between the in-app copy and the plan, and stops pre-tax growth from overstating what a taxable account is actually worth. |
| 15.2 | **Assumption sensitivity ("tornado") view** | Deterministic single-variable sweeps: nudge one assumption at a time (return rate, appreciation, inflation) by ±X and rank the levers by how much each moves net worth at the horizon. Monte Carlo (9.1) shows the _random_ spread of outcomes; this shows _which assumption matters most_ — a complementary form of honesty about a fixed-rate projection, telling a user which input is worth getting right. Reuses the existing forecast engine over a small parameter grid; memoized, no Web Worker needed.                                                                                                            |

**Accessibility & visualization (extends Phase 12)**

| #    | Work item                                | Rationale / acceptance                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ---- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 15.3 | **Perceptually-accessible chart series** | Chart lines are told apart by **color alone** today — `series-colors.ts` cycles a 10-hue palette by an id hash. Add colorblind-safe hues **and** a non-color channel (dash pattern or per-series marker), and make the legend's hidden/visible state not color-only. Roughly 8% of users can't reliably separate color-only series, and the distinction vanishes in grayscale print (paired with the Phase 11.3/11.6 report/image export). Phase 12 covered motion, keyboard, and live regions but not chart perceptibility. |

**Onboarding UX**

| #    | Work item                                | Rationale / acceptance                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ---- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 15.4 | **Guided first-run & starter templates** | Beyond today's sample data + first-visit notice, offer one-click starter templates ("renter with student loans," "homeowner with a mortgage," "near-retiree") and a short guided tour of the optimizer. The empty state is the highest-friction moment: a multi-position forecast is the product's whole point, and a template lets a newcomer _see_ one — and reach the "where should my next dollar go?" answer — before typing in their own numbers. Purely client-side seed data reusing the sample-data path. |

---

### Phase 16 — Modeling Fidelity & Parity — _target v2.5_

Surfaced by a July 2026 follow-up review. The Phase 12–15 reviews looked at
accessibility, dashboard insight, and post-processing honesty toggles; this one
looked at the **loan engine's own modeling assumptions** and a couple of
cross-position UX-parity gaps the earlier passes left open. Each item passes the
§5 non-goal filters (client-side, data stays on device, not a budgeting app);
the rationale column says why each earns a slot. Items 16.1–16.3 touch the
forecast/amortization math, so the **Math Correctness Charter (§4)** applies —
cited reference tests, upheld invariants, and 100% `src/helpers/**` coverage.

**Modeling fidelity (new features)**

| #    | Work item                                  | Rationale / acceptance                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 16.1 | **Adjustable / scheduled-rate loans**      | The `Loan` model carries a single `InterestRate`, and `assumptions-panel.tsx` already discloses the limitation to users: _"rates are held fixed for the whole projection — no rate changes, ARM resets, or promo expiries."_ Add an optional ordered list of dated rate changes so ARMs, promo-rate balance transfers, and HELOC resets amortize with the rate they will actually carry. Closes the app's own stated gap; deterministic and backend-free. Extends the D3 engine on the shared monthly axis.                                                       |
| 16.2 | **Loan refinance modeling**                | Model replacing an existing loan with a new rate/term (optionally rolling closing costs into the balance) and compare payoff date, lifetime interest, and net worth at horizon **before vs. after** — the same _"is this worth it?"_ framing as the 9.3 enhancement-ROI calculator, applied to the most common household debt decision. Refinancing is distinct from the Phase 10.1 life-event timeline (windfalls/purchases/sales): it re-terms a position rather than adding a dated event. Reuses `forecastLoan` over the old and new terms; editor-flow only. |
| 16.3 | **Biweekly / accelerated payment cadence** | The amortization and forecast engines assume a **monthly** payment cadence; a biweekly schedule (26 half-payments ≈ one extra monthly payment per year) is among the most common real payoff accelerators and today can only be faked by hand-inflating `MonthlyPayment`. Add a payment-frequency option to the loan and convert it to a monthly-equivalent on the existing axis, with charter reference tests against a published biweekly amortization table.                                                                                                   |

**UX parity & control**

| #    | Work item                                   | Rationale / acceptance                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 16.4 | **Include / exclude a position**            | A per-position _"include in net worth"_ toggle that keeps the row and its data but drops it from the projection, so a user can see net worth **with and without** a position — a car loan they are about to retire, a speculative holding — without deleting it and re-entering it later. Distinct from the planned 13.4 quick-filters, which filter the _table view_ rather than the _math_; purely derived, one boolean of new state, no engine change. |
| 16.5 | **Notes & context parity for loans & cash** | The per-holding note / reference-link affordance (9.4) exists only for investments and property (`ResearchLinks` on `Asset`); loans and cash accounts have no freeform note for the context that actually governs them — _"0% until Mar 2027," "CD matures 2026-09," "recast after $10k principal."_ Extend the same on-device, never-fetched note/link model to every position type. Small, in-character, no math impact.                                |

**Performance / technical**

| #    | Work item                          | Rationale / acceptance                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ---- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 16.6 | **Shared memoized forecast cache** | The deterministic net-worth forecast is recomputed independently by the chart, milestones, Monte Carlo overlay, strategy comparison, and the planned tornado sweeps (15.2) — a redundancy that grows with every overlay Phase 15 adds. A single inputs-keyed memo layer over `forecastNetWorth` would cut the repeated recompute and keep interaction smooth on large position sets **without changing any result**. Upholds D3 (one engine); not user-visible. |

---

### Considered but not currently planned

Reviewed against the roadmap and intentionally **not** scheduled. Recorded here so
the decision is explicit and these aren't re-proposed without new justification.

- **Locale & multi-currency display** — making `format-helpers.ts` (today hardcoded
  to `en-US`/`USD`) honor a selected/detected locale and currency symbol. A real
  gap for non-US users, but **not currently planned support**; revisit only on
  demonstrated demand.
- **Balance check-ins** — a periodic prompt to refresh each position's real current
  balance (`Loan.CurrentAmount` / `Investment.CurrentValue`) to keep the
  today-anchor tied to reality. **Not currently planned support.** The underlying
  `CurrentValue` drift is tracked directly as bugs #110 and #125.

---

## 6. Sequencing at a Glance

Phases 0–8 have shipped (v0.7.0 → v1.2); the per-release record is in the [CHANGELOG](./CHANGELOG.md). What remains:

```
Phase 9  Honest Uncertainty               v1.3   (builds on the Phase 7 property model)
Phase 10 From Calculator to Plan          v1.4
Phase 11 Beyond Personal                  v2.0
Phase 12 Accessibility & Interaction Polish  v2.1
Phase 13 Data Safety & Goal-Setting       v2.2
Phase 14 Dashboard Insight                v2.3
Phase 15 Credibility & Accessibility Follow-ups  v2.4  (July 2026 review)
Phase 16 Modeling Fidelity & Parity          v2.5  (July 2026 follow-up review)
```

Rationale for the order: completeness (the true net-worth line) shipped in Phase 7 and answer quality in Phase 8, so what's left is statistical honesty, then planning, then distribution, then accessibility & interaction polish on the now-complete surface, then a data-safety/goal-setting follow-up from the v2.x review, then a dashboard-insight follow-up that adds the last read-only "where is my money?" view, then a credibility/accessibility follow-up that finishes the after-tax honesty trio, makes the chart perceptible without color, and lowers the empty-state barrier, and finally a modeling-fidelity follow-up that closes the loan engine's own stated fixed-rate/monthly-cadence limitations and squares a few cross-position UX-parity gaps.

---

## 7. Working Agreements (from repo conventions)

- Every PR: `npm test`, `npm run build`, `npm run check:lint`, `npm run check:format` green.
- New business logic lands in `helpers/` with unit tests; UI stays thin.
- **Math Correctness Charter (§4) is non-negotiable**: math-touching PRs ship with cited reference tests, uphold the invariants, and keep `src/helpers/**` at 100% line+branch coverage; math bugs get a failing regression test before the fix.
- Semver bump in `package.json` for behavior changes; update `.github/copilot-instructions.md` and README when structure changes.
- Keep models input-only; derived data is computed, never stored.
