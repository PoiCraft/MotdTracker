import { Card, CardContent, Stack, Typography, Box, alpha, useTheme } from "@mui/material";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import TrendingDownRoundedIcon from "@mui/icons-material/TrendingDownRounded";
import TrendingFlatRoundedIcon from "@mui/icons-material/TrendingFlatRounded";

/**
 * Material You 风格的指标卡片组件
 * 
 * @param {Object} props
 * @param {string} props.title - 指标标题
 * @param {string|number} props.value - 指标值
 * @param {string} props.hint - 提示文本
 * @param {string} props.trend - 趋势方向: 'up' | 'down' | 'flat'
 * @param {string} props.color - 颜色主题: 'primary' | 'success' | 'warning' | 'error'
 * @param {React.ReactNode} props.icon - 可选图标
 * @param {boolean} props.loading - 加载状态
 */
export default function MetricCard({
  title,
  value,
  hint,
  trend,
  color = "primary",
  icon,
  loading = false
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  // 获取颜色配置
  const getColorConfig = () => {
    const colors = {
      primary: {
        bg: isDark
          ? alpha(theme.palette.primary.main, 0.12)
          : alpha(theme.palette.primary.main, 0.08),
        text: isDark
          ? theme.palette.primary.light
          : theme.palette.primary.dark,
        iconBg: isDark
          ? alpha(theme.palette.primary.main, 0.18)
          : alpha(theme.palette.primary.main, 0.12)
      },
      success: {
        bg: isDark
          ? alpha(theme.palette.success.main, 0.12)
          : alpha(theme.palette.success.main, 0.08),
        text: isDark
          ? theme.palette.success.light
          : theme.palette.success.dark,
        iconBg: isDark
          ? alpha(theme.palette.success.main, 0.18)
          : alpha(theme.palette.success.main, 0.12)
      },
      warning: {
        bg: isDark
          ? alpha(theme.palette.warning.main, 0.12)
          : alpha(theme.palette.warning.main, 0.08),
        text: isDark
          ? theme.palette.warning.light
          : theme.palette.warning.dark,
        iconBg: isDark
          ? alpha(theme.palette.warning.main, 0.18)
          : alpha(theme.palette.warning.main, 0.12)
      },
      error: {
        bg: isDark
          ? alpha(theme.palette.error.main, 0.12)
          : alpha(theme.palette.error.main, 0.08),
        text: isDark
          ? theme.palette.error.light
          : theme.palette.error.dark,
        iconBg: isDark
          ? alpha(theme.palette.error.main, 0.18)
          : alpha(theme.palette.error.main, 0.12)
      }
    };
    return colors[color] || colors.primary;
  };

  const colorConfig = getColorConfig();

  // 趋势图标
  const getTrendIcon = () => {
    if (!trend) return null;
    const iconProps = { fontSize: "small" };
    switch (trend) {
      case "up":
        return <TrendingUpRoundedIcon {...iconProps} sx={{ color: "success.main" }} />;
      case "down":
        return <TrendingDownRoundedIcon {...iconProps} sx={{ color: "error.main" }} />;
      case "flat":
        return <TrendingFlatRoundedIcon {...iconProps} sx={{ color: "text.secondary" }} />;
      default:
        return null;
    }
  };

  return (
    <Card
      className="metric-card"
      elevation={0}
      sx={{
        height: "100%",
        position: "relative",
        overflow: "hidden",
        transition: theme.transitions.create([
          "transform",
          "box-shadow"
        ], {
          duration: theme.transitions.duration.short
        }),
        "&:hover": {
          transform: "translateY(-2px)"
        }
      }}
    >
      {/* 背景装饰 */}
      <Box
        sx={{
          position: "absolute",
          top: -30,
          right: -30,
          width: 100,
          height: 100,
          borderRadius: "50%",
          background: `linear-gradient(135deg, ${colorConfig.bg} 0%, transparent 70%)`,
          transition: theme.transitions.create("transform", {
            duration: theme.transitions.duration.medium
          })
        }}
      />

      <CardContent sx={{ p: 2.5, position: "relative", zIndex: 1 }}>
        <Stack spacing={1}>
          {/* 标题行 */}
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
          >
            <Typography
              variant="overline"
              sx={{
                fontSize: "0.6875rem",
                fontWeight: 500,
                letterSpacing: "0.5px",
                textTransform: "uppercase",
                color: "text.secondary",
                opacity: 0.8
              }}
            >
              {title}
            </Typography>

            {/* 图标或趋势指示 */}
            {icon && (
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: 2,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  bgcolor: colorConfig.iconBg,
                  color: colorConfig.text
                }}
              >
                {icon}
              </Box>
            )}
          </Stack>

          {/* 主要数值 */}
          <Box>
            {loading ? (
              <Box
                sx={{
                  width: 80,
                  height: 36,
                  borderRadius: 1.5,
                  bgcolor: isDark
                    ? alpha(theme.palette.surface?.on || "#fff", 0.08)
                    : alpha(theme.palette.primary.main, 0.06)
                }}
              />
            ) : (
              <Typography
                variant="h4"
                sx={{
                  fontWeight: 400,
                  fontSize: { xs: "1.75rem", sm: "2rem" },
                  lineHeight: 1.2,
                  letterSpacing: "-0.5px",
                  color: "text.primary",
                  fontFamily: '"Roboto Flex", sans-serif',
                  fontFeatureSettings: '"tnum"',
                  fontVariantNumeric: "tabular-nums"
                }}
              >
                {value}
              </Typography>
            )}
          </Box>

          {/* 提示与趋势 */}
          {(hint || trend) && (
            <Stack
              direction="row"
              alignItems="center"
              spacing={0.5}
            >
              {getTrendIcon()}
              {hint && (
                <Typography
                  variant="body2"
                  sx={{
                    fontSize: "0.8125rem",
                    color: "text.secondary",
                    opacity: 0.8
                  }}
                >
                  {hint}
                </Typography>
              )}
            </Stack>
          )}
        </Stack>
      </CardContent>

      {/* 底部状态条 */}
      <Box
        sx={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 3,
          bgcolor: colorConfig.bg,
          borderBottomLeftRadius: 16,
          borderBottomRightRadius: 16
        }}
      />
    </Card>
  );
}
