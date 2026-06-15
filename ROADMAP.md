# PathWise Roadmap

> **BLUF**: PathWise forecasts net worth from multiple loans and investments to answer one question most calculators can't: _"Where should my extra money go?"_ This roadmap sequences the work to get from today's CRUD-and-tables app to that answer, phase by phase.

---

## 1. Product Vision

**The gap PathWise fills**: Free calculators handle one loan _or_ one investment at a time. Real decisions ("put $300/mo toward the mortgage, the car loan, or the brokerage account?") require seeing all positions together and comparing what-ifs across them.

**The destination** (in priority order):

1. See all loans and investments in one place _(done)_
2. Persist data so it survives a refresh _(issue #20)_
3. Visualize every position and overall net worth over time _(issue #18)_
4. Overlay what-if scenarios on those projections _(issue #24)_
5. **Answer the money question directly**: given $X extra per month, rank allocations — all-in-one _and_ splits across multiple loans/investments — by long-term net worth impact _(the original reason this app exists — not yet an issue)_

---

## 2. Current State Assessment (June 2026, v0.7.0 — Phase 0 complete)

### What exists and works

- React 19 + TypeScript + Vite 8 + MUI 9, deployed to GitHub Pages via Actions (stack modernized in Phase 0)
- Loan CRUD with auto-calculated monthly payment, amortization schedule popout, point-in-time (PIT) calculator
- Investment CRUD with compounding frequencies, recurring contributions, yearly step-ups (flat/%), growth schedule popout, PIT calculator
- JSON export/import with ID-based smart merge and numeric/enum validation
- MUI theme with **dark mode** (persisted), `Dialog`-based add/edit forms with field-level validation and delete confirm + soft-undo, onboarding empty states / labelled sample data, and a **context + reducer** state layer (`Body.tsx` is layout-only)
- **Date-indexed forecast engine** (`forecast-helpers.ts`): per-loan, per-investment, and aggregate net-worth monthly series anchored to today's balances, scenario-aware — ready for charts
- **Math Correctness Charter (§4) in force**: reference / consistency / property / edge-case suites, documented precision policy, a **100% line+branch coverage gate** on `src/helpers/**` in CI, and scheduled Stryker mutation testing. The pre-Phase-2 correctness bug cluster (#44, #46, #51, #52, #53, #57, #59) is fixed; remaining math-quality follow-ups are tracked in §8.

### Architectural gaps — closed by Phase 0

Phase 0 resolved the gaps that blocked the vision: the shared **date-indexed time-series engine** (G1), **derived data computed on demand** instead of stored (G2), a **context + reducer** replacing `Body.tsx` prop drilling (G3), forecasts **anchored to today's actual balance** (G4), **loan extra-payment math** in the engine API (G5), and a **PR CI gate** running tests/lint/format/build (G7).

**The one remaining gap is G6 — no persistence (a refresh wipes everything)** — which is exactly Phase 1 (issue #20).

### UX debt — mostly cleared by Phase 0

The Phase 0 UX overhaul (items 0.6–0.10) cleared the bulk of it: `Popover` forms became accessible `Dialog`s; field-level validation replaced the silently-disabled save button; delete gained a confirmation + soft-undo; the dev-only "Test Data" toggle was removed in favor of labelled sample data; dark mode and theme persistence landed; empty states got real CTAs; and the header/footer were polished with repo/version links. What remains is deferred by design: table sorting / totals / payoff columns and the net-worth summary surface (Phase 3), the README glossary (Phase 5), and the long tail in Phase 6.

---

## 3. Key Technical Decisions

Decisions made up front so phases don't relitigate them. Each is revisitable, but the default is chosen.

### D1 — Charting library: `@mui/x-charts` (community/MIT)

_Status: pending — to be confirmed by the Phase 2 charting spike (item 2.1)._

Matches the existing MUI stack (theming, typography, dark mode for free), MIT-licensed, supports line charts, legends, series highlight/hide, and tooltips. **Version coupling (verified June 2026)**: current x-charts (v9) peer-requires `@mui/material ^7.3 || ^9` — on MUI 6 we'd be pinned to the legacy v7.29 line. This is the main driver behind D6. **Alternative**: Recharts (more battle-tested, larger community) — fall back if x-charts hits a wall on dashed-line scenario overlays or legend toggling. Spike this in Phase 2, item 2.1.

### D2 — State: React Context + `useReducer` (no new dependency)

_Status: ✅ implemented in Phase 0 (#50)._

The app has exactly two collections plus UI state; a context with a reducer (`AddLoan`, `UpdateLoan`, `DeleteLoan`, `ImportMerge`, …) removes the prop drilling without adding a store library. Revisit (Zustand) only if scenario state makes the reducer unwieldy.

### D3 — Forecast engine: one pure module, date-indexed, scenario-aware

_Status: ✅ implemented in Phase 0 (#38); scenario inputs are wired through and exercised further in Phase 4._

New `src/helpers/forecast-helpers.ts` becomes the _only_ place projections are computed:

```ts
// Conceptual API — refine during Phase 0
type MonthlyPoint = { date: Date; value: number };           // loan balance (as liability) or investment value
type ScenarioInput = {
  extraLoanPayments?: Record<string /*loanId*/, number>;     // extra $/month toward principal
  extraContributions?: Record<string /*investmentId*/, number>;
};
forecastLoan(loan, horizon, extra?): MonthlyPoint[]          // anchored to CurrentAmount as of today (G4)
forecastInvestment(inv, horizon, extra?): MonthlyPoint[]
forecastNetWorth(loans, investments, horizon, scenario?): MonthlyPoint[]  // Σ investments − Σ loan balances
```

Default horizon: longest loan schedule, or 30 years from today for investments (per issue #18). Existing `loan-helpers`/`investment-helpers` stay as the inner math; the engine wraps them onto a common monthly date axis.

### D4 — Persistence: `localStorage`, opt-in, inputs only

_Status: pending — Phase 1 (issue #20)._

Per issue #20: explicit toggle, disabling clears stored data, the toggle state itself is stored. Persist a versioned schema (`{ schemaVersion, loans, investments }`) containing **only user inputs** (no derived schedules — depends on G2 fix). Reuse the existing import-validation logic for hydration so corrupt storage degrades gracefully instead of white-screening.

### D5 — Export schema v2

_Status: ✅ implemented in Phase 0 (#41)._

Once derived fields are stripped (G2), exports shrink dramatically. Bump the export `version`, and make import accept both v1 (ignore embedded schedules) and v2. No breaking change for existing user files. Import and `localStorage` hydration both run through the single migration ladder (D8) rather than ad-hoc per-version branches.

### D6 — Keep MUI; dependencies modernized in Phase 0

_Status: ✅ done in Phase 0 (#54)._

**No UI library change.** The UX problems were design/usage problems, not MUI problems — a switch (Tailwind/shadcn, Mantine, etc.) would have been a rewrite with zero feature payoff, and MUI remains a fit for this app. The stack was instead modernized in one coordinated pass (item 0.5): `@mui/material` 6 → 9, `@mui/x-date-pickers` 7 → 9, React 18 → 19, Vite 5 → 8, staged through the official migration guides/codemods and landed _before_ the theme work — which also unblocks `@mui/x-charts` v9 for the Phase 2 chart (see D1).

### D7 — Core math is a boundary-enforced layer, not a separate package (yet)

_Status: ✅ boundary enforced in Phase 0 (#61); packaging still deferred until a graduation trigger._

`src/helpers/` + `src/models/` already form a de facto pure library: TypeScript + dayjs only, zero React/MUI, fully unit-testable in Node. The question is whether to formalize that as a separate package (npm workspace or repo). **Decision: enforce the boundary, defer the packaging.**

- **Now (free, part of 0.11)**: ESLint boundary rules forbid `src/helpers/**` and `src/models/**` from importing `react`, `react-dom`, `@mui/*`, or anything in the UI folders — the purity stops being a convention and becomes a build failure. The Charter's coverage and mutation gates already scope to these folders. UI calls helpers, never the reverse.
- **Not yet (real cost, speculative benefit)**: npm workspaces / TS project references / build orchestration add permanent friction for exactly one consumer. Even the Phase 7 Monte Carlo Web Worker doesn't need a package — a worker imports pure source modules directly under Vite.
- **Graduation triggers** (revisit when any occurs): a genuine second consumer — a CLI, a second frontend, or publishing the engine as an open-source npm package (`@pathwise/engine`, see H5). The boundary rules make the eventual extraction mechanical: if nothing in the core imports UI, moving it to `packages/core` is a file move, not a refactor.

Same philosophy as D2: take the architectural discipline now, skip the speculative tooling until something concrete demands it.

### D8 — One versioned schema-migration ladder

_Status: pending — lands with the first persistence work (Phase 1)._

The persisted schema bumps at least four times across the plan (export v2 in D5, scenarios in 4.5, snapshots in H4, multi-profile in H5). Rather than each reader carrying its own pairwise "accept v_n" backward-compat branch, define a single `schemaVersion`-keyed `migrate(data): CurrentSchema` step ladder that **every** entry point runs through — JSON import (D5), `localStorage` hydration (D4), and every future bump. Each new version adds exactly one migration step, tested to the same standard as the import validator, so old exports and stale `localStorage` upgrade forward deterministically instead of becoming a combinatorial compatibility hazard. Lands with the first persistence work (Phase 1), where stored data first has to survive a version change.

---

## 4. Math Correctness Charter (non-negotiable)

PathWise's entire value proposition is that users trust its numbers enough to move real money based on them. A plausible-looking chart on top of a subtly wrong formula is worse than no chart at all. Therefore: **every financial calculation must be provably correct, and the proof must be executable** — tests, not review confidence. This charter applies retroactively to the existing helpers and to every future phase. No PR that touches math merges without meeting it.

### Verification layers

Each layer catches a class of error the others miss; all five are required for the math modules (`src/helpers/**`).

| Layer                                   | What it proves                                            | How                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --------------------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1. Reference (oracle) tests**         | Formulas match the financial canon                        | Every formula — amortization payment, schedule balances, compound growth, contribution step-ups, payoff timing, net worth aggregation — is asserted against externally computed values: spreadsheet functions (`PMT`, `FV`, `IPMT`, `CUMIPMT`), published amortization tables, or closed-form hand derivations. Minimum **two independent reference points per formula**, with the source cited in a comment next to the test.   |
| **2. Cross-implementation consistency** | The forecast engine and the schedule helpers can't drift  | `forecastLoan` run from `today = StartDate` with `CurrentAmount = Principal` must reproduce `generateAmortizationSchedule` month-for-month within the rounding policy; `forecastInvestment` anchored at the start must match `generateInvestmentGrowth` at every compounding boundary. Any future second implementation of the same quantity gets the same treatment.                                                            |
| **3. Property / invariant tests**       | The math can't be wrong in ways nobody thought to example | Property-based tests (fast-check) over randomized inputs assert invariants: money conservation (balance₍ₜ₊₁₎ = balanceₜ + interest − payment, exactly, in cents); balances never negative; more extra payment ⇒ never-later payoff and never-more lifetime interest; net worth = Σ investments − Σ loans pointwise; contributions per year always match the configured frequency; step-ups change amounts only at anniversaries. |
| **4. Edge-case catalog**                | Boundaries behave                                         | Named tests for: leap-day start dates; month-end dates (Jan 31 + 1 month); zero and extreme rates; one-month terms; payment < interest (negative amortization); horizon = today; horizon mid-month; 50-year horizons; float accumulation over 600+ months staying within the rounding policy.                                                                                                                                    |
| **5. Precision policy**                 | Rounding is a decision, not an accident                   | One documented policy for where values round to cents and where unrounded intermediates are allowed. Tests assert exact values (`toBe`) wherever the policy defines them; every `toBeCloseTo` carries a comment justifying its tolerance.                                                                                                                                                                                        |

### Enforcement

- **Coverage gate**: 100% line + branch coverage on `src/helpers/**`, wired into the CI workflow as a hard threshold — any PR dropping below it fails. (UI code gets pragmatic targets in Phase 6; the 100% bar is for math.)
- **Mutation testing**: Stryker over `src/helpers/**` on a scheduled/pre-release run, surviving mutants triaged to zero or explicitly waived with a comment. Coverage proves the lines ran; mutation testing proves the tests would actually catch a flipped sign or off-by-one.
- **Process rules**: a formula change and its reference tests ship in the same PR; every math bug found — by review, by a user, by chance — gets a failing regression test committed before the fix; UI components never re-implement math (helpers are the single source of truth, enforced by the D7 boundary rules, and relied on by the "show the math" feature in Phase 7).

Implemented as **work item 0.11** (✅ landed in #61) and enforced continuously since — every math PR runs against the coverage gate and the suites above.

---

## 5. Phased Roadmap

Each item is intended to be a single reviewable PR. Phases are ordered by dependency; within a phase, items are ordered. Version bumps follow the repo's semver convention (minor per feature phase).

---

### Phase 0 — Foundations & UX Overhaul — ✅ COMPLETE (v0.7.0 + patch releases)

_Unblocked everything else and rebuilt the baseline experience. Shipped in full; kept here as a condensed record — the detailed acceptance criteria live in the merged PRs._

| #        | Work item                                                                                                                                                                                    | Shipped in    |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| 0.1      | PR CI workflow: test / lint / format / build on every PR (G7)                                                                                                                                | #37           |
| 0.2      | Date-indexed forecast engine, incl. loan extra-payment math (D3 / G1 / G4 / G5)                                                                                                              | #38           |
| 0.3      | Strip derived data from models; export schema v2 (G2 / D5)                                                                                                                                   | #41           |
| 0.4      | Context + reducer state layer; `Body.tsx` layout-only (D2) — closed #48, #49                                                                                                                 | #50           |
| 0.5      | Dependency modernization: React 19, MUI 9, Vite 8 (D6)                                                                                                                                       | #54           |
| 0.6–0.10 | UX overhaul: theme + dark mode, `Dialog` forms, field validation, sample data/empty states, layout polish — closed #47 (#52/#56 followed in the 0.12 sweep)                                  | #55           |
| 0.11     | Math Verification Suite + D7 core/UI boundary (Charter §4)                                                                                                                                   | #61           |
| 0.12     | Correctness regression sweep — closed the bug cluster #51, #52, #53, #56, #57, #59 (#44 / #46 were already-fixed precursors); plus follow-ups #70, #72, #73 and the #68 sample-data date fix | #66, #74, #76 |

Remaining math-quality follow-ups (step-up reconciliation, dayjs migration, mutation-score ratchet) are tracked in **§8 Correctness Backlog**.

---

### Phase 1 — Local Persistence — issue #20 (target v0.8.0)

_Highest value-to-effort ratio in the backlog; independent of charts._

| #   | Work item                                                                                                                                                     | Notes / acceptance                                                                                                                                    |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.1 | `storage-helpers.ts`: versioned save/load/clear of inputs-only schema; validation-on-load reusing import logic (D4)                                           | Unit tested, including corrupt-data and quota-exceeded paths. Hydration runs through the D8 migration ladder so older stored schemas upgrade forward. |
| 1.2 | "Save data on this device" toggle in command bar; hydrate on app load; debounced auto-save on change; disabling clears storage; toggle state itself persisted | All four behaviors from issue #20. Snackbar feedback consistent with DataManager's.                                                                   |
| 1.3 | First-visit notice explaining data stays on-device (ties into the toggle)                                                                                     | Doubles as the privacy story: no backend, no tracking.                                                                                                |
| 1.4 | **Global error boundary with recovery**: app-level (and later chart-level) React error boundary with a reload affordance and an "export my data" escape hatch | A render-time exception must never white-screen the app or trap unsaved data — matters most once persistence and charts land.                         |

---

### Phase 2 — Visualizations — issue #18 (target v0.9.0)

_The app's centerpiece view. Depends on Phase 0 (engine, context) — and on 0.11, since these charts are the first place users will see the math._

| #   | Work item                                                                                                                                               | Notes / acceptance                                                                                                                                                                                                                                                                |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2.1 | **Spike**: `@mui/x-charts` line chart fed by forecast engine — verify legend toggle, tooltip, dashed-line support, bundle size (D1)                     | Timeboxed; if it fails on dashed overlays, switch decision D1 to Recharts before building.                                                                                                                                                                                        |
| 2.2 | **Forecast chart section** below the tables: one line per loan (declining balance), per investment (growth), plus a distinct **overall net worth** line | X-axis defaults to longest schedule / 30 years per issue #18. Stable color assignment per entity (reused by scenario overlays in Phase 4). **Memoize forecast series** by (entity inputs, horizon, scenario) so charts, dashboard, and overlays never recompute identical series. |
| 2.3 | Legend with show/hide per series; sensible behavior at 10+ entities                                                                                     | Issue #18 acceptance criteria.                                                                                                                                                                                                                                                    |
| 2.4 | Time-range control (5y / 10y / 30y / full) and hover tooltip showing every visible series' value at that month                                          |                                                                                                                                                                                                                                                                                   |
| 2.5 | Mobile chart layout (responsive height, legend below, touch tooltip)                                                                                    |                                                                                                                                                                                                                                                                                   |
| 2.6 | **Accessible chart fallback**: "view as table" toggle backed by a screen-reader-readable data table consuming the same series; keyboard-operable legend | A line chart is opaque to screen readers and keyboard-only users; the table doubles as a data-inspection feature for everyone. Feeds the Phase 6 a11y audit.                                                                                                                      |

---

### Phase 3 — Net Worth Dashboard (target v0.10.0)

_Makes the app's stated purpose — net worth — visible at a glance. Small phase; could merge into Phase 2 if momentum allows._

| #   | Work item                                                                                                                                                                                                                       | Notes / acceptance                                                                                                                                                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3.1 | Summary cards above the chart: **Total debt** (Σ current balances), **Total assets** (Σ current values), **Net worth**, **Monthly commitments** (Σ payments + contributions)                                                    | Computed from forecast engine's "today" anchor — same numbers the chart starts from.                                                                                                   |
| 3.2 | Milestone callouts: projected debt-free date, projected net worth at +5y/+10y/+30y                                                                                                                                              | Cheap derivations from existing series; high perceived value.                                                                                                                          |
| 3.3 | Table upgrades: payoff-date and current-balance columns, principal-paid progress bar, sortable columns with a **meaningful default ordering** (e.g., by rate or payoff date), totals row, **duplicate/clone action** per entity | Clears several UX-debt items in one pass. Default ordering mirrors how the optimizer reasons ("high-rate first"); clone seeds refinance candidates (H1) without re-typing every field. |
| 3.4 | **Stated assumptions panel**: a small, always-available note on what forecasts assume — constant rates, no taxes/inflation (until H2/H4 toggles ship), average-return not guaranteed-return                                     | A deterministic 30-year projection implies false precision; stating assumptions is the honest framing Monte Carlo (H2) later makes statistically.                                      |

---

### Phase 4 — Scenario Forecasting — issue #24 (target v0.11.0)

_The what-if layer. Depends on Phases 0 (engine scenario API) and 2 (chart)._

| #   | Work item                                                                                                                                  | Notes / acceptance                                                                 |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| 4.1 | Scenario model + reducer state: a named scenario = set of extra monthly amounts against any loans/investments (`ScenarioInput`, D3)        | Scenarios are session-scoped first; persistence of scenarios is a follow-up (4.5). |
| 4.2 | "Scenarios" button in the chart section opening a builder dialog: pick entities, enter extra $/month each                                  | Issue #24 acceptance criteria.                                                     |
| 4.3 | Chart overlays: scenario lines **dotted, color-matched** to their solid original; clearly labeled in legend/tooltip; original lines remain | Issue #24 acceptance criteria. Includes a scenario net-worth line.                 |
| 4.4 | **Scenario impact summary** panel: payoff moved up N months, interest saved $X, net worth at horizon +$Y vs. baseline                      | Not in the issue, but this is what turns a chart into a decision.                  |
| 4.5 | Persist scenarios alongside data when caching is enabled; include in export schema                                                         | Schema bump with backward-compatible import.                                       |

---

### Phase 5 — "Next Dollar" Optimizer (target v1.0.0)

_The reason the app exists, and the 1.0 headline: nothing public does this._

| #   | Work item                                                                                                                                                                                                                                                                                                                         | Notes / acceptance                                                                                                                                                                                                                                                                                                                                                                                                        |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 5.1 | Optimizer engine over **allocation plans**: a plan is a split of $X/month across any number of loans/investments (single-target = the degenerate 100% case). `evaluatePlan(plan, horizon)` returns net worth delta, interest saved, payoff changes — a pure function over the Phase 0 engine, tested to the Charter (§4) standard | Note the subtlety: paying off a loan early frees its payment — v1 can ignore redirect-after-payoff, but the engine API should leave room for a "snowball" mode later.                                                                                                                                                                                                                                                     |
| 5.2 | **Suggested-split search**: rank all single-target plans, then grid-search splits at coarse granularity (e.g., 10% steps across the top 2–3 candidates) and surface the best splits alongside the single-target options                                                                                                           | Keeps the search space tractable while catching the cases where a split genuinely beats all-in-one (e.g., kill a small high-rate loan first, rest to investments). Granularity/candidate count are engine parameters. **Run the search in a Web Worker** — each plan is a full multi-entity 30-year engine run, and the flagship interaction must not jank the main thread; the D7 boundary keeps the engine worker-safe. |
| 5.3 | UI: "I have $\_\_\_ extra per month" input + horizon picker → ranked comparison table (single-target **and** suggested splits; net worth delta, interest saved, payoff changes) with one-click "view as scenario" on the chart                                                                                                    | The flagship interaction.                                                                                                                                                                                                                                                                                                                                                                                                 |
| 5.4 | **Custom split builder**: sliders/inputs to divide the $X across chosen targets (always summing to $X), live-evaluated and chartable like any other plan                                                                                                                                                                          | Lets users test their own intuition against the suggestions.                                                                                                                                                                                                                                                                                                                                                              |
| 5.5 | README/site copy rewrite around the optimizer; fill in the glossary; add screenshots                                                                                                                                                                                                                                              | 1.0 release polish.                                                                                                                                                                                                                                                                                                                                                                                                       |

---

### Phase 6 — Quality Pass (parallel / ongoing, patch releases)

_Independent items; good filler between phases or alongside reviews. (The big UX items and the dependency upgrades moved into Phase 0.)_

- Full accessibility audit: aria labels on icon buttons, keyboard nav end-to-end, screen-reader pass, color-contrast check (dialog focus traps land with 0.7)
- Standardize date math on dayjs inside helpers (manual `Date` arithmetic has subtle off-by-one semantics around the `+1` term)
- Move `prettier` from `dependencies` to `devDependencies`
- Component tests (React Testing Library + jsdom) for forms, tables, DataManager; Playwright smoke test (add loan → see chart) once charts exist; pragmatic coverage targets for UI code (the 100% bar in §4 applies to math)
- Keep dependencies current after the 0.5 modernization (e.g., periodic minor/patch bumps via Dependabot or scheduled PRs)
- Snackbar soft-undo for import-merge overwrites in DataManager (the delete undo lands with 0.7; merge-by-Id clobbers are otherwise unrecoverable)
- **Pre-merge "what changed" preview in DataManager**: before committing an ID-based import merge, show which entities will be _added_ vs. _overwritten_, so the clobber is prevented up front rather than only recoverable after the fact via the soft-undo above; pairs with the #46 import-validation hardening (0.12)
- **Table search / filter / grouping**: filter and grouping controls on the loan/investment tables (sorting, a totals row, and clone already land in 3.3) — keeps the tables usable as H3 fills them with cash, property, pension, and custom-asset rows
- **Bulk multi-select table actions**: select multiple loans/investments to delete or duplicate at once, reusing the 0.7 confirm + soft-undo pattern; complements per-row clone (3.3) and the filter/grouping above as H3 fills the tables
- Code-split the heaviest bundles (MUI X charts, date pickers, popout dialogs) to protect first paint on mobile/GitHub Pages
- **Performance regression gate in CI**: a bundle-size budget on the production build (optionally a Lighthouse-CI run) wired into `ci.yml`, soft-then-hard, so the code-split win above can't silently regress as charts, the Web Worker optimizer (5.2), and Monte Carlo (H2) land — making "protect first paint" an enforced invariant, mirroring §4's coverage gate
- **Social/SEO + share metadata in `index.html`**: `<meta name="description">`, Open Graph / Twitter-card tags, and a static preview image so links to the deployed site (and the H5 shareable-links use case) render a real preview instead of a bare URL
- **Production-correct favicon / app icons**: serve the icon from `public/` — the current `<link rel="icon">` points at a `/src/assets/...` source path that bypasses Vite's `base: '/finance-calculator/'` and is typed `svg+xml` while pointing at a `.png` — and add the icon sizes a future PWA install (H5) needs
- **Open-source repo health**: add a `LICENSE` (the repo currently ships none — all-rights-reserved by default; owner picks the license, keeping D1/D6's MIT-compatibility reasoning in mind), plus `CHANGELOG.md`, `CONTRIBUTING.md`, and issue/PR templates, so the README's invitation to contribute and the §7 Working Agreements are discoverable

---

### Phase 7 — Future Horizons (post-1.0)

A planned catalog, not a commitment. Every idea below passed three filters: **(1)** it serves the core question — forecasting net worth and deciding where money goes; **(2)** it works with no backend (client-side, GitHub Pages, data stays on device); **(3)** it doesn't turn PathWise into a budgeting app. Items marked ★ are the strongest post-1.0 candidates.

#### Non-goals (identity guardrails)

Declared explicitly so future feature debates have a reference point:

- **No transaction/expense tracking, categorization, or budgets** — the BLUF says not a budgeting app; this is the line
- **No bank account linking** (Plaid etc.) — requires a backend and credentials; would destroy the privacy story
- **No real-time market data** — PathWise models average rates, not tickers; keeps results deterministic and avoids API keys
- **No tax _advice_** — modeling tax _treatment_ (H2) is in scope; computing someone's tax return is not

#### H1 — Deeper debt tools

| Feature                                    | What & why                                                                                                                                                                                                                | Builds on                     |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| ★ **Refinance / loan-offer comparison**    | Side-by-side current loan vs. candidate offers (rate, term, closing costs) with break-even month and lifetime cost delta. Loan shopping is the debt-side twin of the Phase 5 optimizer — same engine, different question. | Forecast engine + scenario UI |
| ★ **One-time lump-sum payments**           | "I got a $5k bonus — where does it go?" The one-time counterpart to the monthly optimizer.                                                                                                                                | Scenario engine extension     |
| **Payoff strategies (avalanche/snowball)** | Ordered-payoff modes with freed-payment redirection after each payoff — the "snowball mode" API slot reserved in 5.1.                                                                                                     | Optimizer engine              |
| **Credit cards / revolving debt**          | Minimum-payment math (percent-of-balance floors), payoff scenarios. High-rate debt is exactly where the optimizer shines.                                                                                                 | New loan subtype              |
| **True monthly payment**                   | Escrow, taxes, insurance, PMI — including automatic PMI drop-off at 80% LTV. (TODO already noted in `loan-model.ts`.)                                                                                                     | Loan model fields             |
| **Bi-weekly payment strategy**             | The classic "13th payment" effect, quantified honestly.                                                                                                                                                                   | Forecast engine               |
| **Adjustable rates**                       | Scheduled future rate changes (ARM resets, promo-rate expiry) on any loan.                                                                                                                                                | Loan model + engine           |

#### H2 — Smarter investment modeling

| Feature                                | What & why                                                                                                                                                                                                                                                                                                                      | Builds on                                   |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| ★ **Employer match**                   | Match percentage and cap on a contribution. Free money changes optimizer rankings dramatically — without it, "pay the 6% loan vs. fund the 401(k) with 50% match" gives the wrong answer.                                                                                                                                       | Investment model + optimizer                |
| **Annual contribution / payment caps** | Optional yearly cap on an investment's contributions (e.g. 401(k)/IRA limits) that throttles once reached — plus the loan-side equivalent. Keeps long-horizon forecasts realistic and lets the optimizer rank "fund up to the match/cap, then pay the loan" correctly instead of pouring unlimited money into a capped account. | Investment/loan model + engine + optimizer  |
| ★ **Withdrawals / decumulation**       | Negative contributions: model the drawdown phase, answer "how long does it last." Unlocks the retirement audience.                                                                                                                                                                                                              | Engine (sign change + tests)                |
| **Tax-treatment buckets**              | Tag accounts taxable / tax-deferred / Roth; offer an after-tax net worth view with a user-supplied effective rate. Treatment, not advice.                                                                                                                                                                                       | Investment model + dashboard                |
| **Fee drag**                           | Expense ratio on an investment; chart the with/without-fee divergence over 30 years. Small input, eye-opening output.                                                                                                                                                                                                           | Engine                                      |
| **Monte Carlo mode**                   | Replace the single average-return line with volatility-driven percentile bands (fan chart). The single biggest credibility upgrade for long horizons — deterministic projections overstate certainty. Run in a Web Worker; seeded/reproducible.                                                                                 | Engine + charts; sizable but self-contained |
| **DCA vs. lump-sum comparison**        | A focused mini-calculator answering a perennial question with the user's own numbers.                                                                                                                                                                                                                                           | Scenario engine                             |

#### H3 — The full net worth picture

| Feature                                    | What & why                                                                                                                                                                                            | Builds on                       |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| ★ **Cash accounts (HYSA/CD/checking)**     | Trivial model (balance + APY), big completeness win — most people's net worth includes cash the app currently can't hold.                                                                             | New simple asset type           |
| ★ **Property + mortgage pairing**          | Home value with an appreciation rate, linked to its mortgage → a **home equity** series on the chart. Makes the net worth line honest for homeowners (currently a mortgage counts as pure liability). | New asset type + entity linking |
| **Pensions / Social Security / annuities** | Future income streams starting at a date — matters enormously for the retirement-horizon view.                                                                                                        | New income-stream type          |
| **Custom asset/liability**                 | Catch-all with a simple growth/decline rate: car (depreciating), private loan to a friend, collectibles. Escape hatch so nobody's net worth is blocked on a missing type.                             | New generic type                |

#### H4 — From calculator to plan

| Feature                             | What & why                                                                                                                                                                                                                                                                                              | Builds on                                    |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| ★ **Balance check-ins (snapshots)** | Periodically record actual balances; chart **actual vs. projected**, show drift, and build a real historical net worth line. This is the retention feature — it turns a one-off calculator into something you return to monthly, while staying firmly not-a-budgeting-app (balances, not transactions). | Persistence (Phase 1) + schema bump + charts |
| ★ **Goals**                         | Debt-free-by date, target net worth, FI number — rendered as goal lines on the chart with an "on track?" indicator against the forecast.                                                                                                                                                                | Dashboard + charts                           |
| **Life-event timeline**             | Dated one-time events that modify the forecast: buy a house (new loan + asset), tuition (withdrawal), windfall, sell a car. A generalization of the scenario system from "extra $/month" to "things that happen."                                                                                       | Scenario engine generalization               |
| **Inflation toggle**                | Real vs. nominal view of every chart and milestone.                                                                                                                                                                                                                                                     | Engine post-processing                       |
| **Retirement / FI mode**            | Annual-spending input → FI number, projected FI date, coast-FI date. Composes goals + decumulation into the question long-horizon users actually have.                                                                                                                                                  | H2 withdrawals + H4 goals                    |

#### H5 — Beyond the calculator

| Feature                                       | What & why                                                                                                                                                                                                                                       | Builds on                     |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------- |
| ★ **Shareable links**                         | Compressed state in the URL fragment — share a scenario with a spouse, advisor, or forum thread with zero backend. Also doubles as a backup mechanism.                                                                                           | Serialization (D5)            |
| **Multi-profile / household**                 | Named datasets (me / partner / joint) with a combined view. First step toward PathWise as a household planning tool rather than a personal one.                                                                                                  | Storage schema + context      |
| **PWA / offline install**                     | Installable app, works offline — a natural fit since there's no backend to lose.                                                                                                                                                                 | Build config + service worker |
| **Printable / PDF report**                    | One-page position summary: holdings, net worth chart, milestones, active plan. The artifact people bring to a financial conversation.                                                                                                            | Dashboard                     |
| **"Show the math" mode**                      | Step-by-step calculation breakdowns behind any number (popover: how this payment, this balance, this delta was computed) + a filled-in glossary. Serves the app's founding ethos — _no math done by the user_ — and becomes the education layer. | UI layer over helpers         |
| **CSV import**                                | Client-side parsing of brokerage/bank CSV exports to seed balances — an onboarding accelerant, explicitly _not_ transaction sync.                                                                                                                | Import pipeline               |
| **Bring-your-own-cloud sync**                 | Optional export/import against the user's own Drive/OneDrive via OAuth — multi-device without PathWise ever hosting data. Investigate; stays file-based if the OAuth complexity isn't worth it.                                                  | Export schema                 |
| **i18n + multi-currency**                     | Locale-aware formatting first (cheap), full translation later (only if an audience appears).                                                                                                                                                     | Formatting helpers (0.6)      |
| **Natural-language what-ifs** _(exploratory)_ | "What if I put $200 more on the car loan?" → parsed into a scenario. Requires an LLM API and key management, which conflicts with the zero-backend constraint — park until the core is done, then evaluate as an opt-in companion.               | Scenario engine               |
| **Publish the engine** (`@pathwise/engine`)   | Release the charter-verified forecast/optimizer core as an open-source npm package — a community artifact in its own right, and the D7 graduation trigger: this is the moment the core moves into a workspace package.                           | D7 boundary + charter (§4)    |

#### Suggested post-1.0 sequencing

| Release | Theme                  | Contents                                                  |
| ------- | ---------------------- | --------------------------------------------------------- |
| v1.1    | **Come back monthly**  | Balance check-ins + goals (H4★)                           |
| v1.2    | **Whole net worth**    | Cash accounts + property/home equity (H3★)                |
| v1.3    | **Better answers**     | Employer match, lump sums, refinance comparison (H1★/H2★) |
| v1.4    | **Honest uncertainty** | Monte Carlo fan charts (H2)                               |
| v2.0    | **Beyond personal**    | Household profiles + shareable links (H5)                 |

The rationale for this order: retention first (check-ins make the app a habit), then completeness (so the net worth line is true), then answer quality (so the optimizer is trustworthy), then statistical honesty, then audience expansion.

---

## 6. Sequencing at a Glance

```
Phase 0  Foundations + UX overhaul        ✅ DONE     v0.7.0
         (engine, context, CI, dep modernization,
          theme/dark mode, dialogs, validation, empty states,
          math verification suite + correctness sweep — gate for Phase 2)
   ├── Phase 1  Persistence (#20)         ← next      v0.8.0   (independent of 2)
   └── Phase 2  Charts (#18)                          v0.9.0
           └── Phase 3  Dashboard                     v0.10.0
                   └── Phase 4  Scenarios (#24)       v0.11.0
                           └── Phase 5  Optimizer     v1.0.0
Phase 6  Quality items slot in anywhere
Phase 7  Future horizons queue up post-1.0 (v1.1 → v2.0 sequencing in §Phase 7)
```

Issue mapping: **#20 → Phase 1**, **#18 → Phase 2**, **#24 → Phase 4**. Phases 3 and 5 deserve new GitHub issues when their turn approaches.

## 7. Working Agreements (from repo conventions)

- Every PR: `npm test`, `npm run build`, `npm run check:lint`, `npm run check:format` green (enforced by 0.1)
- New business logic lands in `helpers/` with unit tests; UI stays thin
- **Math Correctness Charter (§4) is non-negotiable**: math-touching PRs ship with reference tests (cited sources), uphold the invariants, and keep `src/helpers/**` at 100% line+branch coverage; math bugs get a failing regression test before the fix
- Semver bump in `package.json` for behavior changes; update `.github/copilot-instructions.md` and README when structure changes
- Keep models input-only; derived data is computed, never stored (after 0.3)

---

## 8. Correctness Backlog

Open math/quality items surfaced by the Charter (§4) work that don't belong to a
single feature phase. Each is already pinned in code or config, so the tracking
lives here rather than as standalone issues. These are prerequisites-of-trust,
not features; schedule them alongside the phases as capacity allows (the dayjs
migration is tagged for Phase 6).

### 8.1 — Reconcile the step-up anniversary off-by-one between the two investment engines — ✅ RESOLVED (2026-06-14)

`forecastInvestment` (monthly-grid) and `generateInvestmentGrowth` (period-indexed)
agreed to the cent **without** yearly step-ups but **diverged** once a step-up was
configured: they attributed an on-anniversary contribution to different year
numbers. It was purely a step-up **timing** question, not a compounding error.

**Resolution**: `generateInvestmentGrowth` (which backs the PIT view and Growth
Schedule popout) is canonical. `forecastInvestment` now attributes each grid-month
contribution to the period-opening contribution one contribution-interval earlier
(`getInvestmentYear(monthDate − interval)`), matching the period engine. The two
now agree to the cent at every compounding boundary with or without step-ups.

- **Reconciled in**: `src/helpers/forecast-helpers.ts` (`forecastInvestment` year attribution).
- **Tripwire flipped**: `src/helpers/forecast-consistency.test.ts` — the former `it.fails` is now a normal passing `it` asserting the engines agree with a yearly step-up.
- **Reference oracle added** (Charter §4 layer 1): `src/helpers/math-reference.test.ts` — a hand-derived 0%-return step-up total pins the absolute value and that both engines match it.
- **Documentation updated**: `src/helpers/PRECISION.md` §4 now records the reconciliation instead of a known divergence.

### 8.2 — Migrate forecast/investment date math to dayjs (Phase 6)

Decision D7 states the core is "TypeScript + dayjs only," but `investment-helpers`
date stepping still uses raw `Date` arithmetic, which has a silent month-end
rollover quirk: **Jan 31 + 1 month → Mar 3** (February skipped), so a contribution
that should compound in February lands in March.

- **Pinned in code**: `src/helpers/math-edge-cases.test.ts` → "documents the JS Date rollover for Jan 31 + 1 month", which tightly pins the current (quirky) output so a migration is a deliberate, reviewed behavior change rather than a silent one.
- **Done when**: `getNextCompoundingDate`/the forecast date stepping use dayjs (consistent with D7); the month-end edge test asserts **correct** calendar behavior (Jan 31 + 1 month → Feb); regression/reference tests cover month-end and leap-day stepping under the new implementation. Fixing this also makes the engine and the Growth Schedule popout agree on period dates (the display defect previously filed separately).

### 8.3 — Ratchet the Stryker mutation threshold toward zero surviving mutants

Mutation testing (Stryker) runs over `src/helpers/**` as a weekly + on-demand
workflow. The Charter §4 rule is "surviving mutants triaged to zero or explicitly
waived with a comment," which a non-blocking weekly run won't drive on its own.

- **Baseline (first full run, 2026-06-13)**: overall **85.33%** (844 killed / 147 survived / 11 timeout). Lowest files: `format-helpers.ts` 73.3%, `validation-helpers.ts` 82.7%, `forecast-helpers.ts` 85.1%, `investment-helpers.ts` 85.2%.
- **Progress (2026-06-14)**: after strengthening the validation warning tests to assert message **content** (not just presence), `validation-helpers.ts` rose 82.7 → **83.7%** and overall held at **85.04%** despite the new #70/#72 warning + guard code adding mutants. `thresholds.break` ratcheted **80 → 83** (just below baseline, with headroom for run-to-run timeout variance). `format-helpers.ts` (73.3%) remains the lowest; its 4 survivors are the `Intl.NumberFormat` caching layer — equivalent mutants that change performance, not output, so they are a documented waiver rather than a test gap.
- **Done when**: surviving mutants are triaged (each killed by a strengthened test or explicitly waived as equivalent), and `break` is ratcheted up toward zero survivors as the score improves. Next targets: `investment-helpers.ts` (83.9%) and `forecast-helpers.ts` (84.9%).

---

## 9. Proposed Additions (2026-06-15 review)

A triage list, in the same spirit as the cross-cutting proposals that became §6/§8
(PRs #60, #67): small, concrete additions surfaced by reading the current code and
the open issue tracker against the roadmap. Each is filed under a category with a
one-line rationale; none is a commitment until folded into a phase. Where an item
belongs to an existing phase, the target phase is noted so it can be merged in
rather than living here long-term.

### 9.1 — Roadmap hygiene / tracking

- **Reconcile §8 with the live issue tracker.** Nine bug issues are currently open (#68–#83), but §8 (which exists precisely for cross-cutting correctness items) reflects none of them. Several are even cited in the Phase 0.12 row as already handled — #70/#72/#73 as "follow-ups" and #68 as the sample-data date fix "shipped in #66, #74, #76" — yet all four remain **open**; #69 (dependency audit), #71 (PIT label), #75 (quarterly period count), #79 (0% loan auto-payment), and #83 (import/export on sample data) are untracked entirely. _Rationale: the roadmap currently overstates correctness status; a backlog pass that either closes the cited issues or moves the open ones into §8 keeps "what's done" trustworthy, which is the same standard §4 holds the math to._

### 9.2 — Performance

- **Virtualize the long schedule tables** (Phase 6, alongside the existing code-split/bundle items). `amortization-popout.tsx` and `growth-schedule-popout.tsx` both `.map()` every row straight into the DOM — a 50-year monthly loan is 600+ `TableRow`s, and the growth schedule projects 30 years (up to ~360 rows) eagerly. _Rationale: the existing perf items target bundle size and first paint, not list render volume; windowing these popouts (e.g. `@mui/x-data-grid` virtualization or a lightweight virtualizer) keeps opening/scrolling smooth on mobile without touching the verified math._

### 9.3 — UX

- **Unsaved-data guard until Phase 1 lands** (bridge to Phase 1, issue #20). A refresh currently wipes everything (gap G6), and there is no warning. A `beforeunload` prompt shown only while there is unpersisted user data — removed once the persistence toggle ships — is a cheap safety net for the window before Phase 1. _Rationale: silent, irreversible data loss on an accidental refresh is the same footgun class as #47/#83; a guard costs little and disappears once real persistence exists._
- **Surface entity-level sanity warnings on the tables/cards, not only in the edit form.** `validateLoan`/`validateInvestment` already produce "wrong premise" warnings (rate > 30%, `CurrentAmount > Principal`, the proposed under-amortizing-payment warning in #70), but they appear only while a dialog is open — an imported or returning-user entity never shows them. A small warning badge + tooltip on the row would flag questionable inputs at a glance. _Rationale: extends the Charter's "a plausible-looking number on a wrong premise is worse than none" philosophy from the form into the always-visible tables, and gives imported #72-class entities a visible cue._

### 9.4 — New features (small)

- **Lifetime-totals footer in the schedule popouts.** The amortization popout shows per-row figures but no **total interest paid over the life of the loan**; the growth popout shows no **total contributed / total interest earned**. A single summary row is a cheap, high-value derivation from series the popout already computes. _Rationale: "what does this loan actually cost me?" is a headline question users open the schedule to answer, and the totals feed naturally into the Phase 3 dashboard and Phase 5 optimizer framing._
- **Copy/download a single schedule as CSV** from the amortization/growth popouts. Distinct from the JSON backup (whole-dataset, inputs-only) and the H5 CSV _import_: this is exporting one computed schedule for a spreadsheet or a financial conversation. _Rationale: small UI affordance over data already on screen; pairs with the H5 "printable report" artifact without needing the full report._
