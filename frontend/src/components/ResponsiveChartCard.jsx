import { Box, Card, CardContent } from "@mui/material";

export default function ResponsiveChartCard({
  title,
  sectionTitle,
  height = { xs: 200, md: 280 },
  children,
  elevation = 0,
  cardSx,
  contentSx,
}) {
  return (
    <Card elevation={elevation} sx={{ minWidth: 0, ...cardSx }}>
      <CardContent
        sx={{
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          ...contentSx,
        }}
      >
        {sectionTitle || title}
        <Box
          sx={{
            width: "100%",
            height,
            minWidth: 0,
            overflow: "hidden",
          }}
        >
          {children}
        </Box>
      </CardContent>
    </Card>
  );
}
