import { alpha, createTheme, lighten, darken } from "@mui/material/styles";

/**
 * Material You (Material Design 3) 主题配置
 * 
 * 设计原则:
 * 1. 动态色彩系统 - 使用 Tonal Palette 和颜色调和
 * 2. 圆角设计 - 更大的圆角半径 (8dp, 12dp, 16dp, 28dp)
 * 3. 表面色调 - 背景色带有主色调的微妙影响
 * 4. 状态层 - 交互状态使用透明度叠加
 * 5. 强调容器 - 使用 Container 颜色变体
 */

// Material You 核心调色板
const seedColor = {
  primary: "#4b7f2a",
  secondary: "#7a5a3a",
  tertiary: "#6f7b69",
  error: "#b3261e",
  neutral: "#79747e",
  neutralVariant: "#79747e"
};

// Material You Light Theme
const lightPalette = {
  mode: "light",
  // Primary 色彩系统
  primary: {
    main: "#4b7f2a",
    light: "#c8e6a3",
    dark: "#365e1e",
    contrastText: "#ffffff"
  },
  // Primary Container - 用于填充容器
  primaryContainer: {
    main: "#c8e6a3",
    on: "#1a3d0a"
  },
  // Secondary 色彩系统
  secondary: {
    main: "#7a5a3a",
    light: "#e4d5bf",
    dark: "#5a3f28",
    contrastText: "#ffffff"
  },
  secondaryContainer: {
    main: "#e4d5bf",
    on: "#2d1f13"
  },
  // Tertiary 色彩系统
  tertiary: {
    main: "#6f7b69",
    light: "#d8dfd2",
    dark: "#515a4c",
    contrastText: "#ffffff"
  },
  tertiaryContainer: {
    main: "#d8dfd2",
    on: "#252b22"
  },
  // Error 色彩系统
  error: {
    main: "#b3261e",
    light: "#f2b8b5",
    dark: "#8c1d18",
    contrastText: "#ffffff"
  },
  errorContainer: {
    main: "#f9dedc",
    on: "#410e0b"
  },
  // Success 色彩系统
  success: {
    main: "#4f8a33",
    light: "#c8f0b3",
    dark: "#3a6626"
  },
  successContainer: {
    main: "#c8f0b3",
    on: "#0f2906"
  },
  // Warning 色彩系统
  warning: {
    main: "#b3842f",
    light: "#fce4b0",
    dark: "#8a6422"
  },
  warningContainer: {
    main: "#fce4b0",
    on: "#2a1d08"
  },
  // 背景与表面
  background: {
    default: "#f5f7f0", // 带有绿色调的浅色背景
    paper: "#fdfdfb"    // 接近白色的卡片背景
  },
  // 表面变体 - Material You 的核心
  surface: {
    main: "#fdfdfb",
    variant: "#e5e2db",
    on: "#1c1b1a",
    onVariant: "#454843"
  },
  // 文字颜色
  text: {
    primary: "#1a1c17",
    secondary: "#43493d",
    disabled: "#a8aba3"
  },
  // 分割线与边框
  divider: "#d4d7cf",
  outline: {
    main: "#74776e",
    variant: "#c4c7be"
  },
  // 反色表面 (用于顶部应用栏等)
  inverseSurface: {
    main: "#2d3128",
    on: "#eff1ea"
  },
  // 阴影与叠加层
  scrim: "#000000",
  // 状态层透明度 - Material You 核心交互状态
  state: {
    hoverOpacity: 0.08,
    focusOpacity: 0.12,
    pressOpacity: 0.12,
    dragOpacity: 0.16
  }
};

