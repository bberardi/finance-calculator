# Contributing to PathWise

Thanks for your interest! PathWise is a client-side net-worth forecaster —
everything runs in the browser, with no backend and no tracking. Contributions
that sharpen the core question (forecasting net worth and deciding where money
goes) are very welcome.

## Before you start

- Skim the [ROADMAP](./ROADMAP.md). Most planned work is sequenced there, along
  with the project's **non-goals**: PathWise is deliberately **not** a
  budgeting/expense tracker, does **no** bank-account linking, **no** real-time
  market data, and **no** tax advice. Ideas that fall under those are likely out
  of scope.
- For anything non-trivial, open an issue first so we can agree on the approach.

## Development setup

Prerequisites: [Node.js](https://nodejs.org/) (Node 24 recommended, to match the
lockfile) and npm.

```bash
git clone https://github.com/bberardi/finance-calculator.git
cd finance-calculator
npm install
npm start        # Vite dev server (http://localhost:5173)
```

## Before every PR

All four must pass — they're enforced in CI on every pull request:

```bash
npm test               # Vitest (unit + property tests)
npm run build          # type-check + production build
npm run check:lint     # ESLint
npm run check:format   # Prettier
```

`npm run clean:lint` and `npm run clean:prettier` auto-fix most issues. A bundle
-size budget (`npm run check:size`, after a build) also runs in CI.

## Working agreements

- **New business logic lands in `src/helpers/` with unit tests; UI stays thin.**
  The `helpers/` and `models/` folders are a pure, framework-free layer
  (TypeScript + Day.js only) — importing React or MUI there is a build failure
  (the D7 boundary).
- **Math is held to the
  [Math Correctness Charter](./ROADMAP.md#4-math-correctness-charter-non-negotiable).**
  Any math-touching change ships with cited reference tests, upholds the
  invariants, and keeps `src/helpers/**` at **100% line + branch coverage**.
  Every math bug gets a failing regression test committed _before_ the fix.
- **Models are input-only.** Derived data (schedules, forecasts) is computed on
  demand, never stored or serialized.
- **Bump the version** in `package.json` (semver) for behavior changes, and keep
  `README.md` and `.github/copilot-instructions.md` current when structure
  changes. Note user-facing changes in [`CHANGELOG.md`](./CHANGELOG.md) under
  _Unreleased_.

## Commit & PR

- Keep PRs focused; fill out the checklist in the PR template.
- Reference the issue or ROADMAP item the change addresses.

By contributing, you agree that your contributions are licensed under the
project's [MIT License](./LICENSE).
