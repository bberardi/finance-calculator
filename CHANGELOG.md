# Changelog

All notable changes to PathWise are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Detailed acceptance criteria for each phase live in the merged PRs and the
[ROADMAP](./ROADMAP.md); this is the condensed record.

## [Unreleased]

## [1.13.0] — Enhancement ROI ("is this improvement worth it?")

### Added

- **Renovation / enhancement ROI calculator (Phase 9.3).** Property rows gain an
  **Enhancement ROI** action that opens a small calculator: enter an improvement's
  cost and the value it adds, and see how much of the cost it recoups, its
  immediate effect on net worth, the added value grown to a chosen horizon, and —
  as that added value appreciates with the home — when (if ever) it breaks even.
  The appreciation rate is pre-filled from the asset. Pure closed-form math
  (`evaluateEnhancement`): break-even solves `valueAdd·(1+g)^t = cost`, so it is 0
  when the value added already covers the cost, a positive number of years when
  appreciation gets it there, and "not at this rate" when it never will. Offered
  only for appreciating property assets.

## [1.12.0] — Inflation toggle (real vs. nominal)

### Added

- **See future values in today's dollars (Phase 9.2).** A dashboard toggle
  recasts the forward-looking figures — the +5y/+10y/+30y net-worth milestones and
  every line on the forecast chart (including the Monte Carlo fan) — from nominal
  into **real** terms, discounting each value back to the present at an assumed
  3%/yr inflation. It's pure post-processing on the already-computed forecast (no
  engine change): each point is discounted by its own distance from today, so
  today's anchor is unchanged and the gap widens with the horizon. The
  assumptions panel notes the rate.

## [1.11.0] — Monte Carlo mode

### Added

- **Monte Carlo mode on the forecast chart (Phase 9.1).** A new toggle replaces
  the single average-return net-worth line with a volatility-driven **fan chart** —
  a shaded 10th–90th-percentile band around a median path — so a long-horizon
  projection shows a range instead of false precision. It overlays a
  geometric-Brownian-motion shock on the existing deterministic forecast (only
  investments carry market risk), is **seeded and reproducible**, and at zero
  volatility collapses exactly to today's forecast line. Computed inline and
  memoized; no new inputs and no engine changes.

## [1.10.0] — Strategy comparison view

### Added

- **Compare allocation strategies side by side (Phase 8.5).** A new "Compare
  strategies side by side" section in the optimizer lays the baseline and every
  preset (debt-focused, investment-focused, balanced by rate) next to each other,
  with **net worth at +5y / +10y / +30y**, the **debt-free date**, and the
  **final investments-vs-debt split** at +30y for each — and flags the strategy
  with the highest long-run net worth. The figures come from the same forecast
  engine the chart and dashboard use (and the milestones now accept a what-if
  scenario), so they agree everywhere. It respects the per-month / one-time
  toggle and only computes once expanded, keeping the optimizer's default view
  focused.

## [1.9.0] — Allocation strategy presets

### Added

- **Pre-built allocation strategies in the "next dollar" optimizer (Phase 8.4).**
  Alongside the ranked suggestions and the custom split builder, the optimizer now
  shows named, one-click strategies for your extra budget — **Debt-focused**
  (everything to the highest-rate loan), **Investment-focused** (everything to the
  highest-return holding), and **Balanced by rate** (split across every position
  in proportion to its rate) — each scored against the baseline (net worth added,
  interest saved, debt-free change) and chartable as a scenario. They respect the
  per-month / one-time toggle, so you can compare whole strategies for a recurring
  amount or a lump sum at a glance.

## [1.8.0] — True monthly payment (escrow & PMI)

### Added

- **A loan's "true monthly payment" — principal & interest plus escrow and PMI
  (Phase 8.3).** A loan can now carry a home value, annual property tax, annual
  homeowners insurance, and a monthly PMI premium. These don't pay down the
  balance (the forecast still amortizes on principal & interest alone), but they
  make the **monthly-commitments** total honest and surface a payment breakdown
  and a **"PMI drops off around …"** date on the loan's point-in-time view. PMI is
  charged only while loan-to-value is above 80% and is dropped automatically at or
  below the line (measured against the home's original value, per the federal
  Homeowners Protection Act). All four fields are optional and additive — a loan
  without them is unchanged, and files round-trip with no schema bump.

## [1.7.0] — One-time lump-sum optimizer

### Added

