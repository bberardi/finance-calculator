# PathWise Roadmap

> **BLUF**: PathWise forecasts net worth from multiple loans and investments to answer one question most calculators can't: _"Where should my extra money go?"_ As of **v1.0.0** that question is answered — this roadmap now sequences what comes after.

---

## 1. Product Vision

**The gap PathWise fills**: Free calculators handle one loan _or_ one investment at a time. Real decisions ("put $300/mo toward the mortgage, the car loan, or the brokerage account?") require seeing all positions together and comparing what-ifs across them.

**The destination — reached at v1.0.0** (in priority order):

1. See all loans and investments in one place — _done_
2. Persist data so it survives a refresh — _done (Phase 1, #20)_
3. Visualize every position and overall net worth over time — _done (Phase 2, #18)_
4. Overlay what-if scenarios on those projections — _done (Phase 4, #24)_
5. **Answer the money question directly**: given $X extra per month, rank allocations — single targets _and_ splits across loans/investments — by long-term net-worth impact — _done (Phase 5, v1.0.0 — the original reason this app exists)_

Everything past this point (Phases 6–11) is post-1.0 expansion, sequenced but revisitable.

---

## 2. Current State (June 2026, v1.0.0 — Phases 0–5 complete)

PathWise is feature-complete against its founding vision. It persists data, charts every position and net worth over time, surfaces a net-worth dashboard, overlays named what-if scenarios, and — as of 1.0 — ranks where the next dollar does the most good.

- **Stack**: React 19 + TypeScript + Vite 8 + MUI 9 (+ `@mui/x-charts` v9), deployed to GitHub Pages via Actions.
- **Data**: Loan & Investment CRUD (auto-calculated payments, compounding frequencies, recurring contributions, yearly step-ups, amortization/growth popouts, PIT calculators); JSON export/import (schema v3) with ID-based smart merge, validation, and a single versioned migration ladder; opt-in `localStorage` persistence with a first-visit privacy notice and a global error boundary with an "export my data" escape hatch.
- **Forecasting**: a pure, date-indexed engine (`forecast-helpers.ts`) producing per-loan, per-investment, and aggregate net-worth monthly series anchored to today's balances — scenario-aware, and the single source of every projection on screen.
- **Optimizer (1.0)**: a pure `evaluatePlan`/`suggestPlans` engine ranking single-target plans and coarse grid-searched splits, run in a **Web Worker**; the flagship "$X extra/month" panel with a ranked comparison table, one-click "view as scenario," and a custom split builder.
- **Correctness**: the Math Correctness Charter (§4) is in force — reference / consistency / property / edge-case suites, a 100% line+branch coverage gate on `src/helpers/**` in CI, the core/UI purity boundary, and scheduled Stryker mutation testing.

What remains is deferred by design: the quality / a11y / correctness long tail (Phase 6) and the post-1.0 feature phases (7–11).

---

## 3. Key Technical Decisions

Decisions made up front so phases didn't relitigate them. All are now implemented; each records the outcome and any still-live guidance.

- **D1 — Charting: `@mui/x-charts` v9.** ✅ Confirmed by the Phase 2 spike. Matches the MUI stack (theming, dark mode, legend show/hide, tooltips, dashed scenario overlays), MIT-licensed. Recharts was the named fallback; not needed.
- **D2 — State: React Context + `useReducer`.** ✅ Phase 0 (#50). Two collections + UI state in one reducer; no store library. Revisit (Zustand) only if state grows unwieldy.
- **D3 — Forecast engine: one pure, date-indexed, scenario-aware module.** ✅ `src/helpers/forecast-helpers.ts` is the _only_ place projections are computed (`forecastLoan`/`forecastInvestment`/`forecastNetWorth`, anchored to today's balances); `loan-helpers`/`investment-helpers` remain the inner math on a common monthly axis.
- **D4 — Persistence: `localStorage`, opt-in, inputs-only, versioned.** ✅ Phase 1 (#20). Explicit toggle, disabling clears storage, hydration reuses import validation and runs the D8 ladder.
- **D5 — Versioned export schema.** ✅ v2 in Phase 0 (#41), v3 for scenarios in Phase 4. Import accepts older versions via the D8 ladder.
- **D6 — Keep MUI; modernize deps.** ✅ Phase 0 (#54). No UI-library switch; stack modernized in one pass (MUI 6→9, x-date-pickers 7→9, React 18→19, Vite 5→8), which also unblocked x-charts v9.
- **D7 — Core math is a boundary-enforced layer, not a separate package (yet).** ✅ ESLint forbids `src/helpers/**` and `src/models/**` from importing `react`/`react-dom`/`@mui/*` or any UI folder — purity is a build failure. Kept the engine worker-safe for the Phase 5 optimizer. _Packaging deferred_ until a **graduation trigger**: a genuine second consumer (CLI, second frontend, or publishing `@pathwise/engine`, Phase 11). The boundary makes the eventual `packages/core` extraction a file move, not a refactor.
- **D8 — One versioned schema-migration ladder.** ✅ Seeded in Phase 1; first real step (v2→v3, scenarios) in Phase 4. JSON import and `localStorage` hydration both route through a single `schemaVersion`-keyed `migrate(data)` ladder, so every future bump adds exactly one tested migration step.

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

### Phases 0–5 — ✅ COMPLETE (shipped, v0.7.0 → v1.0.0)

The founding vision is fully shipped (v0.7.0 → v1.0.0). The per-release record now lives in [CHANGELOG.md](./CHANGELOG.md); detailed acceptance criteria live in the merged PRs.

Open math-quality follow-ups surfaced by this work are folded into **Phase 6** (items 6.9–6.10).

---

### Non-goals (identity guardrails for all phases below)

Declared once, up front, so future feature debates have a reference point. Every Phase 6–11 item passes three filters: it serves the core question (forecasting net worth and deciding where money goes), it works with no backend (client-side, data stays on device), and it doesn't turn PathWise into a budgeting app.

- **No transaction/expense tracking, categorization, or budgets** — the BLUF says not a budgeting app; this is the line.
- **No bank account linking** (Plaid etc.) — requires a backend and credentials; would destroy the privacy story.
- **No real-time market data** — PathWise models average rates, not tickers; keeps results deterministic and avoids API keys. (The exploratory holdings/property context item in Phase 9 stays within this line: any news feed is user-supplied and opt-in, stored on device, never hosted by PathWise.)
- **No tax advice** — computing someone's tax return is out of scope.

---

### Phase 6 — Quality & Hardening — _target v1.0.x (patch releases, parallelizable)_

Pay down the UI/test/perf/correctness debt deferred through 1.0. Items are independent and slot in anywhere alongside the feature phases, but are grouped here so the phase has a defined "done."

| #    | Work item                                                                                                                                                                                | Notes / acceptance                                                                                     |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 6.1  | **Accessibility audit**: aria labels on icon buttons, keyboard nav end-to-end, screen-reader pass, color-contrast check                                                                  | The chart "view as table" fallback (Phase 2) feeds this.                                               |
| 6.2  | **UI test coverage**: component tests (React Testing Library + jsdom) for forms / tables / DataManager; a Playwright smoke test (add positions → run optimizer → view as scenario)       | Pragmatic UI coverage targets; the 100% bar in §4 stays scoped to math.                                |
| 6.3  | **DataManager safety**: snackbar soft-undo for import-merge overwrites, plus a pre-merge "what changed" preview (which entities are _added_ vs. _overwritten_) before committing a merge | Merge-by-Id clobbers are otherwise unrecoverable.                                                      |
| 6.4  | **Table scale**: search / filter / grouping and bulk multi-select (delete or duplicate many at once) on the loan/investment tables                                                       | Keeps the tables usable as Phase 7 fills them with cash, property, and custom-asset rows.              |
| 6.5  | **Schedule popout polish**: virtualize the long amortization/growth tables (600+ rows for a 50-year loan) and add a lifetime-totals footer (interest paid / contributed / earned)        | Windowing keeps mobile scrolling smooth; totals are a cheap derivation from series already computed.   |
| 6.6  | **Performance gate**: code-split the heaviest bundles (charts, date pickers, popouts), then add a bundle-size regression budget in `ci.yml` (optionally Lighthouse-CI)                   | Mirrors §4's coverage gate so first paint can't silently regress as Monte Carlo (Phase 9) lands.       |
| 6.7  | **Discoverability**: social/SEO + Open Graph / Twitter-card metadata + preview image in `index.html`; production-correct favicon / app icons served from `public/`                       | Preview image pairs with Phase 11 shareable links; icon sizes prep the Phase 11 PWA install.           |
| 6.8  | **Repo hygiene**: `CHANGELOG.md`, `CONTRIBUTING.md`, issue/PR templates; move `prettier` to `devDependencies`; keep deps current (Dependabot / scheduled bumps)                          | LICENSE already added; this makes the README's contribution invitation discoverable.                   |
| 6.9  | **Date-math migration to dayjs** _(correctness backlog)_: replace raw `Date` stepping in `investment-helpers`; fix the Jan 31 + 1 month → Mar 3 rollover                                 | _Done when_: stepping uses dayjs (D7), the edge test asserts Jan 31 + 1 month → Feb, leap-day covered. |
| 6.10 | **Mutation-score ratchet** _(correctness backlog)_: triage Stryker survivors toward zero and ratchet `thresholds.break` up                                                               | Baseline ~85%, `break` at 83. Next targets: `investment-helpers.ts`, `forecast-helpers.ts`.            |

---

### Phase 7 — Whole Net Worth — _target v1.1_

Make the net-worth line _true_ by holding everything a person owns. Depends only on 1.0; leans on Phase 6.4 (table scale) and bumps the schema via the D8 ladder.

| #   | Work item                            | Notes / acceptance                                                                                                                        |
| --- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 7.1 | **Cash accounts (HYSA/CD/checking)** | Trivial model (balance + APY); big completeness win — most net worth includes cash the app can't currently hold. New simple asset type.   |
| 7.2 | **Property + mortgage pairing**      | Home value + appreciation rate, linked to its mortgage → a **home-equity** series. Makes net worth honest for homeowners. Entity linking. |
| 7.3 | **Custom asset / liability**         | Catch-all with a simple growth/decline rate (car, private loan, collectibles). Escape hatch so no net worth is blocked on a missing type. |

---

### Phase 8 — Better Answers — _target v1.2_

Sharpen the optimizer with the inputs that most change its rankings, and let users compare whole strategies.

| #   | Work item                       | Notes / acceptance                                                                                                                         |
| --- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 8.1 | **Employer match**              | Match % + cap on a contribution, fed into the optimizer. Without it, "pay the 6% loan vs. fund the 401(k) with 50% match" ranks wrong.     |
| 8.2 | **One-time lump-sum payments**  | "Where does a $5k bonus go?" — the one-time counterpart to the monthly optimizer. Scenario engine extension.                               |
| 8.3 | **True monthly payment**        | Escrow, taxes, insurance, PMI with automatic drop-off at 80% LTV (TODO already noted in `loan-model.ts`). Pairs naturally with 7.2.        |
| 8.4 | **Allocation strategy presets** | Pre-built scenario templates: debt-focused, invest-focused, balanced (split by rate), custom — each showing net-worth impact vs. baseline. |
| 8.5 | **Strategy comparison view**    | Side-by-side dashboard: net worth at +5y/+10y/+30y, debt-free date, final asset allocation across the presets.                             |

---

### Phase 9 — Honest Uncertainty — _target v1.3_

Stop overstating certainty on long horizons, and model the growth/decline of what Phase 7 added. Depends on Phase 7 (property) for 9.3–9.4.

| #   | Work item                                                                  | Notes / acceptance                                                                                                                                                  |
| --- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 9.1 | **Monte Carlo mode**                                                       | Replace the single average-return line with volatility-driven percentile bands (fan chart). Runs in a Web Worker; seeded/reproducible. Biggest credibility upgrade. |
| 9.2 | **Inflation toggle**                                                       | Real vs. nominal view of every chart and milestone. Engine post-processing.                                                                                         |
| 9.3 | **Asset appreciation & enhancement** _(needs 7.2)_                         | Model an existing asset appreciating or being enhanced (add a pool/deck, renovation ROI); answers "is this improvement worth it?"                                   |
| 9.4 | **Holdings & property context (news/research)** _(needs 7.2, exploratory)_ | User-supplied feed for investment-holding research **and area real-estate news**. Zero-backend: user pastes an RSS/news URL or their own API key, stored on device. |

---

### Phase 10 — From Calculator to Plan — _target v1.4_

Move from "what is" to "what happens," and make the math legible.

| #    | Work item                                  | Notes / acceptance                                                                                                                                 |
| ---- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 10.1 | **Life-event timeline**                    | Dated one-time events that modify the forecast (buy a house, tuition, windfall, sell a car). Generalizes scenarios from "extra $/month" to events. |
| 10.2 | **Payoff strategies (avalanche/snowball)** | Ordered-payoff modes with freed-payment redirection after each payoff — the "snowball" API slot reserved in 5.1.                                   |
| 10.3 | **Retirement / FI mode**                   | Annual-spending input → FI number, projected FI date, coast-FI date. Introduces a lightweight spending-drawdown model over the engine.             |
| 10.4 | **"Show the math" mode**                   | Step-by-step calculation breakdowns behind any number (popover) + a filled-in glossary. Serves the founding "no math done by the user" ethos.      |

---

### Phase 11 — Beyond Personal — _target v2.0_

Take PathWise off the single device without taking on a backend.

| #    | Work item                                   | Notes / acceptance                                                                                                                             |
| ---- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 11.1 | **Shareable links**                         | Compressed state in the URL fragment — share a scenario with zero backend; also doubles as a backup. Serialization (D5).                       |
| 11.2 | **PWA / offline install**                   | Installable app, works offline — a natural fit since there's no backend to lose. Uses the Phase 6.7 icons.                                     |
| 11.3 | **Printable / PDF report**                  | One-page position summary (holdings, net-worth chart, milestones, active plan) — the artifact for a financial conversation.                    |
| 11.4 | **Publish the engine** (`@pathwise/engine`) | Release the charter-verified forecast/optimizer core as an open-source npm package — the D7 graduation trigger; core moves to `packages/core`. |

---

## 6. Sequencing at a Glance

```
Phase 0  Foundations + UX overhaul        ✅ DONE   v0.7.0
   ├── Phase 1  Persistence (#20)         ✅ DONE   v0.8.0
   └── Phase 2  Charts (#18)              ✅ DONE   v0.9.0
           └── Phase 3  Dashboard         ✅ DONE   v0.10.0
                   └── Phase 4  Scenarios (#24)   ✅ DONE   v0.11.0
                           └── Phase 5  Optimizer ✅ DONE   v1.0.0
─────────────────────────────────────────────────────────── 1.0 ───
Phase 6  Quality & Hardening              v1.0.x   (parallel, anytime)
Phase 7  Whole Net Worth                  v1.1
Phase 8  Better Answers                   v1.2
Phase 9  Honest Uncertainty               v1.3     (needs Phase 7)
Phase 10 From Calculator to Plan          v1.4
Phase 11 Beyond Personal                  v2.0
```

Rationale for the order: completeness first (so the net-worth line is true), then answer quality, then statistical honesty, then planning, then distribution. Phase 6 runs in parallel as capacity allows.

---

## 7. Working Agreements (from repo conventions)

- Every PR: `npm test`, `npm run build`, `npm run check:lint`, `npm run check:format` green.
- New business logic lands in `helpers/` with unit tests; UI stays thin.
- **Math Correctness Charter (§4) is non-negotiable**: math-touching PRs ship with cited reference tests, uphold the invariants, and keep `src/helpers/**` at 100% line+branch coverage; math bugs get a failing regression test before the fix.
- Semver bump in `package.json` for behavior changes; update `.github/copilot-instructions.md` and README when structure changes.
- Keep models input-only; derived data is computed, never stored.
