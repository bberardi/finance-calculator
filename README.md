<div align="center">

<img src="./src/assets/pathwise.png" alt="PathWise logo" width="120" />

# PathWise

**See all your loans and investments in one place — and decide where your next dollar should go.**

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

**PathWise** forecasts your net worth from multiple loans and investments at once, so you can answer that question without exporting everything into a spreadsheet and doing the math by hand.

Everything runs in your browser. There's **no backend, no account, and no tracking** — your numbers never leave your device.

## Features

- 📊 **Multiple positions at a glance** — manage any number of loans and investments side by side, not one calculator at a time.
- 🏦 **Loan modeling** — auto-calculated monthly payment, full amortization schedule, and a point-in-time view of any loan on any date.
- 📈 **Investment modeling** — configurable compounding frequencies, recurring contributions, and yearly step-ups (flat or percentage), with a projected-growth schedule.
- 💰 **Net worth forecasting** — a date-indexed engine projects loans, investments, and overall net worth onto a single shared timeline.
- 💾 **On-device persistence** — opt in to "Save on this device" and your data survives a refresh, stored only in your browser's local storage; turning it off clears it.
- 🔁 **Import / export** — back up and restore your data as JSON, with ID-based smart merge and validation on import.
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
├── models/      # Input-only data types (Loan, Investment, forecast)
├── helpers/     # Pure business logic & math (loans, investments, forecast engine)
├── state/       # Finance data context, reducer, and sample data
├── theme/       # MUI theme and color-mode toggle
├── components/  # Shared UI (dialogs, empty states, row actions)
├── loan/        # Loan table, add/edit form, amortization & PIT popouts
├── investment/  # Investment table, add/edit form, growth & PIT popouts
└── data-manager/# JSON import/export
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

PathWise is actively evolving from a CRUD-and-tables app toward its headline goal: a **"next dollar" optimizer** that ranks where your extra money does the most good. Highlights of what's planned:

1. **Local persistence** — opt-in, on-device storage so your data survives a refresh _(issue #20)_
2. **Visualizations** — line charts of every position and overall net worth over time _(issue #18)_
3. **Net worth dashboard** — total debt, assets, net worth, and milestone callouts at a glance
4. **Scenario forecasting** — overlay what-if extra payments/contributions on the charts _(issue #24)_
5. **"Next dollar" optimizer** — given $X extra per month, rank allocations (all-in-one and splits) by long-term net worth impact

See the full [**ROADMAP.md**](./ROADMAP.md) for phases, technical decisions, and the post-1.0 horizon.

## Contributing

Contributions are welcome! A few working agreements from the project conventions:

- New business logic lands in `src/helpers/` with unit tests; UI components stay thin.
- **Math-touching changes are held to the [Math Correctness Charter](./ROADMAP.md#4-math-correctness-charter-non-negotiable)** — reference tests with cited sources, invariant tests, and 100% line + branch coverage on `src/helpers/**`.
- Keep models input-only; derived data is computed on demand, never stored.
- Bump the version in `package.json` (semver) for behavior changes, and keep the README and `.github/copilot-instructions.md` current when structure changes.

## Glossary

| Term                      | Meaning                                                                                       |
| ------------------------- | --------------------------------------------------------------------------------------------- |
| **Amortization schedule** | The month-by-month breakdown of a loan's payments into principal and interest over its term.  |
| **Compounding frequency** | How often investment interest is applied (e.g., monthly, quarterly, annually).                |
| **Step-up**               | A scheduled yearly increase to an investment's recurring contribution, as a flat amount or %. |
| **Point-in-time (PIT)**   | The state of a loan or investment on a specific date.                                         |
| **Forecast**              | A date-indexed projection of a position's value (or balance) over time.                       |
| **Net worth**             | Total investment value minus total outstanding loan balances at a point in time.              |
