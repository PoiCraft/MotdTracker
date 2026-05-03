import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Alert, Box, Button, Card, CardContent, Chip, LinearProgress,
  Stack, Table, TableBody, TableCell, TableHead, TableRow,
  Tooltip, Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import AccessTimeRoundedIcon from "@mui/icons-material/AccessTimeRounded";
import ScheduleRoundedIcon from "@mui/icons-material/ScheduleRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import MetricCard from "../components/MetricCard";
import { api } from "../api";
import { useWsEvent } from "../utils/ws";
import HeatCell from "../components/HeatCell";
import HeatStrip from "../components/HeatStrip";
import { recreateChart, destroyChart } from "../utils/charts";
import { formatDuration, formatTime } from "../utils/format";

function build24hBlocks(heatmap) {
  const now = Date.now();
  const start = now - 86400000;
  const blocks = Array(24).fill(0);
  (heatmap || []).forEach((item) => {
    const ts = new Date(`${item.date}T${String(item.hour).padStart(2, "0")}:00:00`).getTime();
    if (ts >= start && ts <= now) {
      const off = Math.floor((now - ts) / 3600000);
      if (off >= 0 && off < 24) blocks[23 - off] += Number(item.seconds || 0);
    }
  });
  return blocks;
}

function SectionTitle({ children }) {
  return <Typography variant="subtitle1" sx={{ fontWeight: 500, mb: 2 }}>{children}</Typography>;
}

