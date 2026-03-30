import { Card, CardContent, Typography } from "@mui/material";

export default function MetricCard({ title, value, hint }) {
  return (
    <Card className="metric-card" elevation={0}>
      <CardContent sx={{ p: "14px !important" }}>
        <Typography className="metric-title">{title}</Typography>
        <Typography className="metric-value">{value}</Typography>
        {hint ? <Typography className="metric-hint">{hint}</Typography> : null}
      </CardContent>
    </Card>
  );
}