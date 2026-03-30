import { Chip, Box, alpha, useTheme } from "@mui/material";
import CircleRoundedIcon from "@mui/icons-material/CircleRounded";

/**
 * Material You 风格的状态标签组件
 * 
 * @param {Object} props
 * @param {boolean} props.online - 是否在线
 * @param {string} props.size - 尺寸: 'small' | 'medium'
 * @param {boolean} props.showPulse - 是否显示脉冲动画
 * @param {string} props.label - 自定义标签文字
 */
export default function StatusPill({
  online,
  size = "small",
  showPulse = true,
  label
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  // 状态配置
  const statusConfig = online
    ? {
        label: label || "在线",
        bgColor: isDark
          ? alpha(theme.palette.success.main, 0.18)
          : alpha(theme.palette.success.main, 0.12),
        textColor: isDark
          ? theme.palette.success.light
          : theme.palette.success.dark,
        dotColor: theme.palette.success.main,
        hoverBg: isDark
          ? alpha(theme.palette.success.main, 0.24)
          : alpha(theme.palette.success.main, 0.18)
      }
    : {
        label: label || "离线",
        bgColor: isDark
          ? alpha(theme.palette.error.main, 0.18)
          : alpha(theme.palette.error.main, 0.12),
        textColor: isDark
          ? theme.palette.error.light
          : theme.palette.error.dark,
        dotColor: theme.palette.error.main,
        hoverBg: isDark
          ? alpha(theme.palette.error.main, 0.24)
          : alpha(theme.palette.error.main, 0.18)
      };

  return (
    <Box
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.75,
        px: size === "small" ? 1.25 : 1.75,
        py: size === "small" ? 0.5 : 0.75,
        borderRadius: 10,
        bgcolor: statusConfig.bgColor,
        color: statusConfig.textColor,
        transition: theme.transitions.create("background-color", {
          duration: theme.transitions.duration.short
        }),
        "&:hover": {
          bgcolor: statusConfig.hoverBg
        }
      }}
    >
      {/* 状态指示点 */}
      <Box
        sx={{
          position: "relative",
          width: 8,
          height: 8,
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        <CircleRoundedIcon
          sx={{
            fontSize: 8,
            color: statusConfig.dotColor
          }}
        />
        
        {/* 在线状态脉冲动画 */}
        {online && showPulse && (
          <Box
            sx={{
              position: "absolute",
              width: 8,
              height: 8,
              borderRadius: "50%",
              bgcolor: statusConfig.dotColor,
              animation: "status-pulse 2s ease-in-out infinite",
              "@keyframes status-pulse": {
                "0%, 100%": {
                  transform: "scale(1)",
                  opacity: 1
                },
                "50%": {
                  transform: "scale(1.8)",
                  opacity: 0
                }
              }
            }}
          />
        )}
      </Box>

      {/* 状态文字 */}
      <Box
        component="span"
        sx={{
          fontSize: size === "small" ? "0.75rem" : "0.8125rem",
          fontWeight: 500,
          letterSpacing: "0.1px",
          lineHeight: 1.2
        }}
      >
        {statusConfig.label}
      </Box>
    </Box>
  );
}

/**
 * 紧凑型状态指示器变体
 */
export function StatusDot({ online, size = 8 }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  const color = online
    ? isDark
      ? theme.palette.success.light
      : theme.palette.success.main
    : isDark
      ? theme.palette.error.light
      : theme.palette.error.main;

  return (
    <Box
      sx={{
        position: "relative",
        width: size,
        height: size,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center"
      }}
    >
      <CircleRoundedIcon
        sx={{
          fontSize: size,
          color
        }}
      />
      {online && (
        <Box
          sx={{
            position: "absolute",
            width: size,
            height: size,
            borderRadius: "50%",
            bgcolor: color,
            animation: "status-pulse 2s ease-in-out infinite",
            "@keyframes status-pulse": {
              "0%, 100%": {
                transform: "scale(1)",
                opacity: 1
              },
              "50%": {
                transform: "scale(1.8)",
                opacity: 0
              }
            }
          }}
        />
      )}
    </Box>
  );
}

/**
 * 详细状态标签变体
 */
export function StatusLabel({ online, lastSeen, duration }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 0.5
      }}
    >
      <StatusPill online={online} size="small" showPulse={online} />
      {!online && lastSeen && (
        <Box
          component="span"
          sx={{
            fontSize: "0.6875rem",
            color: "text.secondary",
            opacity: 0.8
          }}
        >
          最后在线: {lastSeen}
        </Box>
      )}
      {online && duration && (
        <Box
          component="span"
          sx={{
            fontSize: "0.6875rem",
            color: "text.secondary",
            opacity: 0.8
          }}
        >
          在线时长: {duration}
        </Box>
      )}
    </Box>
  );
}
