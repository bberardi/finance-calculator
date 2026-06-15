# Copilot Instructions for PathWise Finance Calculator

## Project Overview

PathWise is a finance calculator web application that allows users to view and perform what-if scenarios on multiple loans and investments simultaneously. The app helps users understand their overall financial position without manual calculations.

## Tech Stack

- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Testing**: Vitest with globals enabled
- **UI Library**: Material-UI (MUI) v6.1
- **Date Handling**: Day.js with MUI X Date Pickers v7
- **Styling**: Emotion (CSS-in-JS via MUI)
- **Deployment**: GitHub Pages

## Project Structure

```
src/
├── App.tsx              # Main app component
├── Body.tsx             # Main body component with state management
├── Header.tsx           # App header
├── Footer.tsx           # App footer
├── models/              # TypeScript interfaces and types
│   ├── loan-model.ts
│   └── investment-model.ts
├── helpers/             # Pure business logic and calculations (the math core)
│   ├── loan-helpers.ts
│   ├── investment-helpers.ts
│   ├── forecast-helpers.ts
│   ├── storage-helpers.ts       # On-device persistence I/O (save/load/clear, issue #20)
│   ├── migrate-helpers.ts       # D8 versioned schema-migration ladder
│   ├── *.test.ts             # Co-located unit tests
│   ├── math-reference.test.ts    # Charter layer 1: oracle tests (Excel/hand-derived)
│   ├── forecast-consistency.test.ts # Charter layer 2: engine-vs-schedule
│   ├── math-properties.test.ts   # Charter layer 3: fast-check invariants
│   ├── math-edge-cases.test.ts   # Charter layer 4: edge catalog
│   └── PRECISION.md              # Charter layer 5: rounding & consistency policy
├── hooks/               # Reusable React hooks (UI state, e.g. use-field-tracking)
├── persistence/         # "Save on this device" toggle + usePersistence hook (Phase 1)
├── data-manager/        # JSON import/export command-bar actions
├── state/               # Finance-data context + reducer (D2)
├── loan/                # Loan-related components
│   ├── loan-table.tsx
│   ├── add-edit-loan.tsx
│   ├── amortization-popout.tsx
│   └── pit-popout.tsx
└── investment/          # Investment-related components
    ├── investment-table.tsx
    ├── add-edit-investment.tsx
    ├── growth-schedule-popout.tsx
    └── pit-popout.tsx
```

## Code Style and Conventions

### TypeScript

- Use TypeScript for all new files
- Define interfaces for all data models
- Use proper typing; avoid `any` types
- Export interfaces from `models/` directory

### React

- Use functional components with hooks
- Use `useState` for component state management
- Component file names use kebab-case (e.g., `add-edit-loan.tsx`)
- Export components as named exports (e.g., `export const MyComponent = () => {}`)

### Naming Conventions

- **Interfaces**: PascalCase (e.g., `Loan`, `Investment`, `AmortizationScheduleEntry`)
- **Interface Properties**: PascalCase (e.g., `Principal`, `InterestRate`, `StartDate`)
- **Functions**: camelCase (e.g., `generateAmortizationSchedule`, `calculateMonthlyPayment`)
- **Variables**: camelCase (e.g., `loans`, `sampleDataLoaded`)
- **Files**: kebab-case (e.g., `loan-helpers.ts`, `add-edit-loan.tsx`)

### Material-UI Usage

- Use MUI components for all UI elements
- Import from `@mui/material` for core components
- Import from `@mui/icons-material` for icons
- Import from `@mui/x-date-pickers` for date pickers
- Use the `sx` prop for inline styling
- Follow MUI's component composition patterns

### Code Formatting

- **Prettier** is configured with:
  - Semicolons: required
  - Quotes: single quotes
  - Trailing commas: ES5 style
  - Bracket spacing: enabled
- Run `npm run clean:prettier` to format all files
- Run `npm run check:format` to check formatting

### Linting

- **ESLint** is configured for TypeScript and React
- Extends recommended configs for JavaScript, TypeScript, and React Hooks
- Run `npm run clean:lint` to auto-fix lint issues
- Run `npm run check:lint` to check for lint issues
- React Refresh plugin enabled for fast refresh during development

## Development Commands

```bash
npm start          # Start development server (alias for npm run dev)
npm run dev        # Start Vite development server
npm run build      # Build for production (TypeScript compilation + Vite build)
npm test           # Run tests once
npm run test:watch # Run tests in watch mode (re-runs on file changes)
npm run test:ui    # Run tests with UI
npm run test:coverage  # Run tests + enforce 100% coverage gate on src/helpers/**
npm run test:mutation  # Run Stryker mutation testing over src/helpers/**
npm run preview    # Preview production build locally
npm run deploy     # Deploy to GitHub Pages
```

## Business Logic

### Loan Calculations

- Amortization schedules are calculated based on loan principal, interest rate, and term
- Monthly payments are calculated using standard amortization formulas
- Support for tracking principal vs. interest payments over time
- Point-in-Time (PIT) calculations show loan status at a specific date

### Investment Calculations

- Support for various compounding frequencies (monthly, quarterly, annually)
- Growth schedules track investment value over time
- Support for regular contributions/withdrawals
- Date-based calculations for accurate projections

## Important Notes

- The app is deployed to GitHub Pages with base path `/finance-calculator/`
- No backend or database; all data is managed in client-side state
- Models are input-only: derived data (amortization schedules, growth projections, forecasts) is computed on demand by helpers and never stored on models or serialized into exports
- **Core/UI boundary (decision D7)**: `src/helpers/**` and `src/models/**` are a pure, framework-free layer (TypeScript + dayjs only). An ESLint rule forbids them from importing React, MUI, emotion, or any UI component (`*.tsx`). UI depends on the core, never the reverse — put React hooks in `src/hooks/`, not `src/helpers/`.
- Future plans include file upload/export for data persistence
- Test data can be toggled in the UI for development purposes

## When Making Changes

1. **Models**: Define all data structures in `src/models/`
2. **Calculations**: Implement business logic in `src/helpers/`
3. **Components**: Create reusable components following the existing structure
4. **Styling**: Use MUI's `sx` prop or MUI's styling solutions; avoid adding new CSS files unless necessary
5. **State Management**: Keep state in parent components (like `Body.tsx`) and pass down as props
6. **Date Handling**: Use Day.js for all date operations
7. **Forms**: Use MUI form components with proper validation
8. **Tables**: Use MUI Table components for displaying loan/investment data
9. **Documentation**: After making changes, review and update this file and other documentation (README.md, etc.) to keep it current
10. **Testing**: Write tests for new business logic in helpers; run tests before submitting code
11. **Versioning**: When you change application behavior, public APIs, or user-facing features, increment the version in `package.json` following semantic versioning (major.minor.patch). Purely non-functional changes (comments, documentation-only edits, formatting, or test refactors that do not change behavior) do not require a version bump.

## Development Workflow

**Important**: If your changes affect application behavior, public APIs, or user-facing features, you must increment the version in `package.json` following semantic versioning:

- **Major** (x.0.0): Breaking changes or major new features
- **Minor** (0.x.0): New features that are backward compatible
- **Patch** (0.0.x): Bug fixes and other non-breaking functional changes

Purely non-functional changes (e.g., comment updates, documentation-only edits, code formatting, or test refactors that do not change runtime behavior) generally do **not** require a version bump.

Before submitting code for draft PRs or after completing work, always run:

```bash
npm test              # Run tests to ensure functionality
npm run build         # Verify the build succeeds
npm run check:lint    # Check for linting issues
npm run check:format  # Check code formatting
```

Fix any issues found before submitting your changes.

## Testing

The project uses **Vitest** as its testing framework, configured with globals enabled and a Node environment.

### Test Structure

- Test files are co-located with source files using `.test.ts` suffix (e.g., `loan-helpers.test.ts`)
- Comprehensive test coverage exists for business logic in helpers
- Tests use Vitest's `describe`, `it`, and `expect` APIs (Jest-like syntax)

### Math Correctness Charter (non-negotiable for `src/helpers/**`)

Financial math must be provably correct, with the proof executable. Any PR
touching helper math must uphold all of:

- **100% line + branch coverage** on `src/helpers/**`, enforced as a hard CI
  gate (`npm run test:coverage`, thresholds in `vite.config.ts`).
- **Reference tests** for every formula against ≥2 independent external sources
  (spreadsheet PMT/FV/IPMT/CUMIPMT or hand derivations), with the source cited.
- **Property/invariant tests** (fast-check) and an **edge-case catalog**.
- **Rounding** follows `src/helpers/PRECISION.md` (cents, round-half-up); assert
  exact values where the policy defines them, justify every `toBeCloseTo`.
- A math bug gets a **failing regression test committed before the fix**.
- **Mutation testing** (Stryker, `npm run test:mutation`) runs on a schedule;
  surviving mutants are triaged to zero or waived with a comment.
- UI never re-implements math — helpers are the single source of truth.

### Testing Best Practices

- **Always write tests** for new business logic in helpers
- Test edge cases and invalid inputs
- Prefer exact assertions (`toBe`); use `toBeCloseTo()` only with a justifying
  comment (see PRECISION.md)
- Group related tests using `describe` blocks
- Write descriptive test names that explain what is being tested

### Running Tests

```bash
npm test              # Run all tests once
npm run test:watch    # Watch mode - re-runs tests on file changes
npm run test:ui       # Interactive UI for running and debugging tests
```

### Example Test Structure

```typescript
import { describe, it, expect } from 'vitest';
import { myFunction } from './my-helpers';

describe('MyFunction', () => {
  it('should handle valid inputs correctly', () => {
    const result = myFunction(validInput);
    expect(result).toBe(expectedValue);
  });

  it('should return 0 for invalid inputs', () => {
    expect(myFunction(invalidInput)).toBe(0);
  });
});
```
