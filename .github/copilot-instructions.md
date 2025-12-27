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
├── helpers/             # Business logic and calculations
│   ├── loan-helpers.ts
│   ├── loan-helpers.test.ts
│   ├── investment-helpers.ts
│   └── investment-helpers.test.ts
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
- **Variables**: camelCase (e.g., `loans`, `testDataEnabled`)
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
11. **Versioning**: If ANY code is changed, increment the version in `package.json` following semantic versioning (major.minor.patch format)

## Development Workflow

**Important**: If you make ANY code changes, you must increment the version in `package.json` following semantic versioning:

- **Major** (x.0.0): Breaking changes or major new features
- **Minor** (0.x.0): New features that are backward compatible
- **Patch** (0.0.x): Bug fixes and minor changes

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

### Testing Best Practices

- **Always write tests** for new business logic in helpers
- Test edge cases and invalid inputs
- Use `toBeCloseTo()` for floating-point comparisons
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
