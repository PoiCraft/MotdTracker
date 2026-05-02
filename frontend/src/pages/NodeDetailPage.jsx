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
import StatusPill, { StatusDot } from "../components/StatusPill";
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
  const md3 = theme.md3?.colors;
  const isDark = theme.md3?.isDark;
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
      color: md3?.onSurfaceVariant,
    };

    recreateChart(latencyChart, latencyCanvas.current, {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: "延迟", data: h.latency || [],
          borderColor: md3?.tertiary,
          backgroundColor: alpha(md3?.tertiary || "#75546f", 0.12),
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
          { label: "在线玩家", data: h.players_online || [], borderColor: md3?.primary, backgroundColor: alpha(md3?.primary || "#0b57d0", 0.1), fill: true, pointRadius: 0, tension: 0.4, borderWidth: 2 },
          { label: "最大玩家", data: h.players_max || [], borderColor: md3?.outline, borderDash: [4, 4], fill: false, pointRadius: 0, tension: 0.4, borderWidth: 1.5 },
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
          borderColor: md3?.primary, backgroundColor: alpha(md3?.primary || "#0b57d0", 0.12),
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
    const m = { high: md3?.success, mid: md3?.warning, low: md3?.error, none: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)" };
    return m[level] || m.none;
  };

  return (
    <Stack spacing={3}>
      {/* Header */}
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", md: "center" }} spacing={2}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Button component={Link} to="/nodes" startIcon={<ArrowBackRoundedIcon />} variant="text" sx={{ minWidth: "auto", px: 1 }}>返回</Button>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 500 }}>节点详情</Typography>
            <Typography variant="body2" sx={{ color: md3?.onSurfaceVariant }}>
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
          gridTemplateColumns: "repeat(auto-fill, minmax(min(220px, 100%), 1fr))",
          gap: 2,
        }}
      >
        <MetricCard title="服务状态" value={status?.online ? "在线" : "离线"} icon={status?.online ? <WifiRoundedIcon /> : <WifiOffRoundedIcon />} color={status?.online ? "success" : "error"} />
        <MetricCard title="当前延迟" value={status?.latency ? `${Math.round(status.latency)}ms` : "—"} icon={<SpeedRoundedIcon />} color="primary" />
        <MetricCard title="在线玩家" value={`${status?.players_online ?? 0}/${status?.players_max ?? 0}`} icon={<PeopleRoundedIcon />} color="success" />
        <MetricCard title="最近采样" value={formatTime(status?.timestamp)} icon={<ScheduleRoundedIcon />} color="primary" />
      </Box>

      {/* Heatmap */}
      <Card variant="outlined">
        <CardContent>
          <SectionTitle>24 小时可用性</SectionTitle>
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(24, 1fr)", gap: 0.5 }}>
            {heatmap.map((cell) => (
              <Tooltip key={cell.key} title={`${cell.hour}:00 - ${cell.level === "high" ? "在线" : cell.level === "mid" ? "部分在线" : cell.level === "low" ? "离线" : "无数据"}`} arrow>
                <Box sx={{ height: 20, borderRadius: 1, bgcolor: heatColor(cell.level), cursor: "pointer", transition: "transform 150ms cubic-bezier(0.2,0,0,1)", "&:hover": { transform: "scaleY(1.3)" } }} />
              </Tooltip>
            ))}
          </Box>
        </CardContent>
      </Card>

      {/* Charts */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "repeat(12, 1fr)" },
          gridTemplateRows: { md: "1fr 1fr" },
          gap: 2,
        }}
      >
        <Box sx={{ gridColumn: { xs: "1 / -1", md: "span 8" } }}>
          <Card variant="outlined" sx={{ height: "100%" }}>
            <CardContent sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
              <SectionTitle>延迟趋势</SectionTitle>
              <Box sx={{ flex: 1, minHeight: 0 }}><canvas ref={latencyCanvas} /></Box>
            </CardContent>
          </Card>
        </Box>
        <Box sx={{ gridColumn: { xs: "1 / -1", md: "span 4" } }}>
          <Card variant="outlined" sx={{ height: "100%" }}>
            <CardContent sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
              <SectionTitle>在线状态</SectionTitle>
              <Box sx={{ flex: 1, minHeight: 0 }}><canvas ref={statusCanvas} /></Box>
            </CardContent>
          </Card>
        </Box>
        <Box sx={{ gridColumn: "1 / -1" }}>
          <Card variant="outlined" sx={{ height: "100%" }}>
            <CardContent sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
              <SectionTitle>玩家数量趋势</SectionTitle>
              <Box sx={{ flex: 1, minHeight: 0 }}><canvas ref={playersCanvas} /></Box>
            </CardContent>
          </Card>
        </Box>
      </Box>

      {/* Stats summary */}
      <Card variant="outlined">
        <CardContent>
          <SectionTitle>统计摘要</SectionTitle>
          <Grid container spacing={2}>
            {[
              { label: "在线率", value: stats.uptime_percentage != null ? `${Number(stats.uptime_percentage).toFixed(1)}%` : "—", icon: <PercentRoundedIcon sx={{ fontSize: 16 }} />, color: md3?.primary },
              { label: "平均延迟", value: stats.avg_latency ? `${Math.round(stats.avg_latency)}ms` : "—", icon: <TrendingUpRoundedIcon sx={{ fontSize: 16 }} />, color: md3?.success },
              { label: "P95 延迟", value: stats.p95_latency ? `${Math.round(stats.p95_latency)}ms` : "—", icon: <SpeedRoundedIcon sx={{ fontSize: 16 }} />, color: md3?.warning },
              { label: "波动系数 CV", value: stats.cv != null ? `${Number(stats.cv).toFixed(1)}%` : "—", icon: <TrendingUpRoundedIcon sx={{ fontSize: 16 }} />, color: md3?.tertiary },
            ].map((item) => (
              <Grid key={item.label} item xs={12} sm={6} md={3}>
                <Box sx={{ p: 2, borderRadius: 2, bgcolor: md3?.surfaceContainerHighest }}>
                  <Stack direction="row" alignItems="center" spacing={0.75} mb={0.5}>
                    <Box sx={{ color: item.color }}>{item.icon}</Box>
                    <Typography variant="caption" sx={{ color: md3?.onSurfaceVariant }}>{item.label}</Typography>
                  </Stack>
                  <Typography variant="h6" sx={{ fontWeight: 500 }}>{item.value}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>
    </Stack>
  );
}
