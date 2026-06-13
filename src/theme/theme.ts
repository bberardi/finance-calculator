import { createTheme } from '@mui/material/styles';

// Central MUI theme for PathWise.
//
// Goal (roadmap 0.6): codify the EXISTING look into a real theme — palette,
// typography, spacing, and component default props / styleOverrides — so the
// repeated ad-hoc `sx` styling across Body/tables/popouts is expressed once and
// every later phase consumes it. This is not a redesign; the visual result
// should match what shipped before, in both light and dark mode.
//
// Dark mode uses MUI 9's CSS-variables color-schemes API: `cssVariables` with a
// data-attribute selector lets `useColorScheme()` / InitColorSchemeScript flip
// `data-mui-color-scheme` on <html> without a flash or re-render of the tree.

// The PathWise brand greens (roadmap 0.7 rebrand): a fintech "money green"
// identity — deep forest/emerald foundations for brand surfaces (AppBar pill,
// header/footer gradient) and a vivid emerald primary for buttons/links/icons.
// `brandGreenDeep` -> `brandGreenRich` is the deep-to-brighter brand gradient;
// the emerald primaries live in each colorScheme below.
const brandGreenDeep = '#0b3d2e';
const brandGreenRich = '#14532d';

// Reusable header/footer gradient. Exported so Header/Footer can pull the brand
// gradient from the theme rather than hard-coding it in CSS. The same deep-green
// gradient also backs the AppBar pill (see MuiAppBar styleOverrides) so the
// command bar, header, and footer share one brand surface in both modes.
export const brandGradient = `linear-gradient(135deg, ${brandGreenDeep} 0%, ${brandGreenRich} 100%)`;
export const brandGradientReversed = `linear-gradient(135deg, ${brandGreenRich} 0%, ${brandGreenDeep} 100%)`;

// Spacing (roadmap 0.10): the page used a repeated `marginBottom: '20px'` on the
// section Papers and the sample-data alert. Express it once as theme spacing
// units (2.5 * 8px = 20px) so the gutter between the AppBar pill, the section
// Papers, and the page is consistent and tweakable in one place.
export const SECTION_GAP = 2.5;
// Padding inside the section Papers (was an ad-hoc `padding: '5px'`).
export const PAPER_PADDING = 1;

export const theme = createTheme({
  // Enable CSS theme variables (theme.vars) so color-scheme switching is a CSS
  // class/attribute swap, not a React re-render — no flash on toggle/reload.
  cssVariables: {
    colorSchemeSelector: 'data-mui-color-scheme',
  },
  colorSchemes: {
    light: {
      palette: {
        // Emerald "money green" primary — passes contrast as a button/link/icon
        // color on white surfaces; `dark` is the deep brand green for hovers.
        primary: { main: '#00875a', dark: brandGreenDeep },
        // Complementary teal-leaning green accent (no blue reintroduced).
        secondary: { main: '#0f766e' },
        background: {
          // Clean, faintly green-tinted light surface (was a pale blue-grey).
          default: '#eef5f1',
          paper: '#ffffff',
        },
      },
    },
    dark: {
      palette: {
        // Bright spring-green primary so dark mode reads "dark but bright green";
        // `dark` keeps the deep brand green for pressed/hover states.
        primary: { main: '#00e676', dark: brandGreenRich },
        secondary: { main: '#2dd4bf' },
        background: {
          // Very dark green-tinted background (not pure grey/black) + a slightly
          // lifted green-cast paper, so the whole app carries a money-green cast.
          default: '#0c1512',
          paper: '#13201a',
        },
      },
    },
  },
  shape: {
    borderRadius: 8,
  },
  typography: {
    fontFamily: 'Inter, system-ui, Avenir, Helvetica, Arial, sans-serif',
    h4: { fontWeight: 400 },
    h5: { fontWeight: 500 },
  },
  components: {
    // Pill AppBar used as the command bar in Body.
    MuiAppBar: {
      defaultProps: {
        position: 'static',
      },
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: 30,
          marginTop: theme.spacing(SECTION_GAP),
          marginBottom: theme.spacing(SECTION_GAP),
          overflow: 'hidden',
          // The pill is a brand surface, not the (now bright-emerald) primary:
          // back it with the deep-green brand gradient so the command bar shares
          // the Header/Footer identity in BOTH modes, with white content on top.
          // The `contained color="inherit"` Add buttons render as light/white
          // surfaces that contrast against this deep green in light and dark.
          backgroundImage: brandGradient,
          color: '#ffffff',
        }),
      },
    },
    // Command-bar Toolbar: lay the action buttons out with a consistent gap and
    // let them wrap cleanly on narrow viewports (roadmap 0.10) instead of
    // overflowing or squashing at ~360px. The dark-mode toggle is pushed to the
    // right within the same flow so the bar stays single-row when it fits.
    MuiToolbar: {
      styleOverrides: {
        root: {
          flexWrap: 'wrap',
          gap: 8,
          rowGap: 4,
        },
      },
    },
    // The two section Papers (Loans / Investments) in Body shared
    // `marginBottom: '20px', padding: '5px'`.
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    // Command-bar buttons previously each carried an ad-hoc `margin: '5px'`;
    // their spacing now comes from the Toolbar `gap` above (roadmap 0.10).
    // `disableElevation` flattens the contained buttons to match the flat look.
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          textTransform: 'none',
        },
      },
    },
    // Table action / popout icon buttons defaulted to the primary color.
    MuiIconButton: {
      defaultProps: {
        color: 'primary',
      },
    },
  },
});
