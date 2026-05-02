import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  IconButton,
  LinearProgress,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Stack,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import WifiRoundedIcon from "@mui/icons-material/WifiRounded";
import WifiOffRoundedIcon from "@mui/icons-material/WifiOffRounded";
import DnsRoundedIcon from "@mui/icons-material/DnsRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import ScheduleRoundedIcon from "@mui/icons-material/ScheduleRounded";
import MetricCard from "../components/MetricCard";
import M3StatusTag, { StatusDot } from "../components/M3StatusTag";
import { api } from "../api";
import { useWsEvent } from "../utils/ws";
import { recreateChart, destroyChart } from "../utils/charts";
import { formatDuration, formatTime, toTimeLabel } from "../utils/format";

function mergeLatestPoint(history, latestPoint) {
  if (!history || !latestPoint?.timestamp) return history;
  const next = {
    ...history,
    timestamps: [...(history.timestamps || [])],
    online: [...(history.online || [])],
    players_online: [...(history.players_online || [])],
    players_max: [...(history.players_max || [])],
    latencies: Object.fromEntries(
      Object.entries(history.latencies || {}).map(([k, arr]) => [k, [...arr]])
    ),
  };
  const idx = next.timestamps.indexOf(latestPoint.timestamp);
  const allNodes = new Set([
    ...Object.keys(next.latencies || {}),
    ...Object.keys(latestPoint.latencies || {}),
  ]);
  if (idx >= 0) {
    next.online[idx] = Boolean(latestPoint.online);
    next.players_online[idx] = latestPoint.players_online;
    next.players_max[idx] = latestPoint.players_max;
    allNodes.forEach((n) => {
      if (!next.latencies[n])
        next.latencies[n] = Array(next.timestamps.length).fill(null);
      next.latencies[n][idx] = latestPoint.latencies?.[n] ?? null;
    });
    return next;
  }
  next.timestamps.push(latestPoint.timestamp);
  next.online.push(Boolean(latestPoint.online));
  next.players_online.push(latestPoint.players_online ?? 0);
  next.players_max.push(latestPoint.players_max ?? 0);
  allNodes.forEach((n) => {
    if (!next.latencies[n])
      next.latencies[n] = Array(next.timestamps.length - 1).fill(null);
    next.latencies[n].push(latestPoint.latencies?.[n] ?? null);
  });
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
    const level =
      total === 0 ? "none" : up === total ? "high" : up > 0 ? "mid" : "low";
    rows.push({ key: hStart.toISOString(), hour: hStart.getHours(), level });
  }
  return rows;
}

function SectionTitle({ children, action }) {
  return (
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="space-between"
      mb={2}
    >
      <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
        {children}
      </Typography>
      {action}
    </Stack>
  );
}