// Material You Dark Theme
const darkPalette = {
  mode: "dark",
  // Primary 色彩系统
  primary: {
    main: "#9ccf67",
    light: "#b8de8d",
    dark: "#79ab4f",
    contrastText: "#0f140d"
  },
  primaryContainer: {
    main: "#365e1e",
    on: "#c8e6a3"
  },
  // Secondary 色彩系统
  secondary: {
    main: "#c7a784",
    light: "#dcc1a3",
    dark: "#a18464",
    contrastText: "#1a1410"
  },
  secondaryContainer: {
    main: "#5a3f28",
    on: "#e4d5bf"
  },
  // Tertiary 色彩系统
  tertiary: {
    main: "#a7b79a",
    light: "#bcc9b1",
    dark: "#899a7d",
    contrastText: "#131712"
  },
  tertiaryContainer: {
    main: "#515a4c",
    on: "#d8dfd2"
  },
  // Error 色彩系统
  error: {
    main: "#f2b8b5",
    light: "#ffd9d8",
    dark: "#cf8f8d",
    contrastText: "#410e0b"
  },
  errorContainer: {
    main: "#8c1d18",
    on: "#f9dedc"
  },
  // Success 色彩系统
  success: {
    main: "#8eda6d",
    light: "#aef090",
    dark: "#6ab850"
  },
  successContainer: {
    main: "#286412",
    on: "#c8f0b3"
  },
  // Warning 色彩系统
  warning: {
    main: "#f0c070",
    light: "#ffd99a",
    dark: "#d4a040"
  },
  warningContainer: {
    main: "#5a4010",
    on: "#fce4b0"
  },
  // 背景与表面
  background: {
    default: "#171d14", // 深绿色调背景
    paper: "#1f261b"    // 略亮的卡片背景
  },
  // 表面变体
  surface: {
    main: "#1f261b",
    variant: "#3a4236",
    on: "#e3e6dd",
    onVariant: "#b3b8ac"
  },
  // 文字颜色
  text: {
    primary: "#e3e6dd",
    secondary: "#b3b8ac",
    disabled: "#4f534a"
  },
  // 分割线与边框
  divider: "#3a4236",
  outline: {
    main: "#91988a",
    variant: "#454843"
  },
  // 反色表面
  inverseSurface: {
    main: "#e5e2db",
    on: "#1c1b1a"
  },
  // 阴影与叠加层
  scrim: "#000000",
  // 状态层透明度
  state: {
    hoverOpacity: 0.08,
    focusOpacity: 0.12,
    pressOpacity: 0.12,
    dragOpacity: 0.16
  }
};

/**
 * 创建 Material You 风格的主题
 */
