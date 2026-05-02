import { Box } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import FiberManualRecordRoundedIcon from "@mui/icons-material/FiberManualRecordRounded";

export default function StatusPill({ online, size = "small" }) {
  const theme = useTheme();
  const md3 = theme.md3?.colors;
  const isDark = theme.md3?.isDark;
  const sm = size === "small";

  const bg = online
    ? isDark
      ? alpha(md3?.success || "#8ad492", 0.15)
      : md3?.successContainer || "#ceead6"
    : isDark
    ? alpha(md3?.error || "#f2b8b5", 0.15)
    : md3?.errorContainer || "#f9dedc";

  const fg = online
    ? isDark
      ? md3?.success || "#8ad492"
      : md3?.onSuccessContainer || "#0d3d1c"
    : isDark
    ? md3?.error || "#f2b8b5"
    : md3?.onErrorContainer || "#410e0b";

  const dot = online ? md3?.success : md3?.error;

  return (
    <Box
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.5,
        px: sm ? 1 : 1.5,
        py: sm ? 0.25 : 0.5,
        borderRadius: 99,
        bgcolor: bg,
        color: fg,
        fontSize: sm ? "0.6875rem" : "0.75rem",
        fontWeight: 500,
        lineHeight: 1.4,
        letterSpacing: "0.02em",
      }}
    >
      <Box sx={{ position: "relative", display: "flex" }}>
        <FiberManualRecordRoundedIcon
          sx={{ fontSize: sm ? 8 : 10, color: dot }}
        />
        {online && (
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              bgcolor: dot,
              animation: "pulse-ring 2s ease-in-out infinite",
              "@keyframes pulse-ring": {
                "0%, 100%": { transform: "scale(1)", opacity: 1 },
                "50%": { transform: "scale(2.2)", opacity: 0 },
              },
            }}
          />
        )}
      </Box>
      {online ? "在线" : "离线"}
    </Box>
  );
}

export function StatusDot({ online, size = 8 }) {
  const theme = useTheme();
  const md3 = theme.md3?.colors;

  const color = online ? md3?.success : md3?.error;

  return (
    <Box
      sx={{
        position: "relative",
        width: size,
        height: size,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <FiberManualRecordRoundedIcon sx={{ fontSize: size, color }} />
      {online && (
        <Box
          sx={{
            position: "absolute",
            width: size,
            height: size,
            borderRadius: "50%",
            bgcolor: color,
            animation: "pulse-ring 2s ease-in-out infinite",
            "@keyframes pulse-ring": {
              "0%, 100%": { transform: "scale(1)", opacity: 1 },
              "50%": { transform: "scale(2)", opacity: 0 },
            },
          }}
        />
      )}
    </Box>
  );
}
