/* eslint-disable react-refresh/only-export-components */
import { ReactElement, ReactNode } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { ThemeProvider } from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { theme } from '../theme';
import { FinanceDataProvider } from '../state/finance-data-context';

// Wraps a component in the same providers the real app mounts it under (theme,
// date-picker localization, and the finance-data context) so component tests
// render exactly as production does.
const AllProviders = ({ children }: { children: ReactNode }) => (
  <ThemeProvider theme={theme}>
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <FinanceDataProvider>{children}</FinanceDataProvider>
    </LocalizationProvider>
  </ThemeProvider>
);

export const renderWithProviders = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllProviders, ...options });

// Re-export the testing-library API plus user-event so tests have one import.
export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';