- **Optimize a one-time lump sum, not just a recurring monthly extra (Phase
  8.2).** A new **Per month / One-time** toggle in the "next dollar" optimizer
  answers "where does a $5,000 bonus go?" the same way it answers the monthly
  question — it ranks single-target and split allocations of the lump by
  long-term net-worth impact and interest saved, and the custom split builder and
  "view as scenario" overlay work in either mode. A one-time payment is applied
  once at the first forecast month: on a loan it drops the principal (saving
  future interest and moving up the debt-free date); on an investment it
  compounds from month one and earns the employer match up to the remaining
  annual cap, just like a recurring contribution. Scenarios now carry optional
  one-time amounts and round-trip through JSON export/import (no schema bump —
  the fields are additive and optional).

## [1.6.0] — Employer 401(k) match in the optimizer

### Added

- **Employer 401(k) match, fed into the "next dollar" optimizer (Phase 8.1).** An
  investment can now carry an employer match — the employer adds a percentage of
  your contributions, up to a percentage of your salary each year. The match (on
  both your recurring contributions and any extra the optimizer allocates, accrued
  against the annual cap) flows through the forecast, so funding a matched account
  is finally valued correctly against paying down debt — the founding "pay the 6%
  loan vs. fund the 401(k) with a 50% match" question the optimizer was previously
  blind to. Set it via an opt-in toggle on the investment form; the salary input
  is used only to size the match cap and is never stored as income.

## [1.5.0] — Type editors at Monarch import

### Added

- **Set an account's full type — including Loan — while importing from Monarch.**
  The per-account type picker now offers **Loan** and **Investment** alongside
  Cash / Property / Custom asset / Custom liability. Choosing Loan, Cash,
  Property, or Investment opens that type's editor pre-filled from the account
  (name, provider, balance), so its type-specific fields — loan rate/term/payment,
  cash APY, property appreciation and linked mortgage, investment return and
  contributions — are captured up front instead of landing half-specified. A
  Monarch debt can become a real amortizing loan in the same step, rather than
  importing as a custom liability and being converted afterward. Custom
  asset/liability still import in one click, and the whole batch commits as a
  single undoable merge.

## [1.4.1] — Optimizer and projection robustness

### Fixed

