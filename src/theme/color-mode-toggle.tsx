import { IconButton, Tooltip } from '@mui/material';
import { useColorScheme } from '@mui/material/styles';
import { DarkMode, LightMode } from '@mui/icons-material';

// Light/dark toggle for the command bar. Backed by MUI 9's color-scheme API:
// `useColorScheme()` reads/writes `mode`, which MUI persists to localStorage
// (key `mui-mode`) and applies via the `data-mui-color-scheme` attribute, so the
// preference survives reloads with no flash.
export const ColorModeToggle = () => {
  const { mode, systemMode, setMode } = useColorScheme();

  // `mode` can be 'system' on first visit; resolve to the effective scheme so
  // the button shows the icon for the mode the user would switch TO.
  const resolved = mode === 'system' ? systemMode : mode;
  const isDark = resolved === 'dark';

  // Avoid a hydration/SSR mismatch: until mode is known, render a stable button.
  const handleToggle = () => {
    setMode(isDark ? 'light' : 'dark');
  };

  return (
    <Tooltip title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}>
      <IconButton
        onClick={handleToggle}
        color="inherit"
        aria-label="Toggle light/dark mode"
        // Pushed to the trailing edge of the command bar; when the Toolbar wraps
        // on narrow viewports this keeps the toggle at the end of its row.
        sx={{ marginLeft: 'auto' }}
      >
        {isDark ? <LightMode /> : <DarkMode />}
      </IconButton>
    </Tooltip>
  );
};