export default function ServerPage() {
  const theme = useTheme();
  const c = theme.gemini?.colors;
  const isDark = theme.gemini?.isDark;
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
      destroyChart(latencyChart);
      destroyChart(playersChart);
      destroyChart(statusChart);
      return;
    }
    const labels = h.timestamps.map((t) => toTimeLabel(t, hours));
    const online = (h.online || []).map((v) => (v ? 1 : 0));
    const chartGrid = isDark
      ? "rgba(255,255,255,0.06)"
      : "rgba(0,0,0,0.06)";

    const seriesColors = [
      c?.primary,
      "#E37400",
      "#7B61FF",
      c?.error,
      c?.success,
      c?.warning,
    ];

    const latencyDatasets = Object.entries(h.latencies || {}).map(
      ([name, values], i) => ({
        label: name,
        data: values,
        borderColor: seriesColors[i % seriesColors.length],
        backgroundColor: "transparent",
        pointRadius: 0,
        borderWidth: 2,
        tension: 0.4,
      })
    );

    const legendLabels = {
      usePointStyle: true,
      pointStyle: "circle",
      padding: 16,
      font: { family: theme.typography.fontFamily, size: 11 },
      color: c?.onSurfaceVariant,
    };

    recreateChart(latencyChart, latencyCanvas.current, {
      type: "line",
      data: { labels, datasets: latencyDatasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "nearest", axis: "x", intersect: false },
        plugins: {
          legend: { display: true, position: "top", labels: legendLabels },
        },
        scales: {
          x: { grid: { display: false } },
          y: { grid: { color: chartGrid } },
        },
      },
    });

    recreateChart(playersChart, playersCanvas.current, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "在线玩家",
            data: h.players_online || [],
            borderColor: c?.primary,
            backgroundColor: alpha(c?.primary || "#1A73E8", 0.1),
            fill: true,
            tension: 0.4,
            pointRadius: 0,
            borderWidth: 2,
          },
          {
            label: "最大玩家",
            data: h.players_max || [],
            borderColor: c?.outline,
            borderDash: [4, 4],
            fill: false,
            tension: 0.4,
            pointRadius: 0,
            borderWidth: 1.5,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true, position: "top", labels: legendLabels },
        },
        scales: {
          x: { grid: { display: false } },
          y: {
            beginAtZero: true,
            grid: { color: chartGrid },
            ticks: { precision: 0 },
          },
        },
      },
    });

    recreateChart(statusChart, statusCanvas.current, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "在线状态",
            data: online,
            borderColor: c?.primary,
            backgroundColor: alpha(c?.primary || "#1A73E8", 0.12),
            stepped: true,
            fill: true,
            pointRadius: 0,
            borderWidth: 1.5,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true, position: "top", labels: legendLabels },
        },
        scales: {
          x: { grid: { display: false } },
          y: {
            min: 0,
            max: 1,
            grid: { color: chartGrid },
            ticks: { stepSize: 1, callback: (v) => (v === 1 ? "在线" : v === 0 ? "离线" : "") },
          },
        },
      },
    });
  };

  const loadFull = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.server.full(hours);
      setPayload(data);
      renderCharts(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFull();
  }, [hours]);

  const wsStatus = useWsEvent(async () => {
    try {
      const head = await api.server.head(hours);
      setPayload((prev) => {
        if (!prev) return prev;
        const next = {
          ...prev,
          ...head,
          history: mergeLatestPoint(
            prev.history,
            head.latest_history_point
          ),
        };
        renderCharts(next);
        return next;
      });
    } catch {}
  });

  useEffect(() => {
    return () => {
      destroyChart(latencyChart);
      destroyChart(playersChart);
      destroyChart(statusChart);
    };
  }, []);

  const head = payload?.head || {};
  const nodes = payload?.nodes || [];
  const players = payload?.players || [];
  const heatmap = useMemo(
    () => buildHeatmap(payload?.status_timeline),
    [payload]
  );
  const onlineNodes = nodes.filter((n) => n.latest_status?.online).length;

  const heatColor = (level) => {
    const map = {
      high: "#188038",
      mid: c?.warning || "#B05D00",
      low: c?.error || "#B3261E",
      none: "#E0E2E0",
    };
    return map[level] || map.none;
  };

  return (
    <Stack spacing={3}>
      {/* Header */}
      <Stack
        direction={{ xs: "column", md: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", md: "center" }}
        spacing={2}
      >
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 600, mb: 0.25 }}>
            服务器总览
          </Typography>
          <Typography variant="body2" sx={{ color: c?.onSurfaceVariant }}>
            实时监控服务器状态与性能指标
          </Typography>
        </Box>

        <Stack direction="row" spacing={1.5} alignItems="center">
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>时间范围</InputLabel>
            <Select
              value={hours}
              label="时间范围"
              onChange={(e) => setHours(Number(e.target.value))}
            >
              {[3, 6, 12, 24, 48, 72].map((h) => (
                <MenuItem key={h} value={h}>
                  {h} 小时
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button
            variant="outlined"
            startIcon={<RefreshRoundedIcon />}
            onClick={loadFull}
            disabled={loading}
          >
            刷新
          </Button>
        </Stack>
      </Stack>

      {loading && <LinearProgress />}
      {error && <Alert severity="error">{error}</Alert>}

      {/* Metric cards */}
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <MetricCard
            title="服务状态"
            value={head.online ? "在线" : "离线"}
            hint={`WebSocket: ${wsStatus}`}
            icon={head.online ? <WifiRoundedIcon /> : <WifiOffRoundedIcon />}
            color={head.online ? "success" : "error"}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <MetricCard
            title="在线节点"
            value={`${onlineNodes}/${nodes.length}`}
            icon={<DnsRoundedIcon />}
            color="primary"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <MetricCard
            title="在线玩家"
            value={head.players_online ?? 0}
            hint={`玩家池: ${players.length}`}
            icon={<GroupsRoundedIcon />}
            color="success"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <MetricCard
            title="最后更新"
            value={formatTime(head.timestamp)}
            icon={<ScheduleRoundedIcon />}
            color="primary"
          />
        </Grid>
      </Grid>

      {/* Uptime Timeline - pill-shaped nodes */}
      <Card elevation={0}>
        <CardContent>
          <SectionTitle
            action={
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ display: { xs: "none", sm: "flex" } }}>
                {[
                  { color: "#188038", label: "在线" },
                  { color: c?.warning || "#B05D00", label: "部分" },
                  { color: c?.error || "#B3261E", label: "离线" },
                  { color: "#E0E2E0", label: "无数据" },
                ].map((i) => (
                  <Stack
                    key={i.label}
                    direction="row"
                    spacing={0.5}
                    alignItems="center"
                  >
                    <Box
                      sx={{
                        width: 16,
                        height: 8,
                        borderRadius: 100,
                        bgcolor: i.color,
                      }}
                    />
                    <Typography
                      variant="caption"
                      sx={{ color: c?.onSurfaceVariant }}
                    >
                      {i.label}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            }
          >
            24 小时可用性
          </SectionTitle>
          <Box sx={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
            <Stack direction="row" spacing={0.5} sx={{ minWidth: { xs: 480, sm: "auto" } }}>
              {heatmap.map((cell) => (
                <Tooltip
                  key={cell.key}
                  title={`${cell.hour}:00 - ${
                    cell.level === "high"
                      ? "全部在线"
                      : cell.level === "mid"
                      ? "部分在线"
                      : cell.level === "low"
                      ? "全部离线"
                      : "无数据"
                  }`}
                  arrow
                >
                  <Box
                    sx={{
                      flex: 1,
                      height: 16,
                      borderRadius: 100,
                      bgcolor: heatColor(cell.level),
                      cursor: "pointer",
                      transition: "transform 150ms cubic-bezier(0.2,0,0,1)",
                      "&:hover": { transform: "scaleY(1.5)" },
                    }}
                  />
                </Tooltip>
              ))}
            </Stack>
          </Box>
        </CardContent>
      </Card>

      {/* Node status table - borderless */}
      <Card elevation={0}>
        <CardContent sx={{ overflowX: "auto" }}>
          <SectionTitle>节点实时状态</SectionTitle>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>节点名称</TableCell>
                <TableCell>状态</TableCell>
                <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>延迟</TableCell>
                <TableCell>玩家</TableCell>
                <TableCell sx={{ display: { xs: "none", md: "table-cell" } }} align="right">操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {nodes.map((node) => (
                <TableRow key={node.id}>
                  <TableCell>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <StatusDot online={node.latest_status?.online} />
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {node.name}
                      </Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <M3StatusTag
                      online={node.latest_status?.online}
                      size="small"
                    />
                  </TableCell>
                  <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>
                    <Typography variant="body2">
                      {node.latest_status?.latency
                        ? `${Math.round(node.latest_status.latency)}ms`
                        : "—"}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {node.latest_status?.players_online ?? 0}/
                      {node.latest_status?.players_max ?? 0}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ display: { xs: "none", md: "table-cell" } }} align="right">
                    <Button
                      component={Link}
                      to={`/nodes/${node.id}`}
                      size="small"
                      variant="text"
                    >
                      详情
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
              <SectionTitle>节点延迟趋势</SectionTitle>
              <Box sx={{ flex: 1, minHeight: { xs: 200, md: 280 }, position: "relative", width: "100%" }}><canvas ref={latencyCanvas} style={{ width: "100%", height: "100%" }} /></Box>
            </CardContent>
          </Card>
        </Box>
        <Box sx={{ gridColumn: { xs: "1 / -1", md: "span 4" }, minWidth: 0 }}>
          <Card elevation={0} sx={{ height: "100%" }}>
            <CardContent sx={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <SectionTitle>在线状态趋势</SectionTitle>
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

      {/* Online players */}
      <Card elevation={0}>
        <CardContent>
          <SectionTitle>当前在线玩家</SectionTitle>
          {players.length > 0 ? (
            <Stack direction="row" flexWrap="wrap" gap={1}>
              {players.map((p) => (
                <Chip
                  key={p.player_name}
                  component={Link}
                  clickable
                  to={`/players/${encodeURIComponent(p.player_name)}`}
                  label={`${p.player_name} · ${
                    p.online
                      ? formatDuration(p.duration_seconds || 0)
                      : "离线"
                  }`}
                  variant="outlined"
                  sx={{ borderRadius: 2 }}
                />
              ))}
            </Stack>
          ) : (
            <Typography
              variant="body2"
              sx={{ color: c?.onSurfaceVariant, py: 2 }}
            >
              暂无在线玩家
            </Typography>
          )}
        </CardContent>
      </Card>
    </Stack>
  );
}
