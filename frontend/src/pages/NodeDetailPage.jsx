import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  LinearProgress,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import DnsRoundedIcon from "@mui/icons-material/DnsRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import SpeedRoundedIcon from "@mui/icons-material/SpeedRounded";
import PeopleRoundedIcon from "@mui/icons-material/PeopleRounded";
import ScheduleRoundedIcon from "@mui/icons-material/ScheduleRounded";
import WifiRoundedIcon from "@mui/icons-material/WifiRounded";
import WifiOffRoundedIcon from "@mui/icons-material/WifiOffRounded";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import PercentRoundedIcon from "@mui/icons-material/PercentRounded";
import MetricCard from "../components/MetricCard";
import { api } from "../api";
import { useWsEvent } from "../utils/ws";
import { recreateChart, destroyChart } from "../utils/charts";
import { formatTime, toTimeLabel } from "../utils/format";

function mergeNodeHistory(history, pt) {
  if (!history || !pt?.timestamp) return history;
  const next = {
    ...history,
    timestamps: [...(history.timestamps || [])],
    online: [...(history.online || [])],
    latency: [...(history.latency || [])],
    players_online: [...(history.players_online || [])],
    players_max: [...(history.players_max || [])],
  };
  const idx = next.timestamps.indexOf(pt.timestamp);
  if (idx >= 0) {
    next.online[idx] = Boolean(pt.online);
    next.latency[idx] = pt.latency ?? null;
    next.players_online[idx] = pt.players_online ?? 0;
    next.players_max[idx] = pt.players_max ?? 0;
    return next;
  }
  next.timestamps.push(pt.timestamp);
  next.online.push(Boolean(pt.online));
  next.latency.push(pt.latency ?? null);
  next.players_online.push(pt.players_online ?? 0);
  next.players_max.push(pt.players_max ?? 0);
  return next;
}

function buildHeatmap(timeline) {
  const ts = timeline?.timestamps || [];
  const on = timeline?.online || [];
  const now = new Date();
  const rows = [];
  for (let i = 0; i < 24; i++) {
    const hStart = new Date(now.getTime() - (23 - i) * 3600000);
    hStart.setMinutes(0, 0, 0);
    const hEnd = new Date(hStart.getTime() + 3600000);
    let total = 0,
      up = 0;
    for (let j = 0; j < ts.length; j++) {
      const t = new Date(ts[j]);
      if (t >= hStart && t < hEnd) {
        total++;
        if (on[j]) up++;
      }
    }
    const level = total === 0 ? "none" : up === total ? "high" : up > 0 ? "mid" : "low";
    rows.push({ key: hStart.toISOString(), level, hour: hStart.getHours() });
  }
  return rows;
}

function SectionTitle({ children, action }) {
  return (
    <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
      <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>{children}</Typography>
      {action}
    </Stack>
  );
}

