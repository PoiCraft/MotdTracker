import { createTheme, responsiveFontSizes, alpha } from "@mui/material/styles";

const GEMINI_LIGHT = {
  background: "#F0F4F9",
  surface: "#FFFFFF",
  primary: "#1A73E8",
  onPrimary: "#FFFFFF",
  primaryContainer: "#D3E3FD",
  onPrimaryContainer: "#041E49",
  secondary: "#444746",
  onSecondary: "#FFFFFF",
  secondaryContainer: "#E8EAED",
  onSecondaryContainer: "#444746",
  error: "#B3261E",
  onError: "#FFFFFF",
  errorContainer: "#FDEDED",
  onErrorContainer: "#410E0B",
  success: "#188038",
  successContainer: "#E8F5E9",
  onSuccessContainer: "#0D3D1C",
  warning: "#B05D00",
  warningContainer: "#FEF7E0",
  onWarningContainer: "#3A1D00",
  onSurface: "#1F1F1F",
  onSurfaceVariant: "#444746",
  outline: "#747775",
  outlineVariant: "#C4C7C5",
  surfaceDim: "#D3DBE5",
  surfaceBright: "#FFFFFF",
  surfaceContainerLowest: "#FFFFFF",
  surfaceContainerLow: "#F0F4F9",
  surfaceContainer: "#E8ECF1",
  surfaceContainerHigh: "#DEE3EA",
  surfaceContainerHighest: "#D3DBE5",
  inverseSurface: "#313335",
  inverseOnSurface: "#F0F4F9",
  inversePrimary: "#A8C7FA",
  shadow: "#000000",
  scrim: "#000000",
};

const GEMINI_DARK = {
  background: "#1F1F1F",
  surface: "#282A2C",
  primary: "#A8C7FA",
  onPrimary: "#062E6F",
  primaryContainer: "#0842A0",
  onPrimaryContainer: "#D3E3FD",
  secondary: "#C4C7C5",
  onSecondary: "#2E3132",
  secondaryContainer: "#3F4344",
  onSecondaryContainer: "#E8EAED",
  error: "#F2B8B5",
  onError: "#601410",
  errorContainer: "#8C1D18",
  onErrorContainer: "#F9DEDC",
  success: "#81C995",
  successContainer: "#0F5324",
  onSuccessContainer: "#CEEAD6",
  warning: "#FDD663",
  warningContainer: "#7A3D00",
  onWarningContainer: "#FEF7E0",
  onSurface: "#E3E3E3",
  onSurfaceVariant: "#C4C7C5",
  outline: "#8E9099",
  outlineVariant: "#444746",
  surfaceDim: "#141617",
  surfaceBright: "#3A3C3E",
  surfaceContainerLowest: "#0F1113",
  surfaceContainerLow: "#1F1F1F",
  surfaceContainer: "#282A2C",
  surfaceContainerHigh: "#333537",
  surfaceContainerHighest: "#3A3C3E",
  inverseSurface: "#E3E3E3",
  inverseOnSurface: "#313335",
  inversePrimary: "#0B57D0",
  shadow: "#000000",
  scrim: "#000000",
};

function buildGeminiTheme(mode) {
  const c = mode === "dark" ? GEMINI_DARK : GEMINI_LIGHT;
  const isDark = mode === "dark";

  return createTheme({
    palette: {
      mode,
      primary: { main: c.primary, contrastText: c.onPrimary },
      secondary: { main: c.secondary, contrastText: c.onSecondary },
      error: { main: c.error, contrastText: c.onError },
      success: { main: c.success },
      warning: { main: c.warning },
      background: {
        default: c.background,
        paper: c.surface,
      },
      text: {
        primary: c.onSurface,
        secondary: c.onSurfaceVariant,
        disabled: alpha(c.onSurface, 0.38),
      },
      divider: c.outlineVariant,
      action: {
        hover: alpha(c.onSurface, 0.08),
        selected: alpha(c.onSurface, 0.12),
        disabled: alpha(c.onSurface, 0.12),
        disabledBackground: alpha(c.onSurface, 0.06),
        focus: alpha(c.onSurface, 0.12),
      },
    },
    shape: { borderRadius: 16 },
    typography: {
      fontFamily:
        '"Google Sans", "Roboto", "Helvetica", "Arial", "Noto Sans SC", sans-serif',
      h1: {
        fontSize: "2.25rem",
        fontWeight: 600,
        lineHeight: 1.22,
        letterSpacing: 0,
        color: c.onSurface,
      },
      h2: {
        fontSize: "2rem",
        fontWeight: 600,
        lineHeight: 1.25,
        letterSpacing: 0,
        color: c.onSurface,
      },
      h3: {
        fontSize: "1.75rem",
        fontWeight: 600,
        lineHeight: 1.29,
        color: c.onSurface,
      },
      h4: {
        fontSize: "1.5rem",
        fontWeight: 600,
        lineHeight: 1.33,
        color: c.onSurface,
      },
      h5: {
        fontSize: "1.375rem",
        fontWeight: 600,
        lineHeight: 1.27,
        color: c.onSurface,
      },
      h6: {
        fontSize: "1.125rem",
        fontWeight: 600,
        lineHeight: 1.33,
        letterSpacing: "0.01em",
        color: c.onSurface,
      },
      subtitle1: {
        fontSize: "1rem",
        fontWeight: 500,
        lineHeight: 1.5,
        letterSpacing: "0.006em",
        color: c.onSurface,
      },
      subtitle2: {
        fontSize: "0.875rem",
        fontWeight: 500,
        lineHeight: 1.43,
        letterSpacing: "0.006em",
        color: c.onSurfaceVariant,
      },
      body1: {
        fontSize: "0.875rem",
        fontWeight: 400,
        lineHeight: 1.43,
        letterSpacing: "0.01em",
        color: c.onSurface,
      },
      body2: {
        fontSize: "0.75rem",
        fontWeight: 400,
        lineHeight: 1.33,
        letterSpacing: "0.02em",
        color: c.onSurfaceVariant,
      },
      button: {
        fontSize: "0.875rem",
        fontWeight: 500,
        lineHeight: 1.43,
        letterSpacing: "0.01em",
        textTransform: "none",
      },
      caption: {
        fontSize: "0.6875rem",
        fontWeight: 500,
        lineHeight: 1.45,
        letterSpacing: "0.03em",
      },
      overline: {
        fontSize: "0.6875rem",
        fontWeight: 500,
        lineHeight: 1.45,
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
      // ─── CssBaseline ──────────────────────────────────────────────
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

      // ─── Paper (base for all surfaces) ────────────────────────────
      // Cards override this via MuiCard; Menu/Dialog override via their own Popover/Dialog props.
      MuiPaper: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            backgroundImage: "none",
          },
        },
      },

      // ─── Card — flat, 24px radius, no border ─────────────────────
      MuiCard: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            borderRadius: 24,
            border: "none",
            backgroundColor: c.surface,
            backgroundImage: "none",
          },
        },
      },
      MuiCardContent: {
        styleOverrides: {
          root: { padding: 24, "&:last-child": { paddingBottom: 24 } },
        },
      },

      // ─── Menu / Select Dropdown — M3 soft layer ──────────────────
      MuiMenu: {
        defaultProps: { elevation: 2 },
        styleOverrides: {
          paper: {
            borderRadius: 12,
            marginTop: 4,
            border: `1px solid ${alpha(c.outlineVariant, 0.5)}`,
            backgroundColor: c.surfaceContainerLowest,
            backgroundImage: "none",
            boxShadow: `0 1px 2px 0 ${alpha(c.shadow, 0.3)}, 0 2px 6px 2px ${alpha(c.shadow, 0.15)}`,
          },
          list: {
            paddingTop: 4,
            paddingBottom: 4,
          },
        },
      },
      MuiPopover: {
        styleOverrides: {
          paper: {
            borderRadius: 12,
            backgroundImage: "none",
          },
        },
      },
      MuiMenuItem: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            margin: "0 6px",
            minHeight: 48,
            fontSize: "0.875rem",
            padding: "8px 16px",
            "&:hover": {
              backgroundColor: alpha(c.onSurface, 0.08),
            },
            "&.Mui-selected": {
              backgroundColor: alpha(c.primary, 0.12),
              "&:hover": {
                backgroundColor: alpha(c.primary, 0.16),
              },
            },
          },
        },
      },

      // ─── Dialog — M3 giant rounded panel ─────────────────────────
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: 28,
            border: "none",
            backgroundImage: "none",
            backgroundColor: c.surfaceContainerLowest,
            boxShadow: `0 8px 12px 6px ${alpha(c.shadow, 0.15)}, 0 4px 4px 0 ${alpha(c.shadow, 0.3)}`,
          },
          paperWidthSm: {
            maxWidth: 560,
          },
        },
      },
      MuiDialogTitle: {
        styleOverrides: {
          root: {
            fontSize: "1.5rem",
            fontWeight: 400,
            lineHeight: "2rem",
            color: c.onSurface,
            padding: "24px 24px 0 24px",
          },
        },
      },
      MuiDialogContent: {
        styleOverrides: {
          root: {
            padding: "16px 24px",
            fontSize: "0.875rem",
            color: c.onSurfaceVariant,
            "&:first-of-type": { paddingTop: 16 },
          },
        },
      },
      MuiDialogActions: {
        styleOverrides: {
          root: {
            padding: 24,
            gap: 8,
            "& > :not(:first-of-type)": { marginLeft: 0 },
          },
        },
      },
      MuiBackdrop: {
        styleOverrides: {
          root: {
            backgroundColor: alpha(c.scrim, 0.4),
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
          },
        },
      },

      // ─── Drawer — transparent, 12px inset, no border ─────────────
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundImage: "none",
            borderRight: "none",
            backgroundColor: "transparent",
            paddingTop: 12,
            paddingLeft: 12,
            paddingRight: 12,
          },
        },
      },

      // ─── Navigation items — 100px capsule hover, transparent selected ─
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: 100,
            "&:hover": {
              backgroundColor: alpha(c.onSurface, 0.08),
            },
            "&.Mui-selected": {
              backgroundColor: "transparent",
              color: c.onPrimaryContainer,
              "&:hover": {
                backgroundColor: alpha(c.onSurface, 0.04),
              },
            },
          },
        },
      },

      // ─── Button — capsule, no uppercase ──────────────────────────
      MuiButton: {
        defaultProps: { disableElevation: true, variant: "contained" },
        styleOverrides: {
          root: {
            borderRadius: 100,
            textTransform: "none",
            padding: "10px 24px",
            minHeight: 40,
            fontWeight: 500,
          },
          contained: {
            backgroundColor: c.primary,
            color: c.onPrimary,
            "&:hover": {
              backgroundColor: isDark ? "#1a6be6" : "#1557B0",
            },
            "&.Mui-disabled": {
              backgroundColor: alpha(c.onSurface, 0.12),
              color: alpha(c.onSurface, 0.38),
            },
          },
          outlined: {
            borderColor: c.outlineVariant,
            color: c.primary,
            backgroundColor: "transparent",
            "&:hover": {
              backgroundColor: alpha(c.primary, 0.08),
              borderColor: c.primary,
            },
            "&.Mui-disabled": {
              borderColor: alpha(c.onSurface, 0.12),
              color: alpha(c.onSurface, 0.38),
            },
          },
          text: {
            color: c.primary,
            "&:hover": { backgroundColor: alpha(c.primary, 0.08) },
          },
        },
      },

      // ─── IconButton ──────────────────────────────────────────────
      MuiIconButton: {
        styleOverrides: {
          root: {
            borderRadius: 100,
            color: c.onSurfaceVariant,
            "&:hover": {
              backgroundColor: alpha(c.onSurface, 0.08),
              color: c.onSurface,
            },
          },
        },
      },

      // ─── Chip ────────────────────────────────────────────────────
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            fontWeight: 500,
            fontSize: "0.8125rem",
            height: 32,
          },
          outlined: {
            borderColor: c.outlineVariant,
            color: c.onSurface,
          },
          filled: {
            backgroundColor: c.secondaryContainer,
            color: c.onSecondaryContainer,
          },
          filledPrimary: {
            backgroundColor: c.primaryContainer,
            color: c.onPrimaryContainer,
          },
          filledSuccess: {
            backgroundColor: c.successContainer,
            color: c.onSuccessContainer,
          },
          filledWarning: {
            backgroundColor: c.warningContainer,
            color: c.onWarningContainer,
          },
          filledError: {
            backgroundColor: c.errorContainer,
            color: c.onErrorContainer,
          },
        },
      },

      // ─── Table — borderless, bold headers ────────────────────────
      MuiTableCell: {
        styleOverrides: {
          root: {
            borderBottom: "none",
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
          root: {
            "&:hover": {
              backgroundColor: alpha(c.onSurface, 0.04),
            },
            "&:last-child td": { borderBottom: 0 },
          },
        },
      },
      MuiTable: {
        styleOverrides: {
          root: { borderCollapse: "collapse" },
        },
      },

      // ─── Alert — tonal fill, no border ───────────────────────────
      MuiAlert: {
        styleOverrides: {
          root: {
            borderRadius: 16,
            border: "none",
            fontSize: "0.875rem",
          },
          standardError: {
            backgroundColor: c.errorContainer,
            color: c.onErrorContainer,
            "& .MuiAlert-icon": { color: c.error },
          },
          standardSuccess: {
            backgroundColor: c.successContainer,
            color: c.onSuccessContainer,
            "& .MuiAlert-icon": { color: c.success },
          },
          standardWarning: {
            backgroundColor: c.warningContainer,
            color: c.onWarningContainer,
            "& .MuiAlert-icon": { color: c.warning },
          },
          standardInfo: {
            backgroundColor: c.primaryContainer,
            color: c.onPrimaryContainer,
            "& .MuiAlert-icon": { color: c.primary },
          },
        },
      },

      // ─── Progress ────────────────────────────────────────────────
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

      // ─── Input / Select trigger ──────────────────────────────────
      MuiSelect: {
        styleOverrides: {
          root: { borderRadius: 12 },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            backgroundColor: c.surface,
            "& .MuiOutlinedInput-notchedOutline": {
              borderColor: c.outlineVariant,
            },
            "&:hover .MuiOutlinedInput-notchedOutline": {
              borderColor: c.onSurface,
            },
            "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
              borderColor: c.primary,
              borderWidth: 2,
            },
          },
        },
      },

      // ─── AppBar ──────────────────────────────────────────────────
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundImage: "none",
            backgroundColor: c.surface,
            color: c.onSurface,
            boxShadow: "none",
            borderBottom: "none",
          },
        },
      },

      // ─── Tooltip ─────────────────────────────────────────────────
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            backgroundColor: c.inverseSurface,
            color: c.inverseOnSurface,
            borderRadius: 8,
            fontSize: "0.75rem",
            padding: "6px 12px",
          },
        },
      },

      // ─── Divider ─────────────────────────────────────────────────
      MuiDivider: {
        styleOverrides: {
          root: { borderColor: c.outlineVariant },
        },
      },

      // ─── FAB ─────────────────────────────────────────────────────
      MuiFab: {
        styleOverrides: {
          root: { borderRadius: 16, textTransform: "none", fontWeight: 500 },
        },
      },

      // ─── Skeleton ────────────────────────────────────────────────
      MuiSkeleton: {
        styleOverrides: {
          root: { borderRadius: 8 },
        },
      },

      // ─── Snackbar ────────────────────────────────────────────────
      MuiSnackbarContent: {
        styleOverrides: {
          root: {
            backgroundColor: c.inverseSurface,
            color: c.inverseOnSurface,
            borderRadius: 12,
            fontSize: "0.875rem",
          },
        },
      },

      // ─── Tabs ────────────────────────────────────────────────────
      MuiTab: {
        styleOverrides: {
          root: {
            textTransform: "none",
            fontWeight: 500,
            minHeight: 48,
          },
        },
      },
    },
  });
}

export function createAppTheme(mode = "light") {
  const c = mode === "dark" ? GEMINI_DARK : GEMINI_LIGHT;
  const isDark = mode === "dark";
  const base = buildGeminiTheme(mode);

  const theme = createTheme(base, {
    gemini: {
      colors: c,
      isDark,
    },
    custom: {
      charts: {
        series: [
          c.primary,
          "#E37400",
          "#7B61FF",
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

  return responsiveFontSizes(theme, {
    breakpoints: ["xs", "sm", "md", "lg"],
    factor: 2,
  });
}
