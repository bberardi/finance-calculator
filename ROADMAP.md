# PathWise Roadmap

> **BLUF**: PathWise forecasts net worth from all your loans, investments, and assets to answer one question most calculators can't: _"Where should my extra money go?"_ That question was answered at **v1.0.0** — this roadmap now sequences what comes after.

---

## 1. Product Vision

**The gap PathWise fills**: Free calculators handle one loan _or_ one investment at a time. Real decisions ("put $300/mo toward the mortgage, the car loan, or the brokerage account?") require seeing all positions together and comparing what-ifs across them.

**The destination — reached at v1.0.0, extended through v1.1**: PathWise already shows all of someone's loans, investments, and assets in one place, persists that data on-device, visualizes every position and overall net worth over time, overlays what-if scenarios on those projections, and — the founding question — ranks where an extra $X/month does the most good. The per-release record of how it got here is in the [CHANGELOG](./CHANGELOG.md).

Everything past this point (Phases 8–11) is forward-looking expansion, sequenced but revisitable.

---

## 2. Current State (v1.1 — Phases 0–7 shipped)

PathWise is feature-complete against its founding vision (v1.0.0) and now holds a whole-balance-sheet net worth (v1.1, Phase 7). The shipped, per-release history lives in [CHANGELOG.md](./CHANGELOG.md), and the current feature list in [README.md](./README.md); what follows is the forward-looking plan.

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

Everything shipped through **v1.1 (Phase 7)** now lives in the [CHANGELOG](./CHANGELOG.md) — this section tracks only what is still planned. Phases keep their original numbers for continuity with the shipped history.

### Non-goals (identity guardrails for all phases below)

Declared once, up front, so future feature debates have a reference point. Every Phase 8–11 item passes three filters: it serves the core question (forecasting net worth and deciding where money goes), it works with no backend (client-side, data stays on device), and it doesn't turn PathWise into a budgeting app.

- **No transaction/expense tracking, categorization, or budgets** — the BLUF says not a budgeting app; this is the line.
- **No bank account linking** (Plaid etc.) — requires a backend and credentials; would destroy the privacy story.
- **No real-time market data** — PathWise models average rates, not tickers; keeps results deterministic and avoids API keys. (The exploratory holdings/property context item in Phase 9 stays within this line: any news feed is user-supplied and opt-in, stored on device, never hosted by PathWise.)
- **No tax advice** — computing someone's tax return is out of scope.

---

### Phase 8 — Better Answers — _target v1.2_

Sharpen the optimizer with the inputs that most change its rankings, and let users compare whole strategies.

| #   | Work item                                          | Notes / acceptance                                                                                                                                                                                                                                                                                                      |
| --- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 8.1 | **Employer match** ✅ _shipped v1.6.0_             | Employer matches a % of your contributions up to a % of salary, fed into the optimizer so a matched contribution is valued correctly — the founding "pay the 6% loan vs. fund the 401(k) with a 50% match" case.                                                                                                        |
| 8.2 | **One-time lump-sum payments** ✅ _shipped v1.7.0_ | "Where does a $5k bonus go?" — a Per month / One-time toggle runs the same optimizer over a lump applied now: on a loan it drops principal (interest saved, earlier payoff), on an investment it compounds from month one and earns the match up to the remaining cap. Additive scenario-engine fields, no schema bump. |
| 8.3 | **True monthly payment**                           | Escrow, taxes, insurance, PMI with automatic drop-off at 80% LTV (TODO already noted in `loan-model.ts`). Pairs naturally with 7.2.                                                                                                                                                                                     |
| 8.4 | **Allocation strategy presets**                    | Pre-built scenario templates: debt-focused, invest-focused, balanced (split by rate), custom — each showing net-worth impact vs. baseline.                                                                                                                                                                              |
| 8.5 | **Strategy comparison view**                       | Side-by-side dashboard: net worth at +5y/+10y/+30y, debt-free date, final asset allocation across the presets.                                                                                                                                                                                                          |

---

### Phase 9 — Honest Uncertainty — _target v1.3_

Stop overstating certainty on long horizons, and model the growth/decline of the assets Phase 7 added (shipped v1.1); 9.3–9.4 build on that property model.

| #   | Work item                                                                      | Notes / acceptance                                                                                                                                                  |
| --- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 9.1 | **Monte Carlo mode**                                                           | Replace the single average-return line with volatility-driven percentile bands (fan chart). Runs in a Web Worker; seeded/reproducible. Biggest credibility upgrade. |
| 9.2 | **Inflation toggle**                                                           | Real vs. nominal view of every chart and milestone. Engine post-processing.                                                                                         |
| 9.3 | **Asset appreciation & enhancement** _(builds on 7.2, shipped v1.1)_           | Model an existing asset appreciating or being enhanced (add a pool/deck, renovation ROI); answers "is this improvement worth it?"                                   |
| 9.4 | **Holdings & property context (news/research)** _(builds on 7.2; exploratory)_ | User-supplied feed for investment-holding research **and area real-estate news**. Zero-backend: user pastes an RSS/news URL or their own API key, stored on device. |

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

| #    | Work item                            | Rationale / acceptance                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 14.3 | **Net-worth composition breakdown**  | The dashboard today is four scalar cards (`net-worth-summary.tsx`) and a time-series forecast chart; there is no _composition_ view answering "what is my money in **right now**?" Add a derived allocation breakdown (donut or stacked bar) of current net worth across investments / cash / property / other assets vs. debt. Purely derived from `summarizePositions`, no engine or schema change, and it directly serves the founding "where does my next dollar go?" framing by showing where the dollars already are. |

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

Phases 0–7 have shipped (v0.7.0 → v1.1); the per-release record is in the [CHANGELOG](./CHANGELOG.md). What remains:

```
Phase 8  Better Answers                   v1.2
Phase 9  Honest Uncertainty               v1.3   (builds on the Phase 7 property model)
Phase 10 From Calculator to Plan          v1.4
Phase 11 Beyond Personal                  v2.0
Phase 12 Accessibility & Interaction Polish  v2.1
Phase 13 Data Safety & Goal-Setting       v2.2
Phase 14 Dashboard Insight                v2.3
```

Rationale for the order: completeness (the true net-worth line) already shipped in Phase 7, so what's left is answer quality, then statistical honesty, then planning, then distribution, then accessibility & interaction polish on the now-complete surface, then a data-safety/goal-setting follow-up from the v2.x review, then a dashboard-insight follow-up that adds the last read-only "where is my money?" view.

---

## 7. Working Agreements (from repo conventions)

- Every PR: `npm test`, `npm run build`, `npm run check:lint`, `npm run check:format` green.
- New business logic lands in `helpers/` with unit tests; UI stays thin.
- **Math Correctness Charter (§4) is non-negotiable**: math-touching PRs ship with cited reference tests, uphold the invariants, and keep `src/helpers/**` at 100% line+branch coverage; math bugs get a failing regression test before the fix.
- Semver bump in `package.json` for behavior changes; update `.github/copilot-instructions.md` and README when structure changes.
- Keep models input-only; derived data is computed, never stored.