export default function NodeDetailPage() {
  const theme = useTheme();
  const c = theme.gemini?.colors;
  const isDark = theme.gemini?.isDark;
  const { nodeId } = useParams();
  const [hours, setHours] = useState(12);
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const latencyCanvas = useRef(null);
  const playersCanvas = useRef(null);
  const statusCanvas = useRef(null);
  const latencyChart = useRef(null);
  const playersChart = useRef(null);
  const statusChart = useRef(null);

  const renderCharts = (data) => {
    const h = data?.history;
    if (!h?.timestamps?.length) {
      [latencyChart, playersChart, statusChart].forEach(destroyChart);
      return;
    }
    const labels = h.timestamps.map((t) => toTimeLabel(t, hours));
    const grid = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";
    const legendLabels = {
      usePointStyle: true, pointStyle: "circle", padding: 16,
      font: { family: theme.typography.fontFamily, size: 11 },
      color: c?.onSurfaceVariant,
    };

    recreateChart(latencyChart, latencyCanvas.current, {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: "延迟", data: h.latency || [],
          borderColor: "#E37400",
          backgroundColor: alpha("#E37400", 0.12),
          fill: true, pointRadius: 0, tension: 0.4, borderWidth: 2,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: "nearest", axis: "x", intersect: false },
        plugins: { legend: { display: true, position: "top", labels: legendLabels } },
        scales: { x: { grid: { display: false } }, y: { grid: { color: grid } } },
      },
    });

    recreateChart(playersChart, playersCanvas.current, {
      type: "line",
      data: {
        labels,
        datasets: [
          { label: "在线玩家", data: h.players_online || [], borderColor: c?.primary, backgroundColor: alpha(c?.primary || "#1A73E8", 0.1), fill: true, pointRadius: 0, tension: 0.4, borderWidth: 2 },
          { label: "最大玩家", data: h.players_max || [], borderColor: c?.outline, borderDash: [4, 4], fill: false, pointRadius: 0, tension: 0.4, borderWidth: 1.5 },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: true, position: "top", labels: legendLabels } },
        scales: { x: { grid: { display: false } }, y: { beginAtZero: true, grid: { color: grid }, ticks: { precision: 0 } } },
      },
    });

    recreateChart(statusChart, statusCanvas.current, {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: "在线状态", data: (h.online || []).map((v) => (v ? 1 : 0)),
          borderColor: c?.primary, backgroundColor: alpha(c?.primary || "#1A73E8", 0.12),
          stepped: true, fill: true, pointRadius: 0, borderWidth: 1.5,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: true, position: "top", labels: legendLabels } },
        scales: { x: { grid: { display: false } }, y: { min: 0, max: 1, grid: { color: grid }, ticks: { stepSize: 1, callback: (v) => (v === 1 ? "在线" : v === 0 ? "离线" : "") } } },
      },
    });
  };

  const loadFull = async () => {
    setLoading(true); setError("");
    try {
      const data = await api.node.full(nodeId, hours);
      setPayload(data); renderCharts(data);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadFull(); }, [nodeId, hours]);

  useWsEvent(async () => {
    try {
      const head = await api.node.head(nodeId, hours);
      setPayload((prev) => {
        if (!prev) return prev;
        const next = { ...prev, stats: head.stats || prev.stats, server: head.server || prev.server, status_timeline: head.status_timeline || prev.status_timeline, history: mergeNodeHistory(prev.history, head.latest_history_point) };
        renderCharts(next);
        return next;
      });
    } catch {}
  });

  useEffect(() => {
    return () => { [latencyChart, playersChart, statusChart].forEach(destroyChart); };
  }, []);

  const node = payload?.server;
  const status = node?.latest_status;
  const stats = payload?.stats || {};
  const heatmap = useMemo(() => buildHeatmap(payload?.status_timeline), [payload]);

  const heatColor = (level) => {
    const m = { high: "#188038", mid: c?.warning || "#B05D00", low: c?.error || "#B3261E", none: "#E0E2E0" };
    return m[level] || m.none;
  };

  return (
    <Stack spacing={3}>
      {/* Header */}
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", md: "center" }} spacing={2}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Button component={Link} to="/nodes" startIcon={<ArrowBackRoundedIcon />} variant="text" sx={{ minWidth: "auto", px: 1 }}>返回</Button>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 600 }}>节点详情</Typography>
            <Typography variant="body2" sx={{ color: c?.onSurfaceVariant }}>
              #{nodeId} · {node?.name || "未知"} · {node?.host}:{node?.port}
            </Typography>
          </Box>
        </Stack>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>时间范围</InputLabel>
            <Select value={hours} label="时间范围" onChange={(e) => setHours(Number(e.target.value))}>
              {[3, 6, 12, 24, 48, 72].map((h) => <MenuItem key={h} value={h}>{h} 小时</MenuItem>)}
            </Select>
          </FormControl>
          <Button variant="outlined" startIcon={<RefreshRoundedIcon />} onClick={loadFull} disabled={loading}>刷新</Button>
        </Stack>
      </Stack>

      {loading && <LinearProgress />}
      {error && <Alert severity="error">{error}</Alert>}

      {/* Metrics */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "repeat(auto-fill, minmax(min(160px, 100%), 1fr))",
            sm: "repeat(auto-fill, minmax(min(220px, 100%), 1fr))",
          },
          gap: 2,
        }}
      >
        <MetricCard title="服务状态" value={status?.online ? "在线" : "离线"} icon={status?.online ? <WifiRoundedIcon /> : <WifiOffRoundedIcon />} color={status?.online ? "success" : "error"} />
        <MetricCard title="当前延迟" value={status?.latency ? `${Math.round(status.latency)}ms` : "—"} icon={<SpeedRoundedIcon />} color="primary" />
        <MetricCard title="在线玩家" value={`${status?.players_online ?? 0}/${status?.players_max ?? 0}`} icon={<PeopleRoundedIcon />} color="success" />
        <MetricCard title="最近采样" value={formatTime(status?.timestamp)} icon={<ScheduleRoundedIcon />} color="primary" />
      </Box>

      {/* Heatmap - pill nodes */}
      <Card elevation={0}>
        <CardContent>
          <SectionTitle>24 小时可用性</SectionTitle>
          <Box sx={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
            <Stack direction="row" spacing={0.5} sx={{ minWidth: { xs: 480, sm: "auto" } }}>
              {heatmap.map((cell) => (
                <Tooltip key={cell.key} title={`${cell.hour}:00 - ${cell.level === "high" ? "在线" : cell.level === "mid" ? "部分在线" : cell.level === "low" ? "离线" : "无数据"}`} arrow>
                  <Box sx={{ flex: 1, height: 16, borderRadius: 100, bgcolor: heatColor(cell.level), cursor: "pointer", transition: "transform 150ms cubic-bezier(0.2,0,0,1)", "&:hover": { transform: "scaleY(1.5)" } }} />
                </Tooltip>
              ))}
            </Stack>
          </Box>
        </CardContent>
      </Card>

      {/* Charts */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "repeat(12, 1fr)" },
          gap: 2,
          minWidth: 0,
        }}
      >
        <Box sx={{ gridColumn: { xs: "1 / -1", md: "span 8" }, minWidth: 0 }}>
          <Card elevation={0} sx={{ height: "100%" }}>
            <CardContent sx={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <SectionTitle>延迟趋势</SectionTitle>
              <Box sx={{ flex: 1, minHeight: { xs: 200, md: 280 }, position: "relative", width: "100%" }}><canvas ref={latencyCanvas} style={{ width: "100%", height: "100%" }} /></Box>
            </CardContent>
          </Card>
        </Box>
        <Box sx={{ gridColumn: { xs: "1 / -1", md: "span 4" }, minWidth: 0 }}>
          <Card elevation={0} sx={{ height: "100%" }}>
            <CardContent sx={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <SectionTitle>在线状态</SectionTitle>
              <Box sx={{ flex: 1, minHeight: { xs: 200, md: 280 }, position: "relative", width: "100%" }}><canvas ref={statusCanvas} style={{ width: "100%", height: "100%" }} /></Box>
            </CardContent>
          </Card>
        </Box>
        <Box sx={{ gridColumn: "1 / -1", minWidth: 0 }}>
          <Card elevation={0} sx={{ height: "100%" }}>
            <CardContent sx={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <SectionTitle>玩家数量趋势</SectionTitle>
              <Box sx={{ flex: 1, minHeight: { xs: 200, md: 280 }, position: "relative", width: "100%" }}><canvas ref={playersCanvas} style={{ width: "100%", height: "100%" }} /></Box>
            </CardContent>
          </Card>
        </Box>
      </Box>

      {/* Stats summary */}
      <Card elevation={0}>
        <CardContent>
          <SectionTitle>统计摘要</SectionTitle>
          <Grid container spacing={2}>
            {[
              { label: "在线率", value: stats.uptime_percentage != null ? `${Number(stats.uptime_percentage).toFixed(1)}%` : "—", icon: <PercentRoundedIcon sx={{ fontSize: 16 }} />, color: c?.primary },
              { label: "平均延迟", value: stats.avg_latency ? `${Math.round(stats.avg_latency)}ms` : "—", icon: <TrendingUpRoundedIcon sx={{ fontSize: 16 }} />, color: c?.success },
              { label: "P95 延迟", value: stats.p95_latency ? `${Math.round(stats.p95_latency)}ms` : "—", icon: <SpeedRoundedIcon sx={{ fontSize: 16 }} />, color: c?.warning },
              { label: "波动系数 CV", value: stats.cv != null ? `${Number(stats.cv).toFixed(1)}%` : "—", icon: <TrendingUpRoundedIcon sx={{ fontSize: 16 }} />, color: "#7B61FF" },
            ].map((item) => (
              <Grid key={item.label} item xs={12} sm={6} md={3}>
                <Box sx={{ p: 2, borderRadius: 3, bgcolor: alpha(c?.onSurface || "#000", 0.04) }}>
                  <Stack direction="row" alignItems="center" spacing={0.75} mb={0.5}>
                    <Box sx={{ color: item.color }}>{item.icon}</Box>
                    <Typography variant="caption" sx={{ color: c?.onSurfaceVariant }}>{item.label}</Typography>
                  </Stack>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>{item.value}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>
    </Stack>
  );
}
