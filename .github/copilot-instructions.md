# Copilot Instructions for PathWise Finance Calculator

## Project Overview

PathWise is a finance calculator web application that allows users to view and perform what-if scenarios on multiple loans and investments simultaneously. The app helps users understand their overall financial position without manual calculations.

## Tech Stack

- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **UI Library**: Material-UI (MUI) v6
- **Date Handling**: Day.js with MUI X Date Pickers
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
│   └── investment-helpers.ts
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

## Testing

Currently, there is no test infrastructure in the project. When adding tests in the future:
- Consider using Vitest (compatible with Vite)
- Test business logic in helpers thoroughly
- Consider component testing for complex UI interactions
