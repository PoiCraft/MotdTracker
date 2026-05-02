import { Box } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import FiberManualRecordRoundedIcon from "@mui/icons-material/FiberManualRecordRounded";

export default function M3StatusTag({
  online,
  size = "small",
  hideText = false,
}) {
  const theme = useTheme();
  const palette = theme.palette;

  const dotColor = online ? palette.success.main : palette.error.main;
  const bgColor = alpha(dotColor, 0.12);
  const textColor = online
    ? palette.success.dark || palette.success.main
    : palette.error.dark || palette.error.main;
  const isLarge = size === "large";

  return (
    <Box
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: hideText ? 0 : 0.5,
        px: hideText ? 0.5 : isLarge ? 1.5 : 1,
        py: hideText ? 0.25 : isLarge ? 0.5 : 0.2,
        borderRadius: 100,
        bgcolor: bgColor,
        color: textColor,
        fontSize: "0.75rem",
        fontWeight: 700,
        lineHeight: 1.4,
        letterSpacing: "0.02em",
        width: hideText ? "fit-content" : undefined,
      }}
    >
      <Box sx={{ position: "relative", display: "flex" }}>
        <FiberManualRecordRoundedIcon
          sx={{ fontSize: isLarge ? 10 : 8, color: dotColor }}
        />
        {online && (
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              bgcolor: dotColor,
              animation: "pulse-ring 2s ease-in-out infinite",
              "@keyframes pulse-ring": {
                "0%, 100%": { transform: "scale(1)", opacity: 1 },
                "50%": { transform: "scale(2.2)", opacity: 0 },
              },
            }}
          />
        )}
      </Box>
      {!hideText && (online ? "在线" : "离线")}
    </Box>
  );
}

export function StatusDot({ online, size = 8 }) {
  const theme = useTheme();
  const color = online
    ? theme.palette.success.main
    : theme.palette.error.main;

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
