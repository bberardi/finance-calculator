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

## 2. Current State Assessment (June 2026, v0.6.0)

### What exists and works

- React 18 + TypeScript + Vite + MUI v6, deployed to GitHub Pages via Actions
- Loan CRUD with auto-calculated monthly payment, amortization schedule popout, point-in-time (PIT) calculator
- Investment CRUD with compounding frequencies, recurring contributions, yearly step-ups (flat/%), growth schedule popout, PIT calculator
- JSON export/import with ID-based smart merge and validation
- Responsive tables (desktop table / mobile cards)
- Solid unit test coverage for all helper math (Vitest)

### Architectural gaps that block the vision

| #   | Gap                                                                                                                                                                                                   | Why it matters                                                                                                                                                                                     |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G1  | **No shared time-series engine.** Loan schedules are term-indexed (`Term: 1..n`), investment growth is period-indexed, and the two can't be plotted on a common axis.                                 | Charts (#18), scenarios (#24), net-worth dashboard, and the optimizer all need date-indexed monthly series that can be summed across entities. This is the single most load-bearing piece of work. |
| G2  | **Derived data stored on the models.** `AmortizationSchedule` / `ProjectedGrowth` are persisted on `Loan`/`Investment` and serialized into exports (bloating files; import regenerates them anyway).  | Scenarios require recomputing projections with modified inputs; derived data must be computed on demand, not stored.                                                                               |
| G3  | **All state lives in `Body.tsx` via `useState` + prop drilling.**                                                                                                                                     | Charts, scenario panel, and dashboard each need the same data; prop drilling will sprawl.                                                                                                          |
| G4  | **`CurrentAmount`/`CurrentValue` are captured but ignored by projections.** Loan forecasts replay the theoretical schedule from `StartDate`; real balances drift (past extra payments, rate changes). | Forecasts should anchor to _today's actual balance_ so charts start from reality, not theory.                                                                                                      |
| G5  | **No extra-payment support on loans.** The README names what-ifs as the core purpose, but `generateAmortizationSchedule` has no concept of additional principal payments.                             | Prerequisite for scenarios (#24) and the optimizer.                                                                                                                                                |
| G6  | **No persistence.** Refresh wipes everything.                                                                                                                                                         | Issue #20; also the cheapest large UX win.                                                                                                                                                         |
| G7  | **CI only builds and deploys on `main` push.** Tests, lint, and format checks never run in CI.                                                                                                        | Quality gate needed before the codebase grows.                                                                                                                                                     |

### UX debt (the worst of it is pulled into Phase 0's UX overhaul; the remainder lands in Phase 6)

- `Popover` used as modal dialogs — poor accessibility and awkward on mobile (should be `Dialog`, full-screen on small viewports)
- No field-level validation messages; save button silently disabled
- Delete is a trash icon inside the edit dialog with **no confirmation**
- "Test Data" toggle is a dev tool living in the production command bar
- No summary of overall position (total debt, total assets, net worth) anywhere — the app never actually shows "net worth" today
- Tables: no sorting, no totals row, no payoff-date or progress columns
- No dark mode; no theme persistence
- Empty states are plain text with no call to action
- Footer/header are minimal; no link to GitHub/docs; README glossary is a stub

---

## 3. Key Technical Decisions

Decisions made up front so phases don't relitigate them. Each is revisitable, but the default is chosen.

### D1 — Charting library: `@mui/x-charts` (community/MIT)

Matches the existing MUI stack (theming, typography, dark mode for free), MIT-licensed, supports line charts, legends, series highlight/hide, and tooltips. **Version coupling (verified June 2026)**: current x-charts (v9) peer-requires `@mui/material ^7.3 || ^9` — on MUI 6 we'd be pinned to the legacy v7.29 line. This is the main driver behind D6. **Alternative**: Recharts (more battle-tested, larger community) — fall back if x-charts hits a wall on dashed-line scenario overlays or legend toggling. Spike this in Phase 2, item 2.1.

### D2 — State: React Context + `useReducer` (no new dependency)

The app has exactly two collections plus UI state; a context with a reducer (`AddLoan`, `UpdateLoan`, `DeleteLoan`, `ImportMerge`, …) removes the prop drilling without adding a store library. Revisit (Zustand) only if scenario state makes the reducer unwieldy.

### D3 — Forecast engine: one pure module, date-indexed, scenario-aware

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

Per issue #20: explicit toggle, disabling clears stored data, the toggle state itself is stored. Persist a versioned schema (`{ schemaVersion, loans, investments }`) containing **only user inputs** (no derived schedules — depends on G2 fix). Reuse the existing import-validation logic for hydration so corrupt storage degrades gracefully instead of white-screening.

### D5 — Export schema v2

Once derived fields are stripped (G2), exports shrink dramatically. Bump the export `version`, and make import accept both v1 (ignore embedded schedules) and v2. No breaking change for existing user files.

### D6 — Keep MUI; modernize dependencies in Phase 0, not Phase 6

**No UI library change.** The UX problems are design/usage problems, not MUI problems — a switch (Tailwind/shadcn, Mantine, etc.) would be a rewrite with zero feature payoff, and MUI remains a fit for this app.

**Upgrades are not strictly required** (everything in Phases 1–5 _could_ ship on today's stack using x-charts v7), but they are recommended now rather than later. Verified against npm in June 2026, the stack is several majors behind: `@mui/material` 6.1 → 9.1, `@mui/x-date-pickers` 7.22 → 9.5, React 18.3 → 19.2, Vite 5.4 → 8.0 — and current `@mui/x-charts` (v9) refuses MUI 6 (see D1). Deferring means writing the Phase 0 theme/dark-mode system on MUI 6's API and migrating it later, and building the Phase 2 flagship chart on a frozen legacy line. With ~15 components, the migration will never be cheaper than it is now. **Decision**: one coordinated modernization (item 0.5), staged through the official 6→7→9 migration guides and codemods, landed _before_ the theme work.

---

## 4. Phased Roadmap

Each item is intended to be a single reviewable PR. Phases are ordered by dependency; within a phase, items are ordered. Version bumps follow the repo's semver convention (minor per feature phase).

---

### Phase 0 — Foundations & UX Overhaul (target v0.7.0)

_Unblocks everything else — and fixes the baseline experience so every later phase builds on a shell worth looking at. Items 0.1–0.5 are architecture/platform; 0.6–0.10 are the UX overhaul._

| #    | Work item                                                                                                                                                                                                                                    | Notes / acceptance                                                                                                                                                                                                     |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0.1  | **PR CI workflow**: run `npm test`, `check:lint`, `check:format`, `build` on every PR and push to main (G7)                                                                                                                                  | Separate `ci.yml`; deploy workflow unchanged. Node 24 to match lock file.                                                                                                                                              |
| 0.2  | **Forecast engine** (`forecast-helpers.ts`, D3/G1): date-indexed monthly series for loans, investments, and aggregate net worth; anchored to `CurrentAmount`/`CurrentValue` as of today (G4)                                                 | Pure functions + full unit tests. No UI changes yet. Includes the loan extra-payment math (G5) in the core API even though no UI uses it until Phase 4 — designing it in now avoids reworking the engine later.        |
| 0.3  | **Strip derived data from models** (G2): `AmortizationSchedule`/`ProjectedGrowth` become computed-on-demand (memoized in components); export schema v2 (D5) with backward-compatible import                                                  | Existing exported files still import cleanly.                                                                                                                                                                          |
| 0.4  | **State context** (D2): `FinanceDataProvider` with reducer; `Body.tsx` becomes layout-only                                                                                                                                                   | No behavior change; component tests for reducer actions.                                                                                                                                                               |
| 0.5  | **Dependency modernization** (D6): React 19, MUI 9 (+ `@mui/icons-material`, `@mui/x-date-pickers` 9), Vite 8 (with Vitest compatibility verified), staged as one PR per major using official migration guides/codemods                      | Each step lands green through the 0.1 CI gate. Legacy `Grid item xs` props in the tables are affected by the MUI migration. Must land _before_ 0.6–0.8 so the new theme and dialogs are written once, on current APIs. |
| 0.6  | **Theme system**: proper MUI theme (palette, typography, spacing, component defaults) replacing ad-hoc `sx` styling; **dark mode toggle** (persisted); centralized `formatCurrency`/`formatPercent` helpers (currently duplicated per table) | Foundational because charts (Phase 2) and every new surface consume the theme. Verify gradients/contrast in both modes.                                                                                                |
| 0.7  | **Replace `Popover` forms with `Dialog`** (full-screen on mobile), focus trap and keyboard handling included; **delete confirmation** dialog, with delete moved out of the edit form                                                         | Every later phase adds dialogs and should copy a good pattern, not a bad one.                                                                                                                                          |
| 0.8  | **Form validation UX**: field-level error messages and helper text on both add/edit forms; user can always see _why_ save is disabled                                                                                                        | Validation rules already exist in `isFormValid()` — this surfaces them per-field instead of silently disabling the button.                                                                                             |
| 0.9  | **Empty states & sample data**: onboarding empty state with a short explainer and "Add your first loan/investment" + "Load sample data" CTAs; remove the "Test Data" switch from the command bar                                             | Sample data clearly labeled and one-click removable. First impression of the deployed site currently depends on a dev toggle.                                                                                          |
| 0.10 | **Layout & command bar polish**: tighten the pill-AppBar-inside-a-page pattern, consistent button hierarchy (primary vs. outlined), responsive spacing, footer links (GitHub repo, version)                                                  | Small, but it's the frame every screenshot and future feature sits in.                                                                                                                                                 |

---

### Phase 1 — Local Persistence — issue #20 (target v0.8.0)

_Highest value-to-effort ratio in the backlog; independent of charts._

| #   | Work item                                                                                                                                                     | Notes / acceptance                                                                  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 1.1 | `storage-helpers.ts`: versioned save/load/clear of inputs-only schema; validation-on-load reusing import logic (D4)                                           | Unit tested, including corrupt-data and quota-exceeded paths.                       |
| 1.2 | "Save data on this device" toggle in command bar; hydrate on app load; debounced auto-save on change; disabling clears storage; toggle state itself persisted | All four behaviors from issue #20. Snackbar feedback consistent with DataManager's. |
| 1.3 | First-visit notice explaining data stays on-device (ties into the toggle)                                                                                     | Doubles as the privacy story: no backend, no tracking.                              |

---

### Phase 2 — Visualizations — issue #18 (target v0.9.0)

_The app's centerpiece view. Depends on Phase 0 (engine, context)._

| #   | Work item                                                                                                                                               | Notes / acceptance                                                                                                                         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 2.1 | **Spike**: `@mui/x-charts` line chart fed by forecast engine — verify legend toggle, tooltip, dashed-line support, bundle size (D1)                     | Timeboxed; if it fails on dashed overlays, switch decision D1 to Recharts before building.                                                 |
| 2.2 | **Forecast chart section** below the tables: one line per loan (declining balance), per investment (growth), plus a distinct **overall net worth** line | X-axis defaults to longest schedule / 30 years per issue #18. Stable color assignment per entity (reused by scenario overlays in Phase 4). |
| 2.3 | Legend with show/hide per series; sensible behavior at 10+ entities                                                                                     | Issue #18 acceptance criteria.                                                                                                             |
| 2.4 | Time-range control (5y / 10y / 30y / full) and hover tooltip showing every visible series' value at that month                                          |                                                                                                                                            |
| 2.5 | Mobile chart layout (responsive height, legend below, touch tooltip)                                                                                    |                                                                                                                                            |

---

### Phase 3 — Net Worth Dashboard (target v0.10.0)

_Makes the app's stated purpose — net worth — visible at a glance. Small phase; could merge into Phase 2 if momentum allows._

| #   | Work item                                                                                                                                                                    | Notes / acceptance                                                                   |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 3.1 | Summary cards above the chart: **Total debt** (Σ current balances), **Total assets** (Σ current values), **Net worth**, **Monthly commitments** (Σ payments + contributions) | Computed from forecast engine's "today" anchor — same numbers the chart starts from. |
| 3.2 | Milestone callouts: projected debt-free date, projected net worth at +5y/+10y/+30y                                                                                           | Cheap derivations from existing series; high perceived value.                        |
| 3.3 | Table upgrades: payoff-date and current-balance columns, principal-paid progress bar, sortable columns, totals row                                                           | Clears several UX-debt items in one pass.                                            |

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

| #   | Work item                                                                                                                                                                                                                                                                                                         | Notes / acceptance                                                                                                                                                                                                    |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 5.1 | Optimizer engine over **allocation plans**: a plan is a split of $X/month across any number of loans/investments (single-target = the degenerate 100% case). `evaluatePlan(plan, horizon)` returns net worth delta, interest saved, payoff changes — a pure function over the Phase 0 engine, heavily unit tested | Note the subtlety: paying off a loan early frees its payment — v1 can ignore redirect-after-payoff, but the engine API should leave room for a "snowball" mode later.                                                 |
| 5.2 | **Suggested-split search**: rank all single-target plans, then grid-search splits at coarse granularity (e.g., 10% steps across the top 2–3 candidates) and surface the best splits alongside the single-target options                                                                                           | Keeps the search space tractable while catching the cases where a split genuinely beats all-in-one (e.g., kill a small high-rate loan first, rest to investments). Granularity/candidate count are engine parameters. |
| 5.3 | UI: "I have $\_\_\_ extra per month" input + horizon picker → ranked comparison table (single-target **and** suggested splits; net worth delta, interest saved, payoff changes) with one-click "view as scenario" on the chart                                                                                    | The flagship interaction.                                                                                                                                                                                             |
| 5.4 | **Custom split builder**: sliders/inputs to divide the $X across chosen targets (always summing to $X), live-evaluated and chartable like any other plan                                                                                                                                                          | Lets users test their own intuition against the suggestions.                                                                                                                                                          |
| 5.5 | README/site copy rewrite around the optimizer; fill in the glossary; add screenshots                                                                                                                                                                                                                              | 1.0 release polish.                                                                                                                                                                                                   |

---

### Phase 6 — Quality Pass (parallel / ongoing, patch releases)

_Independent items; good filler between phases or alongside reviews. (The big UX items and the dependency upgrades moved into Phase 0.)_

- Full accessibility audit: aria labels on icon buttons, keyboard nav end-to-end, screen-reader pass, color-contrast check (dialog focus traps land with 0.7)
- Standardize date math on dayjs inside helpers (manual `Date` arithmetic has subtle off-by-one semantics around the `+1` term)
- Move `prettier` from `dependencies` to `devDependencies`
- Component tests (React Testing Library + jsdom) for forms, tables, DataManager; Playwright smoke test (add loan → see chart) once charts exist
- Keep dependencies current after the 0.5 modernization (e.g., periodic minor/patch bumps via Dependabot or scheduled PRs)

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

| Feature                          | What & why                                                                                                                                                                                                                                      | Builds on                                   |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| ★ **Employer match**             | Match percentage and cap on a contribution. Free money changes optimizer rankings dramatically — without it, "pay the 6% loan vs. fund the 401(k) with 50% match" gives the wrong answer.                                                       | Investment model + optimizer                |
| ★ **Withdrawals / decumulation** | Negative contributions: model the drawdown phase, answer "how long does it last." Unlocks the retirement audience.                                                                                                                              | Engine (sign change + tests)                |
| **Tax-treatment buckets**        | Tag accounts taxable / tax-deferred / Roth; offer an after-tax net worth view with a user-supplied effective rate. Treatment, not advice.                                                                                                       | Investment model + dashboard                |
| **Fee drag**                     | Expense ratio on an investment; chart the with/without-fee divergence over 30 years. Small input, eye-opening output.                                                                                                                           | Engine                                      |
| **Monte Carlo mode**             | Replace the single average-return line with volatility-driven percentile bands (fan chart). The single biggest credibility upgrade for long horizons — deterministic projections overstate certainty. Run in a Web Worker; seeded/reproducible. | Engine + charts; sizable but self-contained |
| **DCA vs. lump-sum comparison**  | A focused mini-calculator answering a perennial question with the user's own numbers.                                                                                                                                                           | Scenario engine                             |

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

## 5. Sequencing at a Glance

```
Phase 0  Foundations + UX overhaul                    v0.7.0
         (engine, context, CI, dep modernization,
          theme/dark mode, dialogs, validation, empty states)
   ├── Phase 1  Persistence (#20)                     v0.8.0   (independent of 2)
   └── Phase 2  Charts (#18)                          v0.9.0
           └── Phase 3  Dashboard                     v0.10.0
                   └── Phase 4  Scenarios (#24)       v0.11.0
                           └── Phase 5  Optimizer     v1.0.0
Phase 6  Quality items slot in anywhere
Phase 7  Future horizons queue up post-1.0 (v1.1 → v2.0 sequencing in §Phase 7)
```

Issue mapping: **#20 → Phase 1**, **#18 → Phase 2**, **#24 → Phase 4**. Phases 3 and 5 deserve new GitHub issues when their turn approaches.

## 6. Working Agreements (from repo conventions)

- Every PR: `npm test`, `npm run build`, `npm run check:lint`, `npm run check:format` green (enforced by 0.1)
- New business logic lands in `helpers/` with unit tests; UI stays thin
- Semver bump in `package.json` for behavior changes; update `.github/copilot-instructions.md` and README when structure changes
- Keep models input-only; derived data is computed, never stored (after 0.3)
