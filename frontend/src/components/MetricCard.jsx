import { Box, Card, CardContent, Stack, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import TrendingDownRoundedIcon from "@mui/icons-material/TrendingDownRounded";
import TrendingFlatRoundedIcon from "@mui/icons-material/TrendingFlatRounded";

export default function MetricCard({
  title,
  value,
  hint,
  trend,
  color = "primary",
  icon,
}) {
  const theme = useTheme();
  const md3 = theme.md3?.colors;
  const isDark = theme.md3?.isDark;

  const palette = {
    primary: {
      container: md3?.primaryContainer,
      onContainer: md3?.onPrimaryContainer,
    },
    success: {
      container: md3?.successContainer,
      onContainer: md3?.onSuccessContainer,
    },
    warning: {
      container: md3?.warningContainer,
      onContainer: md3?.warningOnContainer,
    },
    error: {
      container: md3?.errorContainer,
      onContainer: md3?.onErrorContainer,
    },
  };

  const c = palette[color] || palette.primary;

  const TrendIcon = {
    up: TrendingUpRoundedIcon,
    down: TrendingDownRoundedIcon,
    flat: TrendingFlatRoundedIcon,
  }[trend];

  return (
    <Card
      variant="outlined"
      sx={{
        height: "100%",
        borderColor: md3?.outlineVariant,
        backgroundColor: md3?.surfaceContainerLow,
        transition: "box-shadow 200ms cubic-bezier(0.2, 0, 0, 1)",
        "&:hover": { boxShadow: theme.shadows[1] },
      }}
    >
      <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
        <Stack spacing={1.5}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography
              variant="caption"
              sx={{
                color: md3?.onSurfaceVariant,
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
                  bgcolor: c.container,
                  color: c.onContainer,
                  "& svg": { fontSize: 16 },
                }}
              >
                {icon}
              </Box>
            )}
          </Stack>

          <Typography
            variant="h5"
            sx={{
              fontWeight: 500,
              fontFeatureSettings: '"tnum"',
              fontVariantNumeric: "tabular-nums",
              color: md3?.onSurface,
              lineHeight: 1.2,
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
                        ? md3?.success
                        : trend === "down"
                        ? md3?.error
                        : md3?.outline,
                  }}
                />
              )}
              {hint && (
                <Typography
                  variant="body2"
                  sx={{
                    fontSize: "0.75rem",
                    color: md3?.onSurfaceVariant,
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