- **The optimizer no longer shows a spinner that never resolves when its
  background worker fails.** A worker error now clears the spinner and surfaces an
  error message instead of a stuck "calculating…" state, and failures are reported
  on the same channel as results so a stale failure can't flag the current search.
  (#131)
- **Bounded the optimizer's suggested-split search** so aggressive engine options
  can no longer blow up the search space — the split is capped to at most four
  targets and the step granularity is floored to keep the grid bounded. Default
  behavior is unchanged. (#134)
- **Clarified that the point-in-time investment calculator is a theoretical
  projection from an investment's original inputs**, not the actual-value anchor
  the dashboard and chart use, so its figures can legitimately differ for a
  position with an explicit current value. Explained in code and in a caption on
  the popout. (#135)

## [1.4.0] — Investments are a kind of asset

### Changed

- **Investments are now a type of asset, not a separate collection.** An
  investment is modeled as an `AssetType.Investment` holding, so every position
  lives in one unified `assets` list. All investment features are preserved
  unchanged — configurable compounding, recurring contributions, yearly step-ups
  (flat or percentage), the projected-growth schedule, point-in-time values, and
  the optimizer/scenario contributions. The forecast engine still computes on the
  `Investment` shape; investment-type assets are converted to it at the UI/state
  boundary in a new pure `asset-investment-helpers.ts` (100% covered), leaving the
  Charter-gated math core untouched and avoiding any double-counting in the
  net-worth roll-up.
- **Export/persistence schema is now v5.** Existing data upgrades forward
  automatically on import or device-load: a standalone `investments` array folds
  into `assets` as `AssetType.Investment` entries (`StartingBalance` → `Balance`,
  `AverageReturnRate` → `GrowthRate`, the rest by name). Older v2/v3 files still
  climb the same migration ladder; new exports are written at v5.

## [1.3.0] — Convert holding types

### Added

- **Convert the type of a holding.** Editing any asset or liability now offers
  the full type list, so a holding can be retyped freely — including flipping an
  **asset to a liability** or back (e.g. a credit card that imported as an asset).
- **Convert a custom liability into a Loan (mortgage).** A "Convert to loan" row
  action on the Liabilities table opens the loan form pre-filled with the name,
  provider, and balance (as both principal and current amount); finish the rate
  and term and the original custom liability is replaced by the loan. Seeding
  lives in a pure `convert-helpers.ts` (100% covered).
- **Set account types at Monarch import.** A per-account type picker now appears
  when importing Monarch CSVs, so each account can be promoted from the catch-all
  custom asset/liability to an explicit Cash / Property (or kept custom) before it
  lands. The picker shows how many accounts are new vs. will update an existing
  entry, and the import stays undoable.

## [1.2.1]

### Fixed

- **Monarch import now imports every account from an all-accounts export.** The
  importer assumed one account per file and kept only the single most-recent row,
  so a single all-accounts CSV collapsed to one asset. It now groups rows by the
  `Account Name` column and creates one asset (or custom liability, by balance
  sign) per distinct account, each anchored to that account's latest balance, and
  also accepts a bare `Name` header for the account column. Per-account files and
  the review/merge/undo flow are unchanged.

## [1.2.0] — Monarch import

### Added

- **Import from Monarch (account balances):** a command-bar action that turns
  Monarch Money's "account balance history" CSV exports into PathWise assets and
  liabilities. Select one or more files (Monarch exports one per account); each
  account's most recent balance becomes a **custom asset** (positive amount) or a
  **custom liability** (negative amount, stored as the amount owed), with the
  account name taken from the CSV's `Account Name` column or the file name and the
  growth rate left at 0 for you to fill in. There is no account-type column in the
  export, so asset-vs-liability is inferred from the balance's sign (Monarch
  negates debt). The import reuses the existing review-before-merge preview and
  soft-undo, and — because each account gets a stable, name-derived ID —
  re-importing later **updates the same entries in place** instead of duplicating
  them. Parsing/mapping lives in a new pure `monarch-helpers.ts` held to the same
  100% coverage gate as the rest of `src/helpers/**`.

### Quality (Phase 6 correctness backlog)

- **Date-math rollover (6.9) — resolved.** The month-end overflow bug
  (`Jan 31 + 1 month` → `Mar 3` via `Date.setMonth`) is fixed by clamping each
  month/year step to the last valid day of the target month (`addMonthsClamped`
  / `getNextCompoundingDate` in `investment-helpers.ts`, #93). This native-`Date`
  clamping supersedes the originally-planned dayjs migration — same correctness,
  without adding dayjs to the hot forecast/growth loops. Covered by the
  Charter's edge-case catalog: `Jan 31 + 1mo → Feb 28`, `Feb-29` leap/non-leap
  anniversaries, and the 2100 century rule.
- **Mutation-score ratchet (6.10).** Refreshed the Stryker baseline on the
  post-Phase-7 codebase: overall mutation score **86.99%** over 1,937 covered
  mutants (up from the pre-Phase-7 85.04% / ~1,103). Added mutation-guard tests
  that kill the `getDefaultHorizon` reduce-operator survivor and close the
  quarterly-contribution non-boundary coverage gap, and **ratcheted
  `thresholds.break` 83 → 85** (about two points below the score, preserving
  headroom for run-to-run timeout variance) so the weekly run fails on a
  regression without flaking. Remaining survivors are dominated by equivalent
  mutants (boundary operators on guards that yield identical rounded output);
  driving them to zero is an open-ended triage tracked in the config comment.

## [1.1.1]

### Fixed

- Clarified the scenario and optimizer **"Net worth at horizon"** readout — it
  reports the _change vs. baseline_, not absolute net worth. Relabelled it
  **"Net worth added at horizon"** and show **"No change"** instead of `$0` for a
  debt-paydown that doesn't move net worth at the horizon (the gain shows as
  interest saved / earlier debt-free).
- Threaded assets (cash/property/custom) through the scenario-impact and
  optimizer net-worth engine, completing the Phase 7 wiring so their net-worth
  anchor matches the chart, dashboard, and milestones. Passive holdings cancel in
  the delta, so the displayed impact and plan rankings are unchanged.

## [1.1.0] — Phase 7: Whole Net Worth

Made the net-worth line _true_ by letting PathWise hold everything a person owns,
via one simple **Asset** type (a balance plus an annual growth/decline rate) with
an `AssetType` discriminator covering all three Phase 7 items.

### Added

- **Cash accounts (7.1):** HYSA / CD / checking — a balance plus an APY, the
  simplest new asset type and the biggest completeness win.
- **Property + mortgage pairing (7.2):** a home value with an appreciation rate,
  optionally linked to its mortgage by `LinkedLoanId`, so the app derives a
  **home-equity** figure (property value − loan balance) and net worth is honest
  for homeowners.
- **Custom asset / liability (7.3):** a catch-all with a simple growth/decline
  rate (a depreciating car, a private loan, collectibles) — the escape hatch so
  no net worth is blocked on a missing type. Custom liabilities subtract from net
  worth; everything else adds.
- Assets flow through the whole stack: the forecast engine (`forecastAsset`,
  `forecastHomeEquity`), the net-worth roll-up, the chart (one line per asset),
  the dashboard summary cards and milestones, the optimizer-adjacent dashboard,
  JSON import/export, and on-device persistence — with an Assets table and
  add/edit dialog in the UI.
- **Two consolidated entry points** in the command bar (and onboarding): **Add
  Asset** (Investment · Cash · Property · Custom asset) and **Add Liability**
  (Loan · Custom liability), each a type menu that opens the matching form. The
  positions display mirrors this: a **Liabilities** section groups loans and
  custom liabilities together (loans keep their amortization/payoff/PIT table),
  alongside the Investments and Assets sections.
- Export **schema v4** (the next D8 migration rung): a v3 file gains an empty
  `assets` list on import; older files keep migrating forward.

Per the Math Correctness Charter, the new asset math ships with reference,
property, and edge-case tests and keeps `src/helpers/**` at 100% line+branch
coverage.

## [1.0.x] — Phase 6: Quality & Hardening

Post-1.0 **Phase 6 — Quality & Hardening** work and bug fixes, on top of 1.0.0.

### Added

- **Accessibility (6.1):** `aria-label`s on the table/card action icon buttons, a
  skip-to-content link, and `header` / `main` landmarks for keyboard and
  screen-reader navigation.
- **UI test coverage (6.2):** React Testing Library + jsdom component tests for
  the loan/investment tables, the add/edit forms, and the DataManager import
  preview/undo flow, plus a Playwright end-to-end smoke test that drives the full
  add-positions → optimize → view-as-scenario path in a real browser (run as a CI
  job). The component suite runs alongside the math suite in Vitest; the 100%
  line+branch coverage gate stays scoped to the math core.
- **DataManager safety (6.3):** a pre-merge "what changed" preview listing which
  loans, investments, and scenarios an import will _add_ vs. _overwrite_, plus a
  soft-undo that restores the exact pre-merge data. (#107)
- **Schedule popout polish (6.5):** virtualized amortization and growth tables
  (smooth at 600+ rows) and a lifetime-totals footer — interest paid /
  contributed / earned. (#107)
- **Discoverability (6.7):** a production favicon served from `public/`, and
  SEO / Open Graph / Twitter-card metadata in `index.html`.
- **Repo hygiene (6.8):** this changelog, a contributing guide, issue/PR
  templates, and Dependabot.

### Changed

- **Performance gate (6.6):** code-split the forecast chart (`@mui/x-charts`),
  date pickers, and schedule popouts off the initial bundle, and added a CI
  bundle-size budget so first paint can't silently regress. (#107)
- Moved `prettier` to `devDependencies`.

### Fixed

- Month-end compounding, uneditable imported loans, and defensive hardening. (#104)
- Import/form validation, scenario keys, point-in-time date, and CurrentValue
  projection. (#105)

## [1.0.0] — Phase 5: "Next Dollar" optimizer

The founding goal, shipped: given $X extra per month, rank where it does the most
good — single targets _and_ splits — by long-term net-worth impact. A pure
`evaluatePlan` / `suggestPlans` engine runs in a Web Worker behind a ranked
comparison panel with "view as scenario" and a custom split builder. (#90, #92, #96)

## [0.11.0] — Phase 4: Scenario forecasting

Named what-if scenarios overlaid on the chart as dashed, color-matched lines, an
impact summary, and persistence via export schema v3 (the first migration step). (#82)

## [0.10.0] — Phase 3: Net-worth dashboard

Summary cards, milestone callouts, table upgrades (sorting, totals, payoff /
current columns, principal-paid progress, clone), and a stated-assumptions panel. (#82)

## [0.9.0] — Phase 2: Visualizations

A forecast chart with per-entity and overall net-worth lines, stable colors, a
show/hide legend, 5Y/10Y/30Y/Full range control, and an accessible table fallback. (#82)

## [0.8.0] — Phase 1: Local persistence

Opt-in on-device storage with a versioned migration ladder, a first-visit privacy
notice, and a global error boundary with an "export my data" escape hatch. (#82)

## [0.7.0] — Phase 0: Foundations & UX overhaul

The PR CI gate, the date-indexed forecast engine, derived-data stripping
(export v2), context + reducer state, dependency modernization (React 19 / MUI 9 /
Vite 8), theming + dark mode, dialog forms, validation, sample data and empty
states, and the Math Correctness Charter with a core/UI boundary. (#37–#66, #76, #87)
