<div align="center">

<img src="./src/assets/pathwise.png" alt="PathWise logo" width="120" />

# PathWise

**See all your loans, investments, and assets in one place — and decide where your next dollar should go.**

[**🌐 Live site**](https://bberardi.github.io/finance-calculator/) · [**🗺️ Roadmap**](./ROADMAP.md) · [**🐛 Issues**](https://github.com/bberardi/finance-calculator/issues)

[![CI](https://github.com/bberardi/finance-calculator/actions/workflows/ci.yml/badge.svg)](https://github.com/bberardi/finance-calculator/actions/workflows/ci.yml)
[![Deploy](https://github.com/bberardi/finance-calculator/actions/workflows/deploy.yml/badge.svg)](https://github.com/bberardi/finance-calculator/actions/workflows/deploy.yml)
![React](https://img.shields.io/badge/React-19-149eca)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6)
![Vite](https://img.shields.io/badge/Vite-8-646cff)

</div>

---

## Overview

Free financial calculators handle **one** loan _or_ **one** investment at a time. Real decisions don't work that way — _"should my extra $300/month go toward the mortgage, the car loan, or the brokerage account?"_ requires seeing every position together and comparing what-ifs across all of them.

**PathWise** forecasts your net worth from multiple loans, investments, and assets at once, so you can answer that question without exporting everything into a spreadsheet and doing the math by hand.

Everything runs in your browser. There's **no backend, no account, and no tracking** — your numbers never leave your device.

## Features

- 📊 **Multiple positions at a glance** — manage any number of loans and investments side by side, not one calculator at a time.
- 🏦 **Loan modeling** — auto-calculated monthly payment, full amortization schedule, and a point-in-time view of any loan on any date. Optional escrow (property tax + insurance) and PMI roll into a **"true monthly payment"** that feeds your monthly-commitments total, with PMI auto-dropping at 80% loan-to-value and a projected drop-off date — while the forecast still amortizes on principal & interest alone.
- 📈 **Investment modeling** — configurable compounding frequencies, recurring contributions, and yearly step-ups (flat or percentage), with a projected-growth schedule.
- 🏠 **Whole net worth** — cash accounts (HYSA/CD/checking), property (with home-equity from a linked mortgage), and custom assets/liabilities feed the net-worth roll-up alongside loans and investments. `CustomLiability` entries subtract from net worth; all others add.
- 💰 **Net worth forecasting** — a date-indexed engine projects loans, investments, assets, and overall net worth onto a single shared timeline.
- 📉 **Interactive forecast chart** — a line per position (including one per asset) plus an overall net-worth line, with a show/hide legend, 5Y/10Y/30Y/Full range control, and an accessible "view as table" fallback. A **Monte Carlo** toggle swaps the single net-worth line for a volatility-driven **fan chart** — a shaded 10th–90th-percentile band around the median — so long-horizon projections show a range instead of false precision (seeded and reproducible). An **inflation toggle** recasts the chart and the net-worth milestones in **today's dollars**, discounting every future value at an assumed 3%/yr.
- 🧮 **Net worth dashboard** — at-a-glance total assets, debt, net worth, and monthly commitments, plus milestone callouts (debt-free date, net worth at +5/+10/+30 years).
- 🔮 **What-if scenarios** — model extra monthly payments/contributions, overlay them on the chart as dotted lines, and see the impact (net worth at horizon, interest saved, debt-free date moved up).
- 🎯 **"Next dollar" optimizer** — tell PathWise how much extra you have each month and it ranks where that money does the most good: all toward one position **and** splits across several, scored by long-term net worth impact and interest saved. Flip it to **one-time mode** to ask the same question of a lump sum — _"where does a $5k bonus go?"_ — applied now against your balances. An **employer 401(k) match** (a % of your contributions up to a % of salary) feeds the ranking, so a matched contribution is valued correctly against paying down debt. Compare named **strategy presets** — debt-focused, investment-focused, or balanced by rate — at a glance or **side by side** (net worth at +5/+10/+30 years, debt-free date, and final investments-vs-debt split), pit your own intuition against them with a custom split builder, and send any plan to the chart with one click. The search runs in a Web Worker so the interaction stays smooth.
- 💾 **On-device persistence** — opt in to "Save on this device" and your data survives a refresh, stored only in your browser's local storage; turning it off clears it.
- 🔁 **Import / export** — back up and restore your data as JSON (schema v5), with ID-based smart merge and validation on import; older files upgrade forward automatically — a v3 file gains an empty asset list, and a v4 file's investments fold into assets as investment-type holdings.
- 🦋 **Monarch import** — populate assets/liabilities from Monarch Money's "account balance history" CSV exports — a single all-accounts file or several per-account files. Every account in the file is imported: its latest balance maps to a custom asset, or a custom liability when negative; re-importing updates the same entries in place. A per-account **type picker** at import promotes each account from the catch-all custom type to an explicit one — choosing **Loan, Cash, Property, or Investment** opens that type's editor pre-filled from the account, so its details (loan rate/term, cash APY, property appreciation, investment returns/contributions) are captured up front; a Monarch debt can become a real amortizing loan in the same step. Runs entirely on-device through the same review-and-undo flow as JSON import.
- 🔀 **Convert types** — retype any holding from its edit dialog (including flipping an asset to a liability or back), or **convert a custom liability into a Loan** (mortgage) — the loan form opens pre-filled with the balance to finish the rate and term.
- 🌗 **Light & dark mode** — a full Material UI theme with a persisted color-mode toggle.
- 📱 **Responsive** — data tables on desktop, cards on mobile.
- ✅ **Trustworthy math** — the calculation core is a pure, fully unit-tested TypeScript layer (see the [Math Correctness Charter](./ROADMAP.md#4-math-correctness-charter-non-negotiable)).

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (Node 24 recommended, to match the lockfile)
- npm (ships with Node)

### Install & run

```bash
# Clone the repository
git clone https://github.com/bberardi/finance-calculator.git
cd finance-calculator

# Install dependencies
npm install

# Start the development server
npm start
```

The app will be available at the URL Vite prints (default `http://localhost:5173`).

### Build for production

```bash
npm run build      # type-check + bundle to dist/
npm run preview    # serve the production build locally
```

## Development

### Scripts

| Command                  | What it does                                |
| ------------------------ | ------------------------------------------- |
| `npm start`              | Start the Vite dev server (alias for `dev`) |
| `npm run build`          | Type-check and build for production         |
| `npm run preview`        | Preview the production build locally        |
| `npm test`               | Run the test suite once (Vitest)            |
| `npm run test:watch`     | Run tests in watch mode                     |
| `npm run test:ui`        | Run tests with the Vitest UI                |
| `npm run check:lint`     | Lint the codebase                           |
| `npm run check:format`   | Check formatting with Prettier              |
| `npm run clean:lint`     | Auto-fix lint issues                        |
| `npm run clean:prettier` | Format all files with Prettier              |

Every change should land with `npm test`, `npm run build`, `npm run check:lint`, and `npm run check:format` all green — this is enforced in CI on every pull request.

### Project structure

```
src/
├── models/      # Input-only data types (Loan, Investment, Asset, forecast)
├── helpers/     # Pure business logic & math (loans, investments, assets, forecast engine)
├── state/       # Finance data context, reducer, and sample data
├── theme/       # MUI theme and color-mode toggle
├── components/  # Shared UI (dialogs, empty states, row actions)
├── scenario/    # What-if scenario builder, bar, and impact summary
├── optimizer/   # "Next dollar" optimizer panel, custom split builder, Web Worker
├── loan/        # Loan table, add/edit form, amortization & PIT popouts
├── investment/  # Investment table, add/edit form, growth & PIT popouts
├── asset/       # Asset table, add/edit form (cash, property, custom assets/liabilities)
└── data-manager/# JSON import/export + Monarch balance-CSV import
```

The `helpers/` and `models/` folders form a **pure, framework-free calculation layer** (TypeScript + Day.js only, no React or MUI). All financial math lives there and is covered by unit tests; UI calls the helpers, never the reverse.

## Tech Stack

- **React 19** + **TypeScript 5**
- **Vite 8** build tooling
- **Material UI (MUI) v9** with Emotion styling and **MUI X Date Pickers**
- **Day.js** for date handling
- **Vitest** for testing
- Deployed to **GitHub Pages** via GitHub Actions

## Roadmap

PathWise reached its headline goal at **v1.0** — a **"next dollar" optimizer** that ranks where your extra money does the most good. The journey there:

1. **Local persistence** — opt-in, on-device storage so your data survives a refresh _(issue #20)_ ✅
2. **Visualizations** — line charts of every position and overall net worth over time _(issue #18)_ ✅
3. **Net worth dashboard** — total debt, assets, net worth, and milestone callouts at a glance ✅
4. **Scenario forecasting** — overlay what-if extra payments/contributions on the charts _(issue #24)_ ✅
5. **"Next dollar" optimizer** — given $X extra per month, rank allocations (all-in-one and splits) by long-term net worth impact ✅

**v1.1** extends net worth to the whole balance sheet:

6. **Whole net worth (Phase 7)** — cash accounts (HYSA/CD/checking with APY), property (appreciation rate + home-equity from a linked mortgage), and custom assets/liabilities fill out the net-worth picture; export schema bumped to v4 ✅

Post-1.1 work (employer match, Monte Carlo, and more) is sequenced in the full [**ROADMAP.md**](./ROADMAP.md), alongside phases, technical decisions, and the future horizon.

## Contributing

Contributions are welcome! A few working agreements from the project conventions:

- New business logic lands in `src/helpers/` with unit tests; UI components stay thin.
- **Math-touching changes are held to the [Math Correctness Charter](./ROADMAP.md#4-math-correctness-charter-non-negotiable)** — reference tests with cited sources, invariant tests, and 100% line + branch coverage on `src/helpers/**`.
- Keep models input-only; derived data is computed on demand, never stored.
- Bump the version in `package.json` (semver) for behavior changes, and keep the README and `.github/copilot-instructions.md` current when structure changes.

## Glossary

| Term                      | Meaning                                                                                                                        |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Amortization schedule** | The month-by-month breakdown of a loan's payments into principal and interest over its term.                                   |
| **Compounding frequency** | How often investment interest is applied (e.g., monthly, quarterly, annually).                                                 |
| **Step-up**               | A scheduled yearly increase to an investment's recurring contribution, as a flat amount or %.                                  |
| **Point-in-time (PIT)**   | The state of a loan or investment on a specific date.                                                                          |
| **Forecast**              | A date-indexed projection of a position's value (or balance) over time.                                                        |
| **Net worth**             | Total investment and asset value minus total outstanding loan balances (and any custom liability balances) at a point in time. |
| **Scenario**              | A named what-if: extra monthly amounts applied on top of existing payments/contributions, overlaid on the chart.               |
| **Allocation plan**       | A way to divide $X extra per month across positions — all to one (single-target) or split across several.                      |
| **Next-dollar optimizer** | The engine that scores and ranks allocation plans by long-term net worth impact and interest saved.                            |
