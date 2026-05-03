import { Children } from "react";
import { Grid } from "@mui/material";

const DEFAULT_ITEM_SIZE = { xs: 12, sm: 6, lg: 3 };

export default function MetricGrid({
  children,
  spacing = 3,
  itemSize = DEFAULT_ITEM_SIZE,
}) {
  return (
    <Grid container spacing={spacing}>
      {Children.map(children, (child, index) => (
        <Grid key={index} size={itemSize}>
          {child}
        </Grid>
      ))}
    </Grid>
  );
}
