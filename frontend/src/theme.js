import { alpha, createTheme } from "@mui/material/styles";

const lightPalette = {
  mode: "light",
  primary: { main: "#4b7f2a", light: "#cde6a3", dark: "#2f5a1e", contrastText: "#ffffff" },
  secondary: { main: "#7a5a3a", light: "#e4d5bf", dark: "#5a3f28", contrastText: "#ffffff" },
  tertiary: { main: "#6f7b69", light: "#d8dfd2", dark: "#515a4c", contrastText: "#ffffff" },
  success: { main: "#4f8a33" },
  warning: { main: "#b3842f" },
  error: { main: "#b3261e" },
  background: { default: "#e9eddc", paper: "#f4f1e6" },
  text: { primary: "#2b2a24", secondary: "#5a574a" },
  divider: "#bdb8a4"
};

const darkPalette = {
  mode: "dark",
  primary: { main: "#9ccf67", light: "#b8de8d", dark: "#79ab4f", contrastText: "#0f140d" },
  secondary: { main: "#c7a784", light: "#dcc1a3", dark: "#a18464", contrastText: "#1a1410" },
  tertiary: { main: "#a7b79a", light: "#bcc9b1", dark: "#899a7d", contrastText: "#131712" },
  success: { main: "#9fd96f" },
  warning: { main: "#deb56a" },
  error: { main: "#ff8f89" },
  background: { default: "#1a1d17", paper: "#242920" },
  text: { primary: "#edf2e5", secondary: "#bcc4b3" },
  divider: "#3c4337"
};

export function createAppTheme(mode = "light") {
  const palette = mode === "dark" ? darkPalette : lightPalette;
  const theme = createTheme({
    palette,
    shape: { borderRadius: 16 },
    typography: {
      fontFamily: ["Roboto Flex", "Noto Sans SC", "Segoe UI", "sans-serif"].join(","),
      h4: { fontWeight: 700, letterSpacing: "0.01em" },
      h5: { fontWeight: 700, letterSpacing: "0.01em" },
      h6: { fontWeight: 600 }
    },
    components: {
      MuiPaper: {
        styleOverrides: {
          root: ({ theme: t }) => ({
            border: `1px solid ${t.palette.divider}`
          })
        }
      },
      MuiCard: {
        styleOverrides: {
          root: ({ theme: t }) => ({
            border: `1px solid ${t.palette.divider}`,
            boxShadow: "none"
          })
        }
      },
      MuiChip: {
        styleOverrides: {
          root: {
            fontWeight: 600,
            borderRadius: 999
          }
        }
      },
      MuiButton: {
        defaultProps: {
          disableElevation: true
        },
        styleOverrides: {
          root: {
            borderRadius: 999,
            textTransform: "none",
            fontWeight: 600
          }
        }
      },
      MuiDrawer: {
        styleOverrides: {
          paper: ({ theme: t }) => ({
            backgroundImage: "none",
            backgroundColor: alpha(t.palette.background.paper, 0.96)
          })
        }
      }
    }
  });

  return createTheme(theme, {
    custom: {
      charts: {
        series: [
          theme.palette.primary.main,
          theme.palette.success.main,
          theme.palette.secondary.main,
          theme.palette.warning.main,
          theme.palette.tertiary.main,
          theme.palette.text.secondary
        ]
      }
    }
  });
}
