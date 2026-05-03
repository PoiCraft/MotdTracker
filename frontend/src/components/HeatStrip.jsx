import React from "react";
import { Box, Stack } from "@mui/material";

export default function HeatStrip({ children, minWidth = { xs: 480, sm: "auto" }, spacing = 0.5, alignItems = "center", sx = {} }) {
  return (
    <Box sx={{ overflowX: "auto", overflowY: "hidden", WebkitOverflowScrolling: "touch" }}>
      <Stack direction="row" spacing={spacing} sx={{ minWidth, alignItems, ...sx }}>
        {children}
      </Stack>
    </Box>
  );
}
