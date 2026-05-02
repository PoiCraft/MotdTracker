import { createTheme, alpha } from "@mui/material/styles";

const MD3 = {
  light: {
    primary: "#0b57d0",
    onPrimary: "#ffffff",
    primaryContainer: "#d3e3fd",
    onPrimaryContainer: "#041e49",
    secondary: "#44474e",
    onSecondary: "#ffffff",
    secondaryContainer: "#e2e2e9",
    onSecondaryContainer: "#41444a",
    tertiary: "#75546f",
    onTertiary: "#ffffff",
    tertiaryContainer: "#ffd7f5",
    onTertiaryContainer: "#2c1229",
    error: "#b3261e",
    onError: "#ffffff",
    errorContainer: "#f9dedc",
    onErrorContainer: "#410e0b",
    surface: "#f8f9ff",
    onSurface: "#191c20",
    onSurfaceVariant: "#44474e",
    surfaceContainerLowest: "#ffffff",
    surfaceContainerLow: "#f2f3fa",
    surfaceContainer: "#ecedf4",
    surfaceContainerHigh: "#e6e8ef",
    surfaceContainerHighest: "#e1e2e9",
    outline: "#74777f",
    outlineVariant: "#c4c6cf",
    inverseSurface: "#2e3036",
    inverseOnSurface: "#eff0f7",
    inversePrimary: "#a8c7fa",
    scrim: "#000000",
    shadow: "#000000",
    success: "#137333",
    successContainer: "#ceead6",
    onSuccessContainer: "#0d3d1c",
    warning: "#b05d00",
    warningContainer: "#fde3c0",
    warningOnContainer: "#3a1d00",
  },
  dark: {
    primary: "#a8c7fa",
    onPrimary: "#062e6f",
    primaryContainer: "#0842a0",
    onPrimaryContainer: "#d3e3fd",
    secondary: "#c6c6cd",
    onSecondary: "#2c2f35",
    secondaryContainer: "#41444a",
    onSecondaryContainer: "#e2e2e9",
    tertiary: "#e3bdda",
    onTertiary: "#432741",
    tertiaryContainer: "#5b3d57",
    onTertiaryContainer: "#ffd7f5",
    error: "#f2b8b5",
    onError: "#601410",
    errorContainer: "#8c1d18",
    onErrorContainer: "#f9dedc",
    surface: "#111318",
    onSurface: "#c5c6d0",
    onSurfaceVariant: "#c4c6cf",
    surfaceContainerLowest: "#0c0e13",
    surfaceContainerLow: "#191c20",
    surfaceContainer: "#1d2024",
    surfaceContainerHigh: "#282a2f",
    surfaceContainerHighest: "#33353a",
    outline: "#8e9099",
    outlineVariant: "#44474e",
    inverseSurface: "#e1e2e9",
    inverseOnSurface: "#2e3036",
    inversePrimary: "#0b57d0",
    scrim: "#000000",
    shadow: "#000000",
    success: "#8ad492",
    successContainer: "#0f5324",
    onSuccessContainer: "#ceead6",
    warning: "#f5c27a",
    warningContainer: "#7a3d00",
    warningOnContainer: "#fde3c0",
  },
};

