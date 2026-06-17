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

Everything past this point (§5 Phase 7) is post-1.0 expansion, curated rather than committed.

---

## 2. Current State (June 2026, v1.0.0 — Phases 0–5 complete)

PathWise is feature-complete against its founding vision. It persists data, charts every position and net worth over time, surfaces a net-worth dashboard, overlays named what-if scenarios, and — as of 1.0 — ranks where the next dollar does the most good.

- **Stack**: React 19 + TypeScript + Vite 8 + MUI 9 (+ `@mui/x-charts` v9), deployed to GitHub Pages via Actions.
- **Data**: Loan & Investment CRUD (auto-calculated payments, compounding frequencies, recurring contributions, yearly step-ups, amortization/growth popouts, PIT calculators); JSON export/import (schema v3) with ID-based smart merge, validation, and a single versioned migration ladder; opt-in `localStorage` persistence with a first-visit privacy notice and a global error boundary with an "export my data" escape hatch.
- **Forecasting**: a pure, date-indexed engine (`forecast-helpers.ts`) producing per-loan, per-investment, and aggregate net-worth monthly series anchored to today's balances — scenario-aware, and the single source of every projection on screen.
- **Optimizer (1.0)**: a pure `evaluatePlan`/`suggestPlans` engine ranking single-target plans and coarse grid-searched splits, run in a **Web Worker**; the flagship "$X extra/month" panel with a ranked comparison table, one-click "view as scenario," and a custom split builder.
- **Correctness**: the Math Correctness Charter (§3) is in force — reference / consistency / property / edge-case suites, a 100% line+branch coverage gate on `src/helpers/**` in CI, the core/UI purity boundary, and scheduled Stryker mutation testing.

What remains is deferred by design: the quality / a11y long tail (Phase 6) and the curated post-1.0 horizons (Phase 7).

---

## 3. Key Technical Decisions

Decisions made up front so phases didn't relitigate them. All are now implemented; each records the outcome and any still-live guidance.

- **D1 — Charting: `@mui/x-charts` v9.** ✅ Confirmed by the Phase 2 spike. Matches the MUI stack (theming, dark mode, legend show/hide, tooltips, dashed scenario overlays), MIT-licensed. Recharts was the named fallback; not needed.
- **D2 — State: React Context + `useReducer`.** ✅ Phase 0 (#50). Two collections + UI state in one reducer; no store library. Revisit (Zustand) only if state grows unwieldy.
- **D3 — Forecast engine: one pure, date-indexed, scenario-aware module.** ✅ `src/helpers/forecast-helpers.ts` is the _only_ place projections are computed (`forecastLoan`/`forecastInvestment`/`forecastNetWorth`, anchored to today's balances); `loan-helpers`/`investment-helpers` remain the inner math on a common monthly axis.
- **D4 — Persistence: `localStorage`, opt-in, inputs-only, versioned.** ✅ Phase 1 (#20). Explicit toggle, disabling clears storage, hydration reuses import validation and runs the D8 ladder.
- **D5 — Versioned export schema.** ✅ v2 in Phase 0 (#41), v3 for scenarios in Phase 4. Import accepts older versions via the D8 ladder.
- **D6 — Keep MUI; modernize deps.** ✅ Phase 0 (#54). No UI-library switch; stack modernized in one pass (MUI 6→9, x-date-pickers 7→9, React 18→19, Vite 5→8), which also unblocked x-charts v9.
- **D7 — Core math is a boundary-enforced layer, not a separate package (yet).** ✅ ESLint forbids `src/helpers/**` and `src/models/**` from importing `react`/`react-dom`/`@mui/*` or any UI folder — purity is a build failure. Kept the engine worker-safe for the Phase 5 optimizer. _Packaging deferred_ until a **graduation trigger**: a genuine second consumer (CLI, second frontend, or publishing `@pathwise/engine`, H5). The boundary makes the eventual `packages/core` extraction a file move, not a refactor.
- **D8 — One versioned schema-migration ladder.** ✅ Seeded in Phase 1; first real step (v2→v3, scenarios) in Phase 4. JSON import and `localStorage` hydration both route through a single `schemaVersion`-keyed `migrate(data)` ladder, so every future bump adds exactly one tested migration step.

---

## 4. Math Correctness Charter (non-negotiable)

PathWise's entire value proposition is that users trust its numbers enough to move real money based on them. A plausible-looking chart on top of a subtly wrong formula is worse than no chart at all. Therefore: **every financial calculation must be provably correct, and the proof must be executable** — tests, not review confidence. This charter applies to the existing helpers and to every future phase. No PR that touches math merges without meeting it.

### Verification layers

Each layer catches a class of error the others miss; all five are required for the math modules (`src/helpers/**`).

| Layer                                   | What it proves                                            | How                                                                                                                                                                                                                                                                                                                                               |
| --------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1. Reference (oracle) tests**         | Formulas match the financial canon                        | Every formula is asserted against externally computed values: spreadsheet functions (`PMT`, `FV`, `IPMT`, `CUMIPMT`), published amortization tables, or closed-form hand derivations. Minimum **two independent reference points per formula**, source cited in a comment next to the test.                                                       |
| **2. Cross-implementation consistency** | The forecast engine and the schedule helpers can't drift  | `forecastLoan` run from `today = StartDate` with `CurrentAmount = Principal` must reproduce `generateAmortizationSchedule` month-for-month within the rounding policy; `forecastInvestment` anchored at the start must match `generateInvestmentGrowth` at every compounding boundary.                                                            |
| **3. Property / invariant tests**       | The math can't be wrong in ways nobody thought to example | Property-based tests (fast-check) over randomized inputs assert invariants: money conservation in cents; balances never negative; more extra payment ⇒ never-later payoff and never-more lifetime interest; net worth = Σ investments − Σ loans pointwise; contributions per year match the configured frequency; step-ups only at anniversaries. |
| **4. Edge-case catalog**                | Boundaries behave                                         | Named tests for: leap-day starts; month-end dates (Jan 31 + 1 month); zero and extreme rates; one-month terms; payment < interest; horizon = today; horizon mid-month; 50-year horizons; float accumulation over 600+ months staying within the rounding policy.                                                                                  |
| **5. Precision policy**                 | Rounding is a decision, not an accident                   | One documented policy (`PRECISION.md`) for where values round to cents and where unrounded intermediates are allowed. Tests assert exact values (`toBe`) wherever the policy defines them; every `toBeCloseTo` carries a comment justifying its tolerance.                                                                                        |

### Enforcement

- **Coverage gate**: 100% line + branch coverage on `src/helpers/**`, wired into CI as a hard threshold. (UI code gets pragmatic targets in Phase 6.)
- **Mutation testing**: Stryker over `src/helpers/**` on a scheduled/pre-release run; surviving mutants triaged to zero or explicitly waived with a comment.
- **Process rules**: a formula change and its reference tests ship in the same PR; every math bug found gets a failing regression test committed before the fix; UI components never re-implement math (enforced by the D7 boundary).

---

## 5. Phased Roadmap

### Phases 0–5 — ✅ COMPLETE (shipped, v0.7.0 → v1.0.0)

The founding vision is fully shipped. Detailed acceptance criteria live in the merged PRs; this is the condensed record.

| Phase | What shipped                                                                                                                                                                                                                                                                                   | Version    | Key PRs                |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ---------------------- |
| **0** | Foundations & UX overhaul: PR CI gate, date-indexed forecast engine, derived-data stripping (export v2), context+reducer, dep modernization (React 19/MUI 9/Vite 8), theme + dark mode, Dialog forms, validation, sample data/empty states, Math Charter + core/UI boundary, correctness sweep | v0.7.x     | #37–#66, #74, #76, #87 |
| **1** | Local persistence (#20): `storage-helpers` + D8 migration ladder, "Save on this device" toggle, first-visit privacy notice, global error boundary with export escape hatch                                                                                                                     | v0.8.0     | #82                    |
| **2** | Visualizations (#18): forecast chart (per-entity + net-worth lines, stable colors, show/hide legend, 5Y/10Y/30Y/Full range, responsive, accessible table fallback)                                                                                                                             | v0.9.0     | #82                    |
| **3** | Net-worth dashboard: summary cards, milestone callouts, table upgrades (sorting, totals, payoff/current columns, principal-paid progress, clone), stated-assumptions panel                                                                                                                     | v0.10.0    | #82                    |
| **4** | Scenario forecasting (#24): named-scenario model + reducer, builder dialog, dotted color-matched overlays, impact summary, persistence via export schema v3 (first D8 migration)                                                                                                               | v0.11.0    | #82                    |
| **5** | **"Next Dollar" optimizer**: pure `evaluatePlan`/`suggestPlans` engine, Web-Worker search, flagship "$X extra/month" panel + ranked comparison, "view as scenario," custom split builder                                                                                                       | **v1.0.0** | #90, #92, #96          |

Open math-quality follow-ups surfaced by this work are tracked in **§7 Correctness Backlog**.

---

### Phase 6 — Quality Pass (parallel / ongoing, patch releases)

_Engineering hygiene; good filler between feature work. The big UX items and dependency upgrades already landed in Phase 0._

- Full accessibility audit: aria labels on icon buttons, keyboard nav end-to-end, screen-reader pass, color-contrast check
- Move `prettier` from `dependencies` to `devDependencies`
- Component tests (React Testing Library + jsdom) for forms, tables, DataManager; Playwright smoke test (add positions → run optimizer → view as scenario); pragmatic coverage targets for UI code
- Keep dependencies current (periodic minor/patch bumps via Dependabot or scheduled PRs)
- Snackbar soft-undo for import-merge overwrites in DataManager (merge-by-Id clobbers are otherwise unrecoverable)
- **Pre-merge "what changed" preview in DataManager**: before an ID-based import merge, show which entities will be _added_ vs. _overwritten_
- **Table search / filter / grouping** on the loan/investment tables — keeps them usable as H3 fills them with cash, property, and custom-asset rows
- **Bulk multi-select table actions**: delete or duplicate multiple entities at once, reusing the confirm + soft-undo pattern
- Code-split the heaviest bundles (MUI X charts, date pickers, popout dialogs) to protect first paint on mobile/GitHub Pages
- **Performance regression gate in CI**: a bundle-size budget (optionally Lighthouse-CI) wired into `ci.yml`, so the code-split win can't silently regress as Monte Carlo (H2) lands — mirroring §4's coverage gate
- **Social/SEO + share metadata in `index.html`**: `<meta name="description">`, Open Graph / Twitter-card tags, and a static preview image (pairs with H5 shareable links)
- **Production-correct favicon / app icons**: serve the icon from `public/` (the current `<link rel="icon">` bypasses Vite's `base` and mistypes the format), plus the sizes a future PWA install (H5) needs
- **Repo health**: `CHANGELOG.md`, `CONTRIBUTING.md`, and issue/PR templates (LICENSE already added) so the README's contribution invitation is discoverable
- **Virtualize the long schedule tables**: `amortization-popout.tsx` and `growth-schedule-popout.tsx` both `.map()` every row into the DOM (600+ for a 50-year monthly loan); window them to keep mobile scrolling smooth without touching the verified math
- **Lifetime-totals footer in the schedule popouts**: total interest paid (amortization) and total contributed / interest earned (growth) — a cheap, high-value derivation from series already computed

---

### Phase 7 — Future Horizons (post-1.0, curated)

A curated catalog, not a commitment — pruned to the features actually wanted. Every item still passes three filters: **(1)** it serves the core question — forecasting net worth and deciding where money goes; **(2)** it works with no backend (client-side, GitHub Pages, data stays on device); **(3)** it doesn't turn PathWise into a budgeting app.

#### Non-goals (identity guardrails)

- **No transaction/expense tracking, categorization, or budgets** — the BLUF says not a budgeting app; this is the line
- **No bank account linking** (Plaid etc.) — requires a backend and credentials; would destroy the privacy story
- **No real-time market data** — PathWise models average rates, not tickers; keeps results deterministic and avoids API keys
- **No tax advice** — computing someone's tax return is out of scope

#### H1 — Deeper debt tools

| Feature                                    | What & why                                                                                                            | Builds on                 |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| **One-time lump-sum payments**             | "I got a $5k bonus — where does it go?" The one-time counterpart to the monthly optimizer.                            | Scenario engine extension |
| **Payoff strategies (avalanche/snowball)** | Ordered-payoff modes with freed-payment redirection after each payoff — the "snowball mode" API slot reserved in 5.1. | Optimizer engine          |
| **True monthly payment**                   | Escrow, taxes, insurance, PMI — including automatic PMI drop-off at 80% LTV. (TODO already noted in `loan-model.ts`.) | Loan model fields         |

#### H2 — Smarter investment modeling

| Feature              | What & why                                                                                                                                                                                                                               | Builds on                                   |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| **Employer match**   | Match percentage and cap on a contribution. Free money changes optimizer rankings dramatically — without it, "pay the 6% loan vs. fund the 401(k) with 50% match" gives the wrong answer.                                                | Investment model + optimizer                |
| **Monte Carlo mode** | Replace the single average-return line with volatility-driven percentile bands (fan chart). The biggest credibility upgrade for long horizons — deterministic projections overstate certainty. Run in a Web Worker; seeded/reproducible. | Engine + charts; sizable but self-contained |

#### H3 — The full net worth picture

| Feature                                           | What & why                                                                                                                                                                                            | Builds on                        |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| **Cash accounts (HYSA/CD/checking)**              | Trivial model (balance + APY), big completeness win — most people's net worth includes cash the app currently can't hold.                                                                             | New simple asset type            |
| **Property + mortgage pairing**                   | Home value with an appreciation rate, linked to its mortgage → a **home equity** series on the chart. Makes the net worth line honest for homeowners (currently a mortgage counts as pure liability). | New asset type + entity linking  |
| **Custom asset / liability**                      | Catch-all with a simple growth/decline rate: car (depreciating), private loan to a friend, collectibles. Escape hatch so nobody's net worth is blocked on a missing type.                             | New generic type                 |
| **Asset appreciation & enhancement**              | Model an existing asset appreciating or being enhanced: add a pool/deck (cost vs. property-value increase), renovation ROI. Pairs with property pairing to answer "is this investment worth it?"      | Property model + scenario engine |
| **Investment context & research** _(exploratory)_ | Optional linked research/news relevant to holdings — seeded from the investment type/sector, never real-time market data.                                                                             | Investment model                 |

#### H4 — From calculator to plan

| Feature                  | What & why                                                                                                                                                                                              | Builds on                      |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| **Life-event timeline**  | Dated one-time events that modify the forecast: buy a house (new loan + asset), tuition (withdrawal), windfall, sell a car. A generalization of scenarios from "extra $/month" to "things that happen." | Scenario engine generalization |
| **Inflation toggle**     | Real vs. nominal view of every chart and milestone.                                                                                                                                                     | Engine post-processing         |
| **Retirement / FI mode** | Annual-spending input → FI number, projected FI date, coast-FI date.                                                                                                                                    | H4 + engine                    |

#### H4b — Multi-scenario forecasting templates

| Feature                         | What & why                                                                                                                                                                | Builds on                             |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| **Allocation strategy presets** | Pre-built scenario templates: **debt-focused**, **invest-focused**, **balanced** (split by rate), and **custom**. Each shows its long-term net worth impact vs. baseline. | Phase 4 scenarios + Phase 5 optimizer |
| **Strategy comparison view**    | Side-by-side dashboard comparing all strategies: projected net worth at +5y/+10y/+30y, debt-free date, final asset allocation.                                            | Forecast engine + dashboard           |

#### H5 — Beyond the calculator

| Feature                                     | What & why                                                                                                                                                                        | Builds on                     |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| **Shareable links**                         | Compressed state in the URL fragment — share a scenario with a spouse, advisor, or forum thread with zero backend. Also doubles as a backup.                                      | Serialization (D5)            |
| **PWA / offline install**                   | Installable app, works offline — a natural fit since there's no backend to lose.                                                                                                  | Build config + service worker |
| **Printable / PDF report**                  | One-page position summary: holdings, net worth chart, milestones, active plan. The artifact people bring to a financial conversation.                                             | Dashboard                     |
| **"Show the math" mode**                    | Step-by-step calculation breakdowns behind any number (popover) + a filled-in glossary. Serves the founding ethos — _no math done by the user_ — and becomes the education layer. | UI layer over helpers         |
| **Publish the engine** (`@pathwise/engine`) | Release the charter-verified forecast/optimizer core as an open-source npm package — and the D7 graduation trigger: the moment the core moves into a workspace package.           | D7 boundary + charter (§4)    |

#### Suggested post-1.0 sequencing

| Release | Theme                       | Contents                                                                                            |
| ------- | --------------------------- | --------------------------------------------------------------------------------------------------- |
| v1.1    | **Whole net worth**         | Cash accounts + property/home equity + custom asset/liability (H3)                                  |
| v1.2    | **Better answers**          | Employer match, lump-sum payments, true monthly payment + allocation presets/comparison (H1/H2/H4b) |
| v1.3    | **Honest uncertainty**      | Monte Carlo fan charts + inflation toggle + asset appreciation + investment context (H2/H3/H4)      |
| v1.4    | **From calculator to plan** | Life-event timeline + retirement/FI mode + avalanche/snowball + "show the math" (H1/H4/H5)          |
| v2.0    | **Beyond personal**         | Shareable links + PWA + printable report + publish the engine (H5)                                  |

Rationale: completeness first (so the net worth line is true), then answer quality, then statistical honesty, then planning, then distribution.

---

## 6. Sequencing at a Glance

```
Phase 0  Foundations + UX overhaul        ✅ DONE   v0.7.0
   ├── Phase 1  Persistence (#20)         ✅ DONE   v0.8.0
   └── Phase 2  Charts (#18)              ✅ DONE   v0.9.0
           └── Phase 3  Dashboard         ✅ DONE   v0.10.0
                   └── Phase 4  Scenarios (#24)   ✅ DONE   v0.11.0
                           └── Phase 5  Optimizer ✅ DONE   v1.0.0
Phase 6  Quality items slot in anywhere
Phase 7  Curated future horizons (v1.1 → v2.0 sequencing in §5)
```

---

## 7. Working Agreements & Correctness Backlog

### Working agreements (from repo conventions)

- Every PR: `npm test`, `npm run build`, `npm run check:lint`, `npm run check:format` green
- New business logic lands in `helpers/` with unit tests; UI stays thin
- **Math Correctness Charter (§4) is non-negotiable**: math-touching PRs ship with cited reference tests, uphold the invariants, and keep `src/helpers/**` at 100% line+branch coverage; math bugs get a failing regression test before the fix
- Semver bump in `package.json` for behavior changes; update `.github/copilot-instructions.md` and README when structure changes
- Keep models input-only; derived data is computed, never stored

### Open correctness items

These are prerequisites-of-trust, not features; each is pinned in code/config, so the tracking lives here. Schedule alongside the phases as capacity allows.

- **Migrate forecast/investment date math to dayjs** (Phase 6). `investment-helpers` date stepping still uses raw `Date` arithmetic, which has a silent month-end rollover quirk (**Jan 31 + 1 month → Mar 3**). Pinned by `math-edge-cases.test.ts`. _Done when_: `getNextCompoundingDate`/forecast date stepping use dayjs (consistent with D7), the edge test asserts correct calendar behavior (Jan 31 + 1 month → Feb), and regression tests cover month-end and leap-day stepping.
- **Ratchet the Stryker mutation threshold toward zero survivors.** Baseline (2026-06-13) overall ~85%; `thresholds.break` at 83. _Done when_: surviving mutants are triaged (killed or explicitly waived as equivalent) and `break` is ratcheted up as the score improves. Next targets: `investment-helpers.ts`, `forecast-helpers.ts`. (The `format-helpers.ts` `Intl.NumberFormat`-cache survivors are a documented equivalent-mutant waiver.)
- _(Resolved 2026-06-14)_ Step-up anniversary off-by-one between the two investment engines — `forecastInvestment` and `generateInvestmentGrowth` now agree to the cent with or without step-ups; pinned by a tripwire in `forecast-consistency.test.ts`, a reference oracle in `math-reference.test.ts`, and `PRECISION.md` §4.
