import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import { useParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  LinearProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { api, SOCKET_BASE } from "../api";
import { recreateChart, destroyChart } from "../utils/charts";
import { formatDuration, formatTime } from "../utils/format";

function build24hBlocks(heatmap) {
  const now = Date.now();
  const start = now - 24 * 3600 * 1000;
  const blocks = Array(24).fill(0);

  (heatmap || []).forEach((item) => {
    const ts = new Date(`${item.date}T${String(item.hour).padStart(2, "0")}:00:00`).getTime();
    if (ts >= start && ts <= now) {
      const offset = Math.floor((now - ts) / 3600000);
      if (offset >= 0 && offset < 24) {
        blocks[23 - offset] += Number(item.seconds || 0);
      }
    }
  });

  return blocks;
}

function weeklyCellColor(value, max, theme) {
  const x = max > 0 ? value / max : 0;
  if (x > 0.7) {
    return theme.palette.success.main;
  }
  if (x > 0.45) {
    return theme.palette.success.light;
  }
  if (x > 0.1) {
    return alpha(theme.palette.success.main, 0.28);
  }
  return theme.palette.action.hover;
}

export default function PlayerDetailPage() {
  const theme = useTheme();
  const { playerName } = useParams();
  const name = decodeURIComponent(playerName);

  const [summary, setSummary] = useState(null);
  const [sessions, setSessions] = useState(null);
  const [weekly, setWeekly] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const hourlyCanvas = useRef(null);
  const dailyCanvas = useRef(null);
  const weekdayCanvas = useRef(null);
  const hourlyChart = useRef(null);
  const dailyChart = useRef(null);
  const weekdayChart = useRef(null);

  const drawCharts = (sessionsData, weeklyData) => {
    const hourly = sessionsData?.hourly_average || [];
    const daily = [...(sessionsData?.daily || [])].sort((a, b) => a.date.localeCompare(b.date));
    const weekday = weeklyData?.weekday_preference || [];

    recreateChart(hourlyChart, hourlyCanvas.current, {
      type: "bar",
      data: {
        labels: hourly.map((h) => `${String(h.hour).padStart(2, "0")}:00`),
        datasets: [
          {
            label: "每小时平均在线(分钟)",
            data: hourly.map((h) => Number(h.avg_seconds || 0) / 60),
            backgroundColor: alpha(theme.palette.secondary.main, 0.62),
            borderColor: theme.palette.secondary.main,
            borderWidth: 1
          }
        ]
      },
      options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
    });

    recreateChart(dailyChart, dailyCanvas.current, {
      type: "bar",
      data: {
        labels: daily.map((d) => new Date(d.date).toLocaleDateString("zh-CN", { month: "short", day: "numeric" })),
        datasets: [
          {
            label: "每日在线时长(秒)",
            data: daily.map((d) => Number(d.total_seconds || 0)),
            backgroundColor: alpha(theme.palette.success.main, 0.62),
            borderColor: theme.palette.success.main,
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (ctx) => `在线时长: ${formatDuration(ctx.parsed.y || 0)}` } }
        }
      }
    });

    recreateChart(weekdayChart, weekdayCanvas.current, {
      type: "bar",
      data: {
        labels: weekday.map((w) => w.day_name),
        datasets: [
          {
            label: "星期偏好(秒)",
            data: weekday.map((w) => Number(w.avg_seconds || 0)),
            backgroundColor: alpha(theme.palette.primary.main, 0.62),
            borderColor: theme.palette.primary.main,
            borderWidth: 1
          }
        ]
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (ctx) => `平均在线: ${formatDuration(ctx.parsed.x || 0)}` } }
        }
      }
    });
  };

  const loadFull = async () => {
    setLoading(true);
    setError("");
    try {
      const [d1, d2, d3] = await Promise.all([
        api.player.detail(name),
        api.player.sessions(name, 30),
        api.player.weekly(name)
      ]);
      setSummary(d1);
      setSessions(d2);
      setWeekly(d3);
      drawCharts(d2, d3);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFull();
  }, [name]);

  useEffect(() => {
    const socket = io(SOCKET_BASE, { path: "/api/socket.io", transports: ["websocket"] });
    socket.on("poll_complete", async () => {
      try {
        const detail = await api.player.detail(name);
        setSummary(detail);
      } catch {
        // noop
      }
    });
    return () => {
      socket.disconnect();
      destroyChart(hourlyChart);
      destroyChart(dailyChart);
      destroyChart(weekdayChart);
    };
  }, [name]);

  const blocks24h = useMemo(() => build24hBlocks(sessions?.heatmap || []), [sessions]);
  const blocks24hMax = Math.max(...blocks24h, 1);

  const weeklyMap = useMemo(() => {
    const map = {};
    (weekly?.weekly_heatmap || []).forEach((item) => {
      if (!map[item.day]) {
        map[item.day] = {};
      }
      map[item.day][item.hour] = item.avg_seconds;
    });
    return map;
  }, [weekly]);

  const weeklyMax = useMemo(() => Math.max(...(weekly?.weekly_heatmap || []).map((i) => i.avg_seconds || 0), 1), [weekly]);

  const recentSessions = useMemo(() => {
    const rows = [];
    (sessions?.daily || []).forEach((d) => {
      (d.sessions || []).forEach((s) => {
        rows.push({ start: s.start, end: s.end, server_name: s.server_name || "默认" });
      });
    });
    return rows.sort((a, b) => new Date(b.start) - new Date(a.start)).slice(0, 20);
  }, [sessions]);

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", md: "center" }} spacing={1}>
        <Box>
          <Typography variant="h4">玩家详情</Typography>
          <Typography color="text.secondary">{name}</Typography>
        </Box>
        <Button variant="contained" onClick={loadFull}>刷新</Button>
      </Stack>

      {loading ? <LinearProgress /> : null}
      {error ? <Alert severity="error">{error}</Alert> : null}

      <Grid container spacing={1.5}>
        <Grid item xs={12} sm={6} md={3}>
          <Card><CardContent>
            <Typography variant="overline" color="text.secondary">当前状态</Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="h5">{summary?.online ? "在线" : "离线"}</Typography>
              <Chip size="small" color={summary?.online ? "success" : "default"} label={summary?.online ? "UP" : "DOWN"} />
            </Stack>
          </CardContent></Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card><CardContent>
            <Typography variant="overline" color="text.secondary">当前会话</Typography>
            <Typography variant="h5">{summary?.online ? formatDuration(summary.duration_seconds || 0) : "-"}</Typography>
          </CardContent></Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card><CardContent>
            <Typography variant="overline" color="text.secondary">最后在线</Typography>
            <Typography variant="body1">{formatTime(summary?.last_seen)}</Typography>
          </CardContent></Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card><CardContent>
            <Typography variant="overline" color="text.secondary">样本天数</Typography>
            <Typography variant="h5">{weekly?.total_sample_days ?? 0}</Typography>
          </CardContent></Card>
        </Grid>
      </Grid>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>过去 24h 活跃热力</Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(24, 1fr)", gap: 0.5 }}>
            {blocks24h.map((seconds, idx) => {
              const ratio = seconds / blocks24hMax;
              return (
                <Box
                  key={idx}
                  sx={{
                    height: 14,
                    borderRadius: 0.8,
                    border: "1px solid",
                    borderColor: "divider",
                    bgcolor: ratio > 0.7
                      ? "success.main"
                      : ratio > 0.4
                        ? "success.light"
                        : ratio > 0
                          ? alpha(theme.palette.success.main, 0.28)
                          : "action.hover"
                  }}
                />
              );
            })}
          </Box>
        </CardContent>
      </Card>

      <Grid container spacing={1.5}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>每小时平均在线</Typography>
              <Box sx={{ height: 260 }}><canvas ref={hourlyCanvas} /></Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>星期偏好</Typography>
              <Box sx={{ height: 260 }}><canvas ref={weekdayCanvas} /></Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>30 天在线趋势</Typography>
              <Box sx={{ height: 260 }}><canvas ref={dailyCanvas} /></Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>周活跃热力图</Typography>
          <Box sx={{ overflowX: "auto" }}>
            <Box sx={{ minWidth: 740, display: "grid", gridTemplateColumns: "100px repeat(24, 1fr)", gap: 0.35 }}>
              <Box />
              {Array.from({ length: 24 }).map((_, h) => <Typography key={h} variant="caption" color="text.secondary" align="center">{h}</Typography>)}
              {[
                { label: "周一", day: 0 },
                { label: "周二", day: 1 },
                { label: "周三", day: 2 },
                { label: "周四", day: 3 },
                { label: "周五", day: 4 },
                { label: "周六", day: 5 },
                { label: "周日", day: 6 }
              ].map((row) => (
                <Box key={row.day} sx={{ display: "contents" }}>
                  <Typography key={`${row.day}-label`} variant="body2" sx={{ lineHeight: "16px", display: "flex", alignItems: "center" }}>{row.label}</Typography>
                  {Array.from({ length: 24 }).map((_, hour) => (
                    <Box
                      key={`${row.day}-${hour}`}
                      sx={{
                        height: 16,
                        borderRadius: 0.7,
                        border: "1px solid",
                        borderColor: "divider",
                        bgcolor: weeklyCellColor(weeklyMap?.[row.day]?.[hour] || 0, weeklyMax, theme)
                      }}
                    />
                  ))}
                </Box>
              ))}
            </Box>
          </Box>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>最近会话（20 条）</Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>开始</TableCell>
                <TableCell>结束</TableCell>
                <TableCell>时长</TableCell>
                <TableCell>分组</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {recentSessions.map((s, idx) => {
                const start = new Date(s.start);
                const end = new Date(s.end);
                const seconds = Math.max(0, Math.floor((end - start) / 1000));
                return (
                  <TableRow key={`${s.start}-${idx}`}>
                    <TableCell>{formatTime(s.start)}</TableCell>
                    <TableCell>{formatTime(s.end)}</TableCell>
                    <TableCell>{formatDuration(seconds)}</TableCell>
                    <TableCell>{s.server_name}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </Stack>
  );
}