export function createAppTheme(mode = "light") {
  const palette = mode === "dark" ? darkPalette : lightPalette;
  const isDark = mode === "dark";
  
  const theme = createTheme({
    palette,
    // Material You 形状系统 - 大圆角设计
    shape: {
      borderRadius: 16,
      borderRadiusSm: 8,
      borderRadiusMd: 12,
      borderRadiusLg: 16,
      borderRadiusXl: 28
    },
    // 排版系统
    typography: {
      // 使用 Google 的 Roboto Flex 变量字体
      fontFamily: [
        '"Roboto Flex"',
        '"Noto Sans SC"',
        '"Segoe UI"',
        "system-ui",
        "sans-serif"
      ].join(","),
      // 标题样式 - Material Display/Headline 风格
      h1: {
        fontSize: "3.5625rem",  // 57px
        fontWeight: 400,
        lineHeight: 1.12,
        letterSpacing: "-0.25px"
      },
      h2: {
        fontSize: "2.8125rem",  // 45px
        fontWeight: 400,
        lineHeight: 1.16,
        letterSpacing: 0
      },
      h3: {
        fontSize: "2.25rem",    // 36px
        fontWeight: 400,
        lineHeight: 1.22,
        letterSpacing: 0
      },
      h4: {
        fontSize: "2rem",       // 32px
        fontWeight: 500,
        lineHeight: 1.25,
        letterSpacing: 0
      },
      h5: {
        fontSize: "1.5rem",     // 24px
        fontWeight: 500,
        lineHeight: 1.33,
        letterSpacing: 0
      },
      h6: {
        fontSize: "1.25rem",    // 20px - Title Large
        fontWeight: 500,
        lineHeight: 1.4,
        letterSpacing: "0.15px"
      },
      // 副标题样式
      subtitle1: {
        fontSize: "1rem",       // 16px - Body Large
        fontWeight: 500,
        lineHeight: 1.5,
        letterSpacing: "0.5px"
      },
      subtitle2: {
        fontSize: "0.875rem",   // 14px - Body Medium
        fontWeight: 500,
        lineHeight: 1.43,
        letterSpacing: "0.25px"
      },
      // 正文样式
      body1: {
        fontSize: "1rem",       // 16px - Body Large
        fontWeight: 400,
        lineHeight: 1.5,
        letterSpacing: "0.5px"
      },
      body2: {
        fontSize: "0.875rem",   // 14px - Body Medium
        fontWeight: 400,
        lineHeight: 1.43,
        letterSpacing: "0.25px"
      },
      // 标签样式
      button: {
        fontSize: "0.875rem",   // 14px - Label Large
        fontWeight: 500,
        lineHeight: 1.43,
        letterSpacing: "0.1px",
        textTransform: "none"
      },
      caption: {
        fontSize: "0.75rem",    // 12px - Body Small
        fontWeight: 400,
        lineHeight: 1.33,
        letterSpacing: "0.4px"
      },
      overline: {
        fontSize: "0.6875rem",  // 11px - Label Small
        fontWeight: 500,
        lineHeight: 1.45,
        letterSpacing: "0.5px",
        textTransform: "uppercase"
      }
    },
    // 阴影系统 - Material You 使用更柔和的阴影
    shadows: [
      "none",
      "0px 1px 3px 1px rgba(0, 0, 0, 0.15), 0px 1px 2px rgba(0, 0, 0, 0.3)",
      "0px 2px 6px 2px rgba(0, 0, 0, 0.15), 0px 1px 2px rgba(0, 0, 0, 0.3)",
      "0px 4px 8px 3px rgba(0, 0, 0, 0.15), 0px 1px 3px rgba(0, 0, 0, 0.3)",
      "0px 6px 10px 4px rgba(0, 0, 0, 0.15), 0px 2px 3px rgba(0, 0, 0, 0.3)",
      "0px 8px 12px 6px rgba(0, 0, 0, 0.15), 0px 4px 4px rgba(0, 0, 0, 0.3)",
      ...Array(19).fill("0px 8px 12px 6px rgba(0, 0, 0, 0.15), 0px 4px 4px rgba(0, 0, 0, 0.3)")
    ],
    // 组件样式覆盖
    components: {
      // Paper 组件 - 表面基础
      MuiPaper: {
        styleOverrides: {
          root: ({ theme: t }) => ({
            // Material You 表面色调
            backgroundImage: "none",
            border: `1px solid ${t.palette.divider}`,
            transition: t.transitions.create(["box-shadow", "border-color"], {
              duration: t.transitions.duration.short
            })
          }),
          rounded: {
            borderRadius: 16
          }
        }
      },
      // Card 组件
      MuiCard: {
        styleOverrides: {
          root: ({ theme: t }) => ({
            border: `1px solid ${t.palette.divider}`,
            boxShadow: "none",
            transition: t.transitions.create([
              "box-shadow",
              "border-color",
              "transform"
            ], {
              duration: t.transitions.duration.short
            }),
            "&:hover": {
              boxShadow: t.shadows[2],
              borderColor: isDark 
                ? alpha(t.palette.primary.main, 0.4)
                : alpha(t.palette.primary.main, 0.25)
            }
          })
        }
      },
      MuiCardContent: {
        styleOverrides: {
          root: {
            padding: 16,
            "&:last-child": {
              paddingBottom: 16
            }
          }
        }
      },
      // Chip 组件 - Material You 状态标签
      MuiChip: {
        styleOverrides: {
          root: ({ theme: t }) => ({
            fontWeight: 500,
            borderRadius: 8, // Material You small shape
            fontSize: "0.8125rem",
            height: 32,
            transition: t.transitions.create(["background-color", "box-shadow"], {
              duration: t.transitions.duration.short
            })
          }),
          colorPrimary: ({ theme: t }) => ({
            backgroundColor: isDark 
              ? alpha(t.palette.primary.main, 0.18)
              : t.palette.primaryContainer.main,
            color: isDark 
              ? t.palette.primary.light
              : t.palette.primaryContainer.on,
            "&:hover": {
              backgroundColor: isDark
                ? alpha(t.palette.primary.main, 0.24)
                : darken(t.palette.primaryContainer.main, 0.08)
            }
          }),
          colorSuccess: ({ theme: t }) => ({
            backgroundColor: isDark
              ? alpha(t.palette.success.main, 0.18)
              : t.palette.successContainer.main,
            color: isDark
              ? t.palette.success.light
              : t.palette.successContainer.on
          }),
          colorError: ({ theme: t }) => ({
            backgroundColor: isDark
              ? alpha(t.palette.error.main, 0.18)
              : t.palette.errorContainer.main,
            color: isDark
              ? t.palette.error.light
              : t.palette.errorContainer.on
          }),
          colorWarning: ({ theme: t }) => ({
            backgroundColor: isDark
              ? alpha(t.palette.warning.main, 0.18)
              : t.palette.warningContainer.main,
            color: isDark
              ? t.palette.warning.light
              : t.palette.warningContainer.on
          }),
          outlined: ({ theme: t }) => ({
            borderColor: t.palette.outline.main
          })
        }
      },
      // Button 组件 - Material You 按钮样式
      MuiButton: {
        defaultProps: {
          disableElevation: true
        },
        styleOverrides: {
          root: ({ theme: t }) => ({
            borderRadius: 20, // Material You full radius
            textTransform: "none",
            fontWeight: 500,
            padding: "10px 24px",
            minHeight: 40,
            transition: t.transitions.create([
              "background-color",
              "box-shadow",
              "transform"
            ], {
              duration: t.transitions.duration.short
            }),
            "&:active": {
              transform: "scale(0.98)"
            }
          }),
          contained: ({ theme: t }) => ({
            boxShadow: "none",
            "&:hover": {
              boxShadow: t.shadows[1]
            }
          }),
          containedPrimary: ({ theme: t }) => ({
            backgroundColor: t.palette.primary.main,
            color: t.palette.primary.contrastText,
            "&:hover": {
              backgroundColor: isDark
                ? t.palette.primary.dark
                : darken(t.palette.primary.main, 0.08)
            }
          }),
          outlined: ({ theme: t }) => ({
            borderColor: t.palette.outline.main,
            "&:hover": {
              backgroundColor: isDark
                ? alpha(t.palette.surface.on, 0.08)
                : alpha(t.palette.primary.main, 0.08),
              borderColor: t.palette.primary.main
            }
          }),
          text: ({ theme: t }) => ({
            "&:hover": {
              backgroundColor: isDark
                ? alpha(t.palette.surface.on, 0.08)
                : alpha(t.palette.primary.main, 0.08)
            }
          })
        }
      },
      // IconButton 组件
      MuiIconButton: {
        styleOverrides: {
          root: ({ theme: t }) => ({
            borderRadius: 20,
            transition: t.transitions.create(["background-color", "transform"], {
              duration: t.transitions.duration.short
            }),
            "&:hover": {
              backgroundColor: isDark
                ? alpha(t.palette.surface.on, 0.08)
                : alpha(t.palette.primary.main, 0.08)
            },
            "&:active": {
              transform: "scale(0.95)"
            }
          })
        }
      },
      // FAB 组件
      MuiFab: {
        styleOverrides: {
          root: ({ theme: t }) => ({
            borderRadius: 16,
            boxShadow: t.shadows[3],
            textTransform: "none",
            fontWeight: 500,
            "&:hover": {
              boxShadow: t.shadows[4]
            },
            "&:active": {
              transform: "scale(0.98)"
            }
          })
        }
      },
      // Drawer 组件
      MuiDrawer: {
        styleOverrides: {
          paper: ({ theme: t }) => ({
            backgroundImage: "none",
            backgroundColor: isDark
              ? alpha(t.palette.background.paper, 0.95)
              : alpha(t.palette.background.paper, 0.98),
            borderRight: `1px solid ${t.palette.divider}`,
            backdropFilter: "blur(10px)"
          })
        }
      },
      // AppBar 组件
      MuiAppBar: {
        styleOverrides: {
          root: ({ theme: t }) => ({
            backgroundImage: "none",
            backgroundColor: isDark
              ? alpha(t.palette.background.paper, 0.92)
              : alpha(t.palette.background.paper, 0.85),
            backdropFilter: "blur(12px)",
            borderBottom: `1px solid ${t.palette.divider}`
          })
        }
      },
      // Toolbar 组件
      MuiToolbar: {
        styleOverrides: {
          root: {
            minHeight: 64,
            "@media (min-width: 600px)": {
              minHeight: 64
            }
          }
        }
      },
      // ListItem 组件
      MuiListItemButton: {
        styleOverrides: {
          root: ({ theme: t }) => ({
            borderRadius: 28, // Material You Navigation Drawer item
            margin: "2px 12px",
            transition: t.transitions.create(["background-color", "color"], {
              duration: t.transitions.duration.short
            }),
            "&.active": {
              backgroundColor: isDark
                ? alpha(t.palette.primary.main, 0.18)
                : t.palette.primaryContainer.main,
              color: isDark
                ? t.palette.primary.light
                : t.palette.primaryContainer.on,
              "&:hover": {
                backgroundColor: isDark
                  ? alpha(t.palette.primary.main, 0.24)
                  : darken(t.palette.primaryContainer.main, 0.08)
              }
            },
            "&:hover": {
              backgroundColor: isDark
                ? alpha(t.palette.surface.on, 0.08)
                : alpha(t.palette.primary.main, 0.08)
            }
          })
        }
      },
      // TextField 组件
      MuiTextField: {
        styleOverrides: {
          root: ({ theme: t }) => ({
            "& .MuiOutlinedInput-root": {
              borderRadius: 12,
              transition: t.transitions.create(["border-color", "box-shadow"], {
                duration: t.transitions.duration.short
              }),
              "&:hover": {
                "& .MuiOutlinedInput-notchedOutline": {
                  borderColor: t.palette.outline.main
                }
              },
              "&.Mui-focused": {
                "& .MuiOutlinedInput-notchedOutline": {
                  borderWidth: 2,
                  borderColor: t.palette.primary.main
                }
              }
            }
          })
        }
      },
      // Select 组件
      MuiSelect: {
        styleOverrides: {
          root: ({ theme: t }) => ({
            borderRadius: 12
          })
        }
      },
      // MenuItem 组件
      MuiMenuItem: {
        styleOverrides: {
          root: ({ theme: t }) => ({
            borderRadius: 8,
            margin: "2px 8px",
            transition: t.transitions.create("background-color", {
              duration: t.transitions.duration.short
            }),
            "&:hover": {
              backgroundColor: isDark
                ? alpha(t.palette.surface.on, 0.08)
                : alpha(t.palette.primary.main, 0.08)
            }
          })
        }
      },
      // Table 组件
      MuiTable: {
        styleOverrides: {
          root: ({ theme: t }) => ({
            borderCollapse: "separate",
            borderSpacing: "0 4px"
          })
        }
      },
      MuiTableRow: {
        styleOverrides: {
          root: ({ theme: t }) => ({
            transition: t.transitions.create("background-color", {
              duration: t.transitions.duration.short
            }),
            "&:hover": {
              backgroundColor: isDark
                ? alpha(t.palette.surface.on, 0.04)
                : alpha(t.palette.primary.main, 0.04)
            }
          })
        }
      },
      MuiTableCell: {
        styleOverrides: {
          root: ({ theme: t }) => ({
            borderBottom: "none",
            padding: "12px 16px"
          }),
          head: ({ theme: t }) => ({
            fontWeight: 500,
            color: t.palette.text.secondary,
            fontSize: "0.75rem",
            textTransform: "uppercase",
            letterSpacing: "0.5px"
          })
        }
      },
      // Alert 组件
      MuiAlert: {
        styleOverrides: {
          root: ({ theme: t }) => ({
            borderRadius: 16,
            border: `1px solid`
          }),
          standardSuccess: ({ theme: t }) => ({
            backgroundColor: isDark
              ? alpha(t.palette.success.main, 0.12)
              : t.palette.successContainer.main,
            color: isDark
              ? t.palette.success.light
              : t.palette.successContainer.on,
            borderColor: isDark
              ? alpha(t.palette.success.main, 0.3)
              : alpha(t.palette.success.main, 0.2)
          }),
          standardError: ({ theme: t }) => ({
            backgroundColor: isDark
              ? alpha(t.palette.error.main, 0.12)
              : t.palette.errorContainer.main,
            color: isDark
              ? t.palette.error.light
              : t.palette.errorContainer.on,
            borderColor: isDark
              ? alpha(t.palette.error.main, 0.3)
              : alpha(t.palette.error.main, 0.2)
          }),
          standardWarning: ({ theme: t }) => ({
            backgroundColor: isDark
              ? alpha(t.palette.warning.main, 0.12)
              : t.palette.warningContainer.main,
            color: isDark
              ? t.palette.warning.light
              : t.palette.warningContainer.on,
            borderColor: isDark
              ? alpha(t.palette.warning.main, 0.3)
              : alpha(t.palette.warning.main, 0.2)
          }),
          standardInfo: ({ theme: t }) => ({
            backgroundColor: isDark
              ? alpha(t.palette.primary.main, 0.12)
              : t.palette.primaryContainer.main,
            color: isDark
              ? t.palette.primary.light
              : t.palette.primaryContainer.on,
            borderColor: isDark
              ? alpha(t.palette.primary.main, 0.3)
              : alpha(t.palette.primary.main, 0.2)
          })
        }
      },
      // LinearProgress 组件
      MuiLinearProgress: {
        styleOverrides: {
          root: ({ theme: t }) => ({
            borderRadius: 4,
            height: 4,
            overflow: "hidden"
          })
        }
      },
      // Skeleton 组件
      MuiSkeleton: {
        styleOverrides: {
          root: ({ theme: t }) => ({
            borderRadius: 12
          })
        }
      },
      // Tooltip 组件
      MuiTooltip: {
        styleOverrides: {
          tooltip: ({ theme: t }) => ({
            backgroundColor: isDark
              ? t.palette.inverseSurface.main
              : t.palette.surface.on,
            color: isDark
              ? t.palette.inverseSurface.on
              : t.palette.background.paper,
            borderRadius: 8,
            fontSize: "0.75rem",
            padding: "8px 12px"
          })
        }
      },
      // Divider 组件
      MuiDivider: {
        styleOverrides: {
          root: ({ theme: t }) => ({
            borderColor: t.palette.divider
          })
        }
      }
    }
  });

  // 扩展主题 - 添加自定义属性
  return createTheme(theme, {
    // 自定义图表配色
    custom: {
      charts: {
        series: [
          theme.palette.primary.main,
          theme.palette.success.main,
          theme.palette.secondary.main,
          theme.palette.warning.main,
          theme.palette.tertiary.main,
          theme.palette.text.secondary
        ],
        grid: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"
      },
      // 热力图配色
      heatmap: {
        high: isDark ? theme.palette.success.dark : theme.palette.success.main,
        mid: isDark ? theme.palette.warning.dark : theme.palette.warning.main,
        low: isDark ? theme.palette.error.dark : theme.palette.error.main,
        none: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)"
      },
      // 状态颜色
      status: {
        online: theme.palette.success.main,
        offline: theme.palette.error.main,
        pending: theme.palette.warning.main
      }
    }
  });
}
