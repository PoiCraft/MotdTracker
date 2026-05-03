import React from "react";
import { Box, Tooltip } from "@mui/material";

export default function HeatCell({
  color,
  title,
  height = 16,
  radius = 100,
  innerSx = {},
  ...rest
}) {
  const inner = (
    <Box sx={{ width: "100%", height, position: "relative" }}>
      <Box
        sx={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height,
          borderRadius: radius,
          bgcolor: color,
          cursor: "pointer",
          ...innerSx,
        }}
        {...rest}
      />
    </Box>
  );

  if (title) return <Tooltip title={title} arrow>{inner}</Tooltip>;
  return inner;
}
