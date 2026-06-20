# Changelog

All notable changes to PathWise are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Detailed acceptance criteria for each phase live in the merged PRs and the
[ROADMAP](./ROADMAP.md); this is the condensed record.

## [Unreleased]

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
  (Loan · Custom liability), each a type menu that opens the matching form.
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