function buildTheme(mode) {
  const c = mode === "dark" ? MD3.dark : MD3.light;
  const isDark = mode === "dark";

  const base = createTheme({
    palette: {
      mode,
      primary: { main: c.primary, contrastText: c.onPrimary },
      secondary: { main: c.secondary, contrastText: c.onSecondary },
      error: { main: c.error, contrastText: c.onError },
      success: { main: c.success },
      warning: { main: c.warning },
      background: {
        default: c.surface,
        paper: c.surfaceContainerLowest,
      },
      text: {
        primary: c.onSurface,
        secondary: c.onSurfaceVariant,
        disabled: c.outline,
      },
      divider: c.outlineVariant,
      action: {
        hover: alpha(c.primary, 0.08),
        selected: alpha(c.primary, 0.12),
        disabled: alpha(c.onSurface, 0.12),
        disabledBackground: alpha(c.onSurface, 0.06),
        focus: alpha(c.primary, 0.12),
      },
    },
    shape: { borderRadius: 12 },
    typography: {
      fontFamily:
        '"Google Sans", "Google Sans Text", "Roboto", "Noto Sans SC", system-ui, sans-serif',
      h1: {
        fontSize: "2.25rem",
        fontWeight: 400,
        lineHeight: "2.75rem",
        letterSpacing: 0,
      },
      h2: {
        fontSize: "2rem",
        fontWeight: 400,
        lineHeight: "2.5rem",
        letterSpacing: 0,
      },
      h3: {
        fontSize: "1.75rem",
        fontWeight: 400,
        lineHeight: "2.25rem",
      },
      h4: {
        fontSize: "1.5rem",
        fontWeight: 400,
        lineHeight: "2rem",
      },
      h5: {
        fontSize: "1.375rem",
        fontWeight: 400,
        lineHeight: "1.75rem",
      },
      h6: {
        fontSize: "1.125rem",
        fontWeight: 500,
        lineHeight: "1.5rem",
        letterSpacing: "0.01em",
      },
      subtitle1: {
        fontSize: "1rem",
        fontWeight: 500,
        lineHeight: "1.5rem",
        letterSpacing: "0.006em",
      },
      subtitle2: {
        fontSize: "0.875rem",
        fontWeight: 500,
        lineHeight: "1.25rem",
        letterSpacing: "0.006em",
      },
      body1: {
        fontSize: "0.875rem",
        fontWeight: 400,
        lineHeight: "1.25rem",
        letterSpacing: "0.01em",
      },
      body2: {
        fontSize: "0.75rem",
        fontWeight: 400,
        lineHeight: "1rem",
        letterSpacing: "0.02em",
      },
      button: {
        fontSize: "0.875rem",
        fontWeight: 500,
        lineHeight: "1.25rem",
        letterSpacing: "0.01em",
        textTransform: "none",
      },
      caption: {
        fontSize: "0.6875rem",
        fontWeight: 500,
        lineHeight: "1rem",
        letterSpacing: "0.03em",
      },
      overline: {
        fontSize: "0.6875rem",
        fontWeight: 500,
        lineHeight: "1rem",
        letterSpacing: "0.08em",
        textTransform: "uppercase",
      },
    },
    shadows: [
      "none",
      `0 1px 2px 0 ${alpha(c.shadow, 0.3)}, 0 1px 3px 1px ${alpha(c.shadow, 0.15)}`,
      `0 1px 2px 0 ${alpha(c.shadow, 0.3)}, 0 2px 6px 2px ${alpha(c.shadow, 0.15)}`,
      `0 4px 8px 3px ${alpha(c.shadow, 0.15)}, 0 1px 3px 0 ${alpha(c.shadow, 0.3)}`,
      `0 6px 10px 4px ${alpha(c.shadow, 0.15)}, 0 2px 3px 0 ${alpha(c.shadow, 0.3)}`,
      `0 8px 12px 6px ${alpha(c.shadow, 0.15)}, 0 4px 4px 0 ${alpha(c.shadow, 0.3)}`,
      ...Array(19).fill(
        `0 8px 12px 6px ${alpha(c.shadow, 0.15)}, 0 4px 4px 0 ${alpha(c.shadow, 0.3)}`
      ),
    ],
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            scrollbarColor: `${c.outlineVariant} transparent`,
            "&::-webkit-scrollbar-thumb": {
              backgroundColor: c.outlineVariant,
              borderRadius: 99,
            },
            "&::-webkit-scrollbar": { width: 8, height: 8 },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: { backgroundImage: "none" },
        },
      },
      MuiCard: {
        defaultProps: { variant: "outlined" },
        styleOverrides: {
          root: ({ theme: t }) => ({
            borderRadius: 12,
            borderColor: c.outlineVariant,
            backgroundColor: c.surfaceContainerLowest,
            backgroundImage: "none",
            transition: t.transitions.create(
              ["box-shadow", "border-color", "background-color"],
              { duration: t.transitions.duration.short }
            ),
            "&:hover": {
              boxShadow: t.shadows[1],
            },
          }),
        },
      },
      MuiCardContent: {
        styleOverrides: {
          root: { padding: 16, "&:last-child": { paddingBottom: 16 } },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true, variant: "contained" },
        styleOverrides: {
          root: ({ theme: t }) => ({
            borderRadius: 20,
            padding: "10px 24px",
            minHeight: 40,
            fontWeight: 500,
            transition: t.transitions.create(
              ["background-color", "box-shadow", "color"],
              { duration: 200 }
            ),
          }),
          contained: ({ theme: t }) => ({
            backgroundColor: c.primary,
            color: c.onPrimary,
            "&:hover": {
              backgroundColor: isDark ? "#1a6be6" : "#064dc4",
              boxShadow: t.shadows[1],
            },
            "&:active": { boxShadow: "none" },
            "&.Mui-disabled": {
              backgroundColor: alpha(c.onSurface, 0.12),
              color: alpha(c.onSurface, 0.38),
            },
          }),
          outlined: ({ theme: t }) => ({
            borderColor: c.outline,
            color: c.primary,
            backgroundColor: "transparent",
            "&:hover": {
              backgroundColor: alpha(c.primary, 0.08),
              borderColor: c.primary,
            },
            "&:active": {
              backgroundColor: alpha(c.primary, 0.12),
            },
            "&.Mui-disabled": {
              borderColor: alpha(c.onSurface, 0.12),
              color: alpha(c.onSurface, 0.38),
            },
          }),
          text: ({ theme: t }) => ({
            color: c.primary,
            "&:hover": { backgroundColor: alpha(c.primary, 0.08) },
            "&:active": { backgroundColor: alpha(c.primary, 0.12) },
          }),
          containedSecondary: ({ theme: t }) => ({
            backgroundColor: c.secondaryContainer,
            color: c.onSecondaryContainer,
            "&:hover": {
              backgroundColor: isDark
                ? "#4d5057"
                : "#c8c8cf",
            },
          }),
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: ({ theme: t }) => ({
            borderRadius: 20,
            color: c.onSurfaceVariant,
            transition: t.transitions.create(
              ["background-color", "color"],
              { duration: 200 }
            ),
            "&:hover": {
              backgroundColor: alpha(c.onSurface, 0.08),
              color: c.onSurface,
            },
            "&:active": {
              backgroundColor: alpha(c.onSurface, 0.12),
            },
          }),
        },
      },
      MuiChip: {
        styleOverrides: {
          root: ({ theme: t }) => ({
            borderRadius: 8,
            fontWeight: 500,
            fontSize: "0.8125rem",
            height: 32,
            transition: t.transitions.create(
              ["background-color", "border-color"],
              { duration: 200 }
            ),
          }),
          outlined: {
            borderColor: c.outlineVariant,
            color: c.onSurface,
            "&:hover": {
              backgroundColor: alpha(c.onSurface, 0.08),
            },
          },
          filled: ({ theme: t }) => ({
            backgroundColor: c.secondaryContainer,
            color: c.onSecondaryContainer,
            "&:hover": {
              backgroundColor: isDark
                ? alpha(c.secondary, 0.2)
                : "#d0d0d7",
            },
          }),
          filledPrimary: ({ theme: t }) => ({
            backgroundColor: c.primaryContainer,
            color: c.onPrimaryContainer,
            "&:hover": {
              backgroundColor: isDark
                ? alpha(c.primary, 0.28)
                : "#b8d3fa",
            },
          }),
          filledSuccess: {
            backgroundColor: c.successContainer,
            color: c.onSuccessContainer,
          },
          filledWarning: {
            backgroundColor: c.warningContainer,
            color: c.warningOnContainer,
          },
          filledError: {
            backgroundColor: c.errorContainer,
            color: c.onErrorContainer,
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            borderBottom: `1px solid ${c.outlineVariant}`,
            padding: "12px 16px",
            fontSize: "0.875rem",
          },
          head: {
            fontWeight: 500,
            fontSize: "0.75rem",
            letterSpacing: "0.03em",
            color: c.onSurfaceVariant,
            textTransform: "none",
          },
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: ({ theme: t }) => ({
            "&:hover": {
              backgroundColor: alpha(c.onSurface, 0.04),
            },
            "&:last-child td": { borderBottom: 0 },
          }),
        },
      },
      MuiTable: {
        styleOverrides: {
          root: { borderCollapse: "collapse" },
        },
      },
      MuiAlert: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            border: "1px solid",
            fontSize: "0.875rem",
          },
          standardError: {
            backgroundColor: c.errorContainer,
            color: c.onErrorContainer,
            borderColor: alpha(c.error, isDark ? 0.5 : 0.3),
            "& .MuiAlert-icon": { color: c.error },
          },
          standardSuccess: {
            backgroundColor: c.successContainer,
            color: c.onSuccessContainer,
            borderColor: alpha(c.success, isDark ? 0.5 : 0.3),
            "& .MuiAlert-icon": { color: c.success },
          },
          standardWarning: {
            backgroundColor: c.warningContainer,
            color: c.warningOnContainer,
            borderColor: alpha(c.warning, isDark ? 0.5 : 0.3),
            "& .MuiAlert-icon": { color: c.warning },
          },
          standardInfo: {
            backgroundColor: c.primaryContainer,
            color: c.onPrimaryContainer,
            borderColor: alpha(c.primary, isDark ? 0.5 : 0.3),
            "& .MuiAlert-icon": { color: c.primary },
          },
        },
      },
      MuiLinearProgress: {
        styleOverrides: {
          root: {
            borderRadius: 99,
            height: 4,
            backgroundColor: c.surfaceContainerHighest,
          },
          bar: { borderRadius: 99 },
        },
      },
      MuiSelect: {
        styleOverrides: {
          root: { borderRadius: 12 },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: ({ theme: t }) => ({
            borderRadius: 12,
            "& .MuiOutlinedInput-notchedOutline": {
              borderColor: c.outline,
            },
            "&:hover .MuiOutlinedInput-notchedOutline": {
              borderColor: c.onSurface,
            },
            "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
              borderColor: c.primary,
              borderWidth: 2,
            },
          }),
        },
      },
      MuiMenuItem: {
        styleOverrides: {
          root: {
            borderRadius: 0,
            fontSize: "0.875rem",
            minHeight: 40,
            "&:hover": { backgroundColor: alpha(c.onSurface, 0.08) },
            "&.Mui-selected": {
              backgroundColor: alpha(c.primary, 0.12),
              "&:hover": { backgroundColor: alpha(c.primary, 0.16) },
            },
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundImage: "none",
            borderRight: `1px solid ${c.outlineVariant}`,
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundImage: "none",
            backgroundColor: c.surfaceContainer,
            color: c.onSurface,
            boxShadow: "none",
            borderBottom: `1px solid ${c.outlineVariant}`,
          },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            backgroundColor: c.inverseSurface,
            color: c.inverseOnSurface,
            borderRadius: 4,
            fontSize: "0.75rem",
            padding: "6px 12px",
          },
        },
      },
      MuiDivider: {
        styleOverrides: {
          root: { borderColor: c.outlineVariant },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: ({ theme: t }) => ({
            borderRadius: 28,
            transition: t.transitions.create(
              ["background-color", "color"],
              { duration: 200 }
            ),
            "&:hover": { backgroundColor: alpha(c.onSurface, 0.08) },
            "&.active, &.Mui-selected": {
              backgroundColor: c.secondaryContainer,
              color: c.onSurface,
              "&:hover": {
                backgroundColor: isDark
                  ? alpha(c.secondary, 0.2)
                  : "#d0d0d7",
              },
            },
          }),
        },
      },
      MuiFab: {
        styleOverrides: {
          root: { borderRadius: 16, textTransform: "none", fontWeight: 500 },
        },
      },
      MuiSkeleton: {
        styleOverrides: {
          root: { borderRadius: 8 },
        },
      },
      MuiSnackbarContent: {
        styleOverrides: {
          root: {
            backgroundColor: c.inverseSurface,
            color: c.inverseOnSurface,
            borderRadius: 4,
            fontSize: "0.875rem",
          },
        },
      },
    },
  });

  return createTheme(base, {
    md3: {
      colors: c,
      isDark,
    },
    custom: {
      charts: {
        series: [
          c.primary,
          c.secondary,
          c.tertiary,
          c.error,
          c.success,
          c.warning,
        ],
        grid: isDark
          ? alpha(c.onSurface, 0.06)
          : alpha(c.onSurface, 0.06),
      },
    },
  });
}

export function createAppTheme(mode = "light") {
  return buildTheme(mode);
}