export default function PlayerDetailPage() {
  const theme = useTheme();
  const c = theme.gemini?.colors;
  const isDark = theme.gemini?.isDark;
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

  const drawCharts = (sess, week) => {
    const hourly = sess?.hourly_average || [];
    const daily = [...(sess?.daily || [])].sort((a, b) => a.date.localeCompare(b.date));
    const weekday = week?.weekday_preference || [];
    const grid = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";
    const legendLabels = {
      usePointStyle: true, pointStyle: "circle", padding: 16,
      font: { family: theme.typography.fontFamily, size: 11 },
      color: c?.onSurfaceVariant,
    };

    recreateChart(hourlyChart, hourlyCanvas.current, {
      type: "bar",
      data: {
        labels: hourly.map((h) => `${String(h.hour).padStart(2, "0")}:00`),
        datasets: [{
          label: "每小时平均(分钟)", data: hourly.map((h) => Number(h.avg_seconds || 0) / 60),
          backgroundColor: alpha("#E37400", 0.7),
          borderColor: "#E37400", borderWidth: 1, borderRadius: 4,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: true, position: "top", labels: legendLabels } },
        scales: { x: { grid: { display: false } }, y: { beginAtZero: true, grid: { color: grid } } },
      },
    });

    recreateChart(dailyChart, dailyCanvas.current, {
      type: "bar",
      data: {
        labels: daily.map((d) => new Date(d.date).toLocaleDateString("zh-CN", { month: "short", day: "numeric" })),
        datasets: [{
          label: "每日在线", data: daily.map((d) => Number(d.total_seconds || 0)),
          backgroundColor: alpha(c?.primary || "#1A73E8", 0.7),
          borderColor: c?.primary, borderWidth: 1, borderRadius: 4,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: true, position: "top", labels: legendLabels },
          tooltip: { callbacks: { label: (ctx) => `在线: ${formatDuration(ctx.parsed.y || 0)}` } },
        },
        scales: { x: { grid: { display: false } }, y: { beginAtZero: true, grid: { color: grid } } },
      },
    });

    recreateChart(weekdayChart, weekdayCanvas.current, {
      type: "bar",
      data: {
        labels: weekday.map((w) => w.day_name),
        datasets: [{
          label: "星期偏好", data: weekday.map((w) => Number(w.avg_seconds || 0)),
          backgroundColor: alpha("#7B61FF", 0.7),
          borderColor: "#7B61FF", borderWidth: 1, borderRadius: 4,
        }],
      },
      options: {
        indexAxis: "y", responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: true, position: "top", labels: legendLabels },
          tooltip: { callbacks: { label: (ctx) => `平均: ${formatDuration(ctx.parsed.x || 0)}` } },
        },
        scales: { x: { beginAtZero: true, grid: { color: grid } }, y: { grid: { display: false } } },
      },
    });
  };

  const loadFull = async () => {
    setLoading(true); setError("");
    try {
      const [d1, d2, d3] = await Promise.all([
        api.player.detail(name), api.player.sessions(name, 30), api.player.weekly(name),
      ]);
      setSummary(d1); setSessions(d2); setWeekly(d3);
      drawCharts(d2, d3);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadFull(); }, [name]);

  useWsEvent(async () => {
    try { setSummary(await api.player.detail(name)); } catch {}
  });

  useEffect(() => {
    return () => { [hourlyChart, dailyChart, weekdayChart].forEach(destroyChart); };
  }, []);

  const blocks24h = useMemo(() => build24hBlocks(sessions?.heatmap || []), [sessions]);
  const max24h = Math.max(...blocks24h, 1);

  const weeklyMap = useMemo(() => {
    const m = {};
    (weekly?.weekly_heatmap || []).forEach((i) => { if (!m[i.day]) m[i.day] = {}; m[i.day][i.hour] = i.avg_seconds; });
    return m;
  }, [weekly]);

  const weeklyMax = useMemo(() => Math.max(...(weekly?.weekly_heatmap || []).map((i) => i.avg_seconds || 0), 1), [weekly]);

  const recentSessions = useMemo(() => {
    const rows = [];
    (sessions?.daily || []).forEach((d) => (d.sessions || []).forEach((s) => rows.push({ start: s.start, end: s.end, server_name: s.server_name || "默认" })));
    return rows.sort((a, b) => new Date(b.start) - new Date(a.start)).slice(0, 20);
  }, [sessions]);

  const heatColor = (v, max) => {
    const r = max > 0 ? v / max : 0;
    if (r > 0.7) return "#188038";
    if (r > 0.35) return alpha("#188038", 0.55);
    if (r > 0) return alpha("#188038", 0.2);
    return "#E0E2E0";
  };

  return (
    <Stack spacing={3}>
      {/* Header */}
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", md: "center" }} spacing={2}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Button component={Link} to="/players" startIcon={<ArrowBackRoundedIcon />} variant="text" sx={{ minWidth: "auto", px: 1 }}>返回</Button>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 600 }}>玩家详情</Typography>
            <Typography variant="body2" sx={{ color: c?.onSurfaceVariant }}>{name}</Typography>
          </Box>
        </Stack>
        <Button variant="outlined" startIcon={<RefreshRoundedIcon />} onClick={loadFull} disabled={loading}>刷新</Button>
      </Stack>

      {loading && <LinearProgress />}
      {error && <Alert severity="error">{error}</Alert>}

      {/* Metrics */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(min(220px, 100%), 1fr))",
          gap: 2,
        }}
      >
        <MetricCard title="当前状态" value={summary?.online ? "在线" : "离线"} icon={<AccessTimeRoundedIcon />} color={summary?.online ? "success" : "error"} />
        <MetricCard title="当前会话" value={summary?.online ? formatDuration(summary.duration_seconds || 0) : "—"} icon={<ScheduleRoundedIcon />} color="primary" hint={summary?.online ? "正在游戏" : undefined} />
        <MetricCard title="最后在线" value={formatTime(summary?.last_seen)} icon={<HistoryRoundedIcon />} color="primary" />
        <MetricCard title="样本天数" value={weekly?.total_sample_days ?? 0} icon={<CalendarMonthRoundedIcon />} color="primary" hint="统计数据范围" />
      </Box>

      {/* 24h heatmap - pill nodes */}
      <Card elevation={0}>
        <CardContent>
            <SectionTitle>过去 24 小时活跃</SectionTitle>
            <HeatStrip minWidth={{ xs: 480, sm: "auto" }}>
              {blocks24h.map((sec, i) => (
                <Box key={i} sx={{ flex: 1 }}>
                  <HeatCell color={heatColor(sec, max24h)} title={sec > 0 ? formatDuration(sec) : "离线"} height={16} />
                </Box>
              ))}
            </HeatStrip>
          <Stack direction="row" justifyContent="space-between" mt={0.5}>
            <Typography variant="caption" sx={{ color: c?.outline, fontSize: "0.625rem" }}>24h前</Typography>
            <Typography variant="caption" sx={{ color: c?.outline, fontSize: "0.625rem" }}>现在</Typography>
          </Stack>
        </CardContent>
      </Card>

      {/* Charts */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
          gridTemplateRows: { md: "1fr 1fr" },
          gap: 2,
        }}
      >
        <Box>
          <Card elevation={0} sx={{ height: "100%" }}>
            <CardContent sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
              <SectionTitle>每小时平均在线</SectionTitle>
              <Box sx={{ flex: 1, minHeight: 0 }}><canvas ref={hourlyCanvas} /></Box>
            </CardContent>
          </Card>
        </Box>
        <Box>
          <Card elevation={0} sx={{ height: "100%" }}>
            <CardContent sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
              <SectionTitle>星期偏好</SectionTitle>
              <Box sx={{ flex: 1, minHeight: 0 }}><canvas ref={weekdayCanvas} /></Box>
            </CardContent>
          </Card>
        </Box>
        <Box sx={{ gridColumn: "1 / -1" }}>
          <Card elevation={0} sx={{ height: "100%" }}>
            <CardContent sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
              <SectionTitle>30 天在线趋势</SectionTitle>
              <Box sx={{ flex: 1, minHeight: 0 }}><canvas ref={dailyCanvas} /></Box>
            </CardContent>
          </Card>
        </Box>
      </Box>

      {/* Weekly heatmap */}
      <Card elevation={0}>
        <CardContent>
          <SectionTitle>周活跃热力图</SectionTitle>
            <Box sx={{ overflowX: "auto", overflowY: 'hidden' }}>
            <Box sx={{ minWidth: 700, display: "grid", gridTemplateColumns: "48px repeat(24, 1fr)", gap: 0.5 }}>
              <Box />
              {Array.from({ length: 24 }).map((_, h) => (
                <Typography key={h} variant="caption" sx={{ color: c?.outline, textAlign: "center", fontSize: "0.625rem" }}>{h}</Typography>
              ))}
              {[{ label: "周一", day: 0 }, { label: "周二", day: 1 }, { label: "周三", day: 2 }, { label: "周四", day: 3 }, { label: "周五", day: 4 }, { label: "周六", day: 5 }, { label: "周日", day: 6 }].map((row) => (
                <Box key={row.day} sx={{ display: "contents" }}>
                  <Typography variant="caption" sx={{ fontSize: "0.75rem", lineHeight: "18px", display: "flex", alignItems: "center", color: c?.onSurfaceVariant, fontWeight: 500 }}>{row.label}</Typography>
                  {Array.from({ length: 24 }).map((_, hour) => {
                    const val = weeklyMap?.[row.day]?.[hour] || 0;
                    return (
                      <Box key={`${row.day}-${hour}`} sx={{ width: '100%' }}>
                        <HeatCell color={heatColor(val, weeklyMax)} title={val > 0 ? formatDuration(val) : "无数据"} height={18} innerSx={{ borderRadius: 0.75 }} />
                      </Box>
                    );
                  })}
                </Box>
              ))}
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Recent sessions */}
      <Card elevation={0}>
        <CardContent>
          <SectionTitle>最近会话（20 条）</SectionTitle>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>开始时间</TableCell>
                <TableCell>结束时间</TableCell>
                <TableCell>时长</TableCell>
                <TableCell>分组</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {recentSessions.map((s, idx) => {
                const sec = Math.max(0, Math.floor((new Date(s.end) - new Date(s.start)) / 1000));
                return (
                  <TableRow key={`${s.start}-${idx}`}>
                    <TableCell>{formatTime(s.start)}</TableCell>
                    <TableCell>{formatTime(s.end)}</TableCell>
                    <TableCell><Chip label={formatDuration(sec)} size="small" sx={{ borderRadius: 1, height: 24 }} /></TableCell>
                    <TableCell><Typography variant="body2" sx={{ color: c?.onSurfaceVariant }}>{s.server_name}</Typography></TableCell>
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
