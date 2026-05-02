import { Box, Card, CardContent, Stack, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import TrendingDownRoundedIcon from "@mui/icons-material/TrendingDownRounded";
import TrendingFlatRoundedIcon from "@mui/icons-material/TrendingFlatRounded";
import M3StatusTag from "./M3StatusTag";

export default function MetricCard({
  title,
  value,
  hint,
  trend,
  color = "primary",
  icon,
  status,
}) {
  const theme = useTheme();
  const c = theme.gemini?.colors;
  const isDark = theme.gemini?.isDark;

  const palette = {
    primary: {
      container: c?.primaryContainer,
      onContainer: c?.onPrimaryContainer,
    },
    success: {
      container: c?.successContainer,
      onContainer: c?.onSuccessContainer,
    },
    warning: {
      container: c?.warningContainer,
      onContainer: c?.onWarningContainer,
    },
    error: {
      container: c?.errorContainer,
      onContainer: c?.onErrorContainer,
    },
  };

  const p = palette[color] || palette.primary;

  const TrendIcon = {
    up: TrendingUpRoundedIcon,
    down: TrendingDownRoundedIcon,
    flat: TrendingFlatRoundedIcon,
  }[trend];

  return (
    <Card
      elevation={0}
      sx={{
        height: "100%",
        position: "relative",
        backgroundColor: color === "success"
          ? c?.successContainer
          : color === "error"
          ? c?.errorContainer
          : c?.surface,
      }}
    >
      {status !== undefined && (
        <Box sx={{ position: "absolute", top: 16, right: 16, zIndex: 1 }}>
          <M3StatusTag online={status} size="small" />
        </Box>
      )}
      <CardContent sx={{ p: 3, "&:last-child": { pb: 3 } }}>
        <Stack spacing={2}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography
              variant="body2"
              sx={{
                color: c?.onSurfaceVariant,
                fontSize: "0.6875rem",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                fontWeight: 500,
              }}
            >
              {title}
            </Typography>
            {icon && (
              <Box
                sx={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  bgcolor: color === "success" || color === "error"
                    ? alpha(p.onContainer, 0.12)
                    : p.container,
                  color: p.onContainer,
                  "& svg": { fontSize: 16 },
                }}
              >
                {icon}
              </Box>
            )}
          </Stack>

          <Typography
            variant="h4"
            sx={{
              fontWeight: 600,
              fontFeatureSettings: '"tnum"',
              fontVariantNumeric: "tabular-nums",
              color: c?.onSurface,
              lineHeight: 1.2,
              fontSize: { xs: "1.375rem", sm: "1.5rem" },
            }}
          >
            {value}
          </Typography>

          {(hint || TrendIcon) && (
            <Stack direction="row" alignItems="center" spacing={0.5}>
              {TrendIcon && (
                <TrendIcon
                  sx={{
                    fontSize: 14,
                    color:
                      trend === "up"
                        ? c?.success
                        : trend === "down"
                        ? c?.error
                        : c?.outline,
                  }}
                />
              )}
              {hint && (
                <Typography
                  variant="body2"
                  sx={{
                    fontSize: "0.75rem",
                    color: c?.onSurfaceVariant,
                    lineHeight: 1.3,
                  }}
                >
                  {hint}
                </Typography>
              )}
            </Stack>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
