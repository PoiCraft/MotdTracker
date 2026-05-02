import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import { Link } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  IconButton,
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
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import WifiRoundedIcon from "@mui/icons-material/WifiRounded";
import WifiOffRoundedIcon from "@mui/icons-material/WifiOffRounded";
import DnsRoundedIcon from "@mui/icons-material/DnsRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import ScheduleRoundedIcon from "@mui/icons-material/ScheduleRounded";
import MetricCard from "../components/MetricCard";
import StatusPill, { StatusDot } from "../components/StatusPill";
import { api, SOCKET_BASE } from "../api";
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
  const md3 = theme.md3?.colors;
  const isDark = theme.md3?.isDark;
  const [hours, setHours] = useState(12);
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [wsStatus, setWsStatus] = useState("connecting");

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
      md3?.primary,
      md3?.tertiary,
      md3?.secondary,
      md3?.error,
      md3?.success,
      md3?.warning,
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
      color: md3?.onSurfaceVariant,
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
            borderColor: md3?.primary,
            backgroundColor: alpha(md3?.primary || "#0b57d0", 0.1),
            fill: true,
            tension: 0.4,
            pointRadius: 0,
            borderWidth: 2,
          },
          {
            label: "最大玩家",
            data: h.players_max || [],
            borderColor: md3?.outline,
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
            borderColor: md3?.primary,
            backgroundColor: alpha(md3?.primary || "#0b57d0", 0.12),
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
            ticks: { callback: (v) => (v === 1 ? "在线" : "离线") },
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

  useEffect(() => {
    const socket = io(SOCKET_BASE, {
      path: "/api/socket.io",
      transports: ["websocket"],
    });
    socket.on("connect", () => setWsStatus("connected"));
    socket.on("disconnect", () => setWsStatus("disconnected"));
    socket.on("poll_complete", async () => {
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
    return () => {
      socket.disconnect();
      destroyChart(latencyChart);
      destroyChart(playersChart);
      destroyChart(statusChart);
    };
  }, [hours]);

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
      high: md3?.success,
      mid: md3?.warning,
      low: md3?.error,
      none: isDark
        ? "rgba(255,255,255,0.04)"
        : "rgba(0,0,0,0.04)",
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
          <Typography variant="h5" sx={{ fontWeight: 500, mb: 0.25 }}>
            服务器总览
          </Typography>
          <Typography variant="body2" sx={{ color: md3?.onSurfaceVariant }}>
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
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="服务状态"
            value={head.online ? "在线" : "离线"}
            hint={`WebSocket: ${wsStatus}`}
            icon={head.online ? <WifiRoundedIcon /> : <WifiOffRoundedIcon />}
            color={head.online ? "success" : "error"}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="在线节点"
            value={`${onlineNodes}/${nodes.length}`}
            icon={<DnsRoundedIcon />}
            color="primary"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="在线玩家"
            value={head.players_online ?? 0}
            hint={`玩家池: ${players.length}`}
            icon={<GroupsRoundedIcon />}
            color="success"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="最后更新"
            value={formatTime(head.timestamp)}
            icon={<ScheduleRoundedIcon />}
            color="primary"
          />
        </Grid>
      </Grid>

      {/* Heatmap */}
      <Card variant="outlined">
        <CardContent>
          <SectionTitle
            action={
              <Stack direction="row" spacing={1.5} alignItems="center">
                {[
                  { level: "high", label: "在线" },
                  { level: "mid", label: "部分" },
                  { level: "low", label: "离线" },
                ].map((i) => (
                  <Stack
                    key={i.level}
                    direction="row"
                    spacing={0.5}
                    alignItems="center"
                  >
                    <Box
                      sx={{
                        width: 10,
                        height: 10,
                        borderRadius: 2,
                        bgcolor: heatColor(i.level),
                      }}
                    />
                    <Typography
                      variant="caption"
                      sx={{ color: md3?.onSurfaceVariant }}
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
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(24, 1fr)",
              gap: 0.5,
            }}
          >
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
                    height: 20,
                    borderRadius: 1,
                    bgcolor: heatColor(cell.level),
                    cursor: "pointer",
                    transition:
                      "transform 150ms cubic-bezier(0.2,0,0,1)",
                    "&:hover": { transform: "scaleY(1.3)" },
                  }}
                />
              </Tooltip>
            ))}
          </Box>
        </CardContent>
      </Card>

      {/* Node status table */}
      <Card variant="outlined">
        <CardContent>
          <SectionTitle>节点实时状态</SectionTitle>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>节点名称</TableCell>
                <TableCell>状态</TableCell>
                <TableCell>延迟</TableCell>
                <TableCell>玩家</TableCell>
                <TableCell align="right">操作</TableCell>
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
                    <StatusPill
                      online={node.latest_status?.online}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
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
                  <TableCell align="right">
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
      <Grid container spacing={2}>
        <Grid item xs={12} md={8}>
          <Card variant="outlined" sx={{ height: "100%" }}>
            <CardContent
              sx={{
                height: "100%",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <SectionTitle>节点延迟趋势</SectionTitle>
              <Box sx={{ flex: 1, minHeight: 280 }}>
                <canvas ref={latencyCanvas} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card variant="outlined" sx={{ height: "100%" }}>
            <CardContent
              sx={{
                height: "100%",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <SectionTitle>在线状态趋势</SectionTitle>
              <Box sx={{ flex: 1, minHeight: 280 }}>
                <canvas ref={statusCanvas} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12}>
          <Card variant="outlined">
            <CardContent>
              <SectionTitle>玩家数量趋势</SectionTitle>
              <Box sx={{ height: 240 }}>
                <canvas ref={playersCanvas} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Online players */}
      <Card variant="outlined">
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
              sx={{ color: md3?.onSurfaceVariant, py: 2 }}
            >
              暂无在线玩家
            </Typography>
          )}
        </CardContent>
      </Card>
    </Stack>
  );
}
