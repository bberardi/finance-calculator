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

// The PathWise brand blues — taken from the original header/footer gradients
// (#1e3c72 -> #2a5298) and the MUI default primary the AppBar already used.
const brandBlueDark = '#1e3c72';
const brandBlueMid = '#2a5298';

// Reusable header/footer gradient. Exported so Header/Footer can pull the brand
// gradient from the theme rather than hard-coding it in CSS.
export const brandGradient = `linear-gradient(135deg, ${brandBlueDark} 0%, ${brandBlueMid} 100%)`;
export const brandGradientReversed = `linear-gradient(135deg, ${brandBlueMid} 0%, ${brandBlueDark} 100%)`;

export const theme = createTheme({
  // Enable CSS theme variables (theme.vars) so color-scheme switching is a CSS
  // class/attribute swap, not a React re-render — no flash on toggle/reload.
  cssVariables: {
    colorSchemeSelector: 'data-mui-color-scheme',
  },
  colorSchemes: {
    light: {
      palette: {
        primary: { main: brandBlueMid, dark: brandBlueDark },
        secondary: { main: '#9c27b0' },
        background: {
          // The body previously sat on a pale blue-grey gradient; flatten it to
          // a solid surface that reads the same but themes cleanly.
          default: '#eef1f6',
          paper: '#ffffff',
        },
      },
    },
    dark: {
      palette: {
        primary: { main: '#5b8def', dark: brandBlueMid },
        secondary: { main: '#ce93d8' },
        background: {
          default: '#121417',
          paper: '#1c2128',
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
        root: {
          borderRadius: 30,
          marginTop: 15,
          marginBottom: 15,
          overflow: 'hidden',
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
    // Command-bar buttons all carried `margin: '5px'`. Keep that as the default
    // so Body/DataManager stop repeating it; `disableElevation` flattens the
    // contained save buttons to match the previous flat look.
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
