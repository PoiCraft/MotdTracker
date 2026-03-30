import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  FormControl,
  Grid,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { Link } from "react-router-dom";
import { api, SOCKET_BASE } from "../api";
import { recreateChart, destroyChart } from "../utils/charts";
import { formatDuration, formatTime, toTimeLabel } from "../utils/format";

function mergeLatestPoint(history, latestPoint) {
  if (!history || !latestPoint?.timestamp) {
    return history;
  }
  const next = {
    ...history,
    timestamps: [...(history.timestamps || [])],
    online: [...(history.online || [])],
    players_online: [...(history.players_online || [])],
    players_max: [...(history.players_max || [])],
    latencies: Object.fromEntries(
      Object.entries(history.latencies || {}).map(([k, arr]) => [k, [...arr]])
    )
  };

  const index = next.timestamps.indexOf(latestPoint.timestamp);
  const allNodes = new Set([
    ...Object.keys(next.latencies || {}),
    ...Object.keys(latestPoint.latencies || {})
  ]);

  if (index >= 0) {
    next.online[index] = Boolean(latestPoint.online);
    next.players_online[index] = latestPoint.players_online;
    next.players_max[index] = latestPoint.players_max;
    allNodes.forEach((name) => {
      if (!next.latencies[name]) {
        next.latencies[name] = Array(next.timestamps.length).fill(null);
      }
      next.latencies[name][index] = latestPoint.latencies?.[name] ?? null;
    });
    return next;
  }

  next.timestamps.push(latestPoint.timestamp);
  next.online.push(Boolean(latestPoint.online));
  next.players_online.push(latestPoint.players_online ?? 0);
  next.players_max.push(latestPoint.players_max ?? 0);

  allNodes.forEach((name) => {
    if (!next.latencies[name]) {
      next.latencies[name] = Array(next.timestamps.length - 1).fill(null);
    }
    next.latencies[name].push(latestPoint.latencies?.[name] ?? null);
  });

  return next;
}

function buildHeatmap(timeline) {
  const timestamps = timeline?.timestamps || [];
  const online = timeline?.online || [];
  const now = new Date();
  const rows = [];

  for (let i = 0; i < 24; i += 1) {
    const hourStart = new Date(now.getTime() - (23 - i) * 3600 * 1000);
    hourStart.setMinutes(0, 0, 0);
    const hourEnd = new Date(hourStart.getTime() + 3600 * 1000);

    let total = 0;
    let on = 0;
    for (let j = 0; j < timestamps.length; j += 1) {
      const t = new Date(timestamps[j]);
      if (t >= hourStart && t < hourEnd) {
        total += 1;
        if (online[j]) {
          on += 1;
        }
      }
    }

    let level = "none";
    if (total > 0) {
      if (on === total) {
        level = "high";
      } else if (on > 0) {
        level = "mid";
      } else {
        level = "low";
      }
    }

    rows.push({ key: hourStart.toISOString(), total, level });
  }

  return rows;
}

export default function ServerPage() {
  const theme = useTheme();
  const [hours, setHours] = useState(12);
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [socketStatus, setSocketStatus] = useState("connecting");

  const latencyCanvas = useRef(null);
  const playersCanvas = useRef(null);
  const statusCanvas = useRef(null);
  const latencyChart = useRef(null);
  const playersChart = useRef(null);
  const statusChart = useRef(null);

  const renderCharts = (data) => {
    const history = data?.history;
    if (!history?.timestamps?.length) {
      destroyChart(latencyChart);
      destroyChart(playersChart);
      destroyChart(statusChart);
      return;
    }

    const labels = history.timestamps.map((t) => toTimeLabel(t, hours));
    const online = (history.online || []).map((v) => (v ? 1 : 0));

    const latencyDatasets = Object.entries(history.latencies || {}).map(([name, values], i) => {
      const palette = theme.custom.charts.series;
      return {
        label: name,
        data: values,
        borderColor: palette[i % palette.length],
        backgroundColor: "transparent",
        pointRadius: 0,
        borderWidth: 2,
        tension: 0.35
      };
    });

    recreateChart(latencyChart, latencyCanvas.current, {
      type: "line",
      data: { labels, datasets: latencyDatasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "nearest", axis: "x", intersect: false },
        plugins: { legend: { display: true } }
      }
    });

    recreateChart(playersChart, playersCanvas.current, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "在线玩家",
            data: history.players_online || [],
            borderColor: theme.palette.success.main,
            backgroundColor: alpha(theme.palette.success.main, 0.15),
            fill: true,
            tension: 0.35,
            pointRadius: 0
          },
          {
            label: "最大玩家",
            data: history.players_max || [],
            borderColor: theme.palette.secondary.main,
            borderDash: [4, 4],
            fill: false,
            tension: 0.35,
            pointRadius: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
      }
    });

    recreateChart(statusChart, statusCanvas.current, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "在线状态",
            data: online,
            borderColor: theme.palette.primary.main,
            backgroundColor: alpha(theme.palette.primary.main, 0.18),
            stepped: true,
            fill: true,
            pointRadius: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            min: 0,
            max: 1,
            ticks: {
              callback: (v) => (v === 1 ? "在线" : "离线")
            }
          }
        }
      }
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
  }, [hours, theme]);

  useEffect(() => {
    const socket = io(SOCKET_BASE, {
      path: "/api/socket.io",
      transports: ["websocket"]
    });

    socket.on("connect", () => setSocketStatus("connected"));
    socket.on("disconnect", () => setSocketStatus("disconnected"));
    socket.on("poll_complete", async () => {
      try {
        const head = await api.server.head(hours);
        setPayload((prev) => {
          if (!prev) {
            return prev;
          }
          const next = {
            ...prev,
            ...head,
            history: mergeLatestPoint(prev.history, head.latest_history_point)
          };
          renderCharts(next);
          return next;
        });
      } catch {
        // noop
      }
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
  const heatmap = useMemo(() => buildHeatmap(payload?.status_timeline), [payload]);

  const onlineNodes = nodes.filter((item) => item.latest_status?.online).length;

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", md: "center" }} spacing={1}>
        <Typography variant="h4">服务器总览</Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <FormControl size="small" sx={{ minWidth: 130 }}>
            <InputLabel id="hours-select">时间范围</InputLabel>
            <Select labelId="hours-select" value={hours} label="时间范围" onChange={(e) => setHours(Number(e.target.value))}>
              <MenuItem value={3}>3 小时</MenuItem>
              <MenuItem value={6}>6 小时</MenuItem>
              <MenuItem value={12}>12 小时</MenuItem>
              <MenuItem value={24}>24 小时</MenuItem>
              <MenuItem value={48}>48 小时</MenuItem>
              <MenuItem value={72}>72 小时</MenuItem>
            </Select>
          </FormControl>
          <Button variant="contained" onClick={loadFull}>刷新</Button>
        </Stack>
      </Stack>

      {loading ? <LinearProgress /> : null}
      {error ? <Alert severity="error">{error}</Alert> : null}

      <Grid container spacing={1.5}>
        <Grid item xs={12} sm={6} md={3}>
          <Card><CardContent>
            <Typography variant="overline" color="text.secondary">状态</Typography>
            <Typography variant="h5">{head.online ? "在线" : "离线"}</Typography>
            <Typography variant="body2" color="text.secondary">Socket: {socketStatus}</Typography>
          </CardContent></Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card><CardContent>
            <Typography variant="overline" color="text.secondary">在线节点</Typography>
            <Typography variant="h5">{onlineNodes}/{nodes.length}</Typography>
            <Typography variant="body2" color="text.secondary">活跃入口</Typography>
          </CardContent></Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card><CardContent>
            <Typography variant="overline" color="text.secondary">在线玩家</Typography>
            <Typography variant="h5">{head.players_online ?? 0}</Typography>
            <Typography variant="body2" color="text.secondary">玩家池: {players.length}</Typography>
          </CardContent></Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card><CardContent>
            <Typography variant="overline" color="text.secondary">最后更新时间</Typography>
            <Typography variant="h6">{formatTime(head.timestamp)}</Typography>
            <Typography variant="body2" color="text.secondary">{payload?.config?.server_name || "MotdTracker"}</Typography>
          </CardContent></Card>
        </Grid>
      </Grid>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>24h 可用性热力</Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(24, 1fr)", gap: 0.5 }}>
            {heatmap.map((cell) => (
              <Box
                key={cell.key}
                sx={{
                  height: 16,
                  borderRadius: 1,
                  border: "1px solid",
                  borderColor: "divider",
                  bgcolor: cell.level === "high"
                    ? "success.light"
                    : cell.level === "mid"
                      ? "warning.light"
                      : cell.level === "low"
                        ? "error.light"
                        : "action.hover"
                }}
              />
            ))}
          </Box>
        </CardContent>
      </Card>

      <Grid container spacing={1.5}>
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>节点实时状态</Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>节点</TableCell>
                    <TableCell>状态</TableCell>
                    <TableCell>延迟</TableCell>
                    <TableCell>玩家</TableCell>
                    <TableCell>入口</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {nodes.map((node) => (
                    <TableRow key={node.id}>
                      <TableCell>{node.name}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={node.latest_status?.online ? "在线" : "离线"}
                          color={node.latest_status?.online ? "success" : "default"}
                        />
                      </TableCell>
                      <TableCell>{node.latest_status?.latency ? `${Math.round(node.latest_status.latency)}ms` : "-"}</TableCell>
                      <TableCell>{node.latest_status?.players_online ?? 0}/{node.latest_status?.players_max ?? 0}</TableCell>
                      <TableCell>
                        <Link to={`/nodes/${node.id}`}>详情</Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>节点延迟趋势</Typography>
              <Box sx={{ height: 280 }}><canvas ref={latencyCanvas} /></Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>在线状态趋势</Typography>
              <Box sx={{ height: 280 }}><canvas ref={statusCanvas} /></Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>玩家趋势</Typography>
              <Box sx={{ height: 260 }}><canvas ref={playersCanvas} /></Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>当前在线玩家</Typography>
              <Stack direction="row" flexWrap="wrap" gap={1}>
                {players.length
                  ? players.map((p) => (
                      <Chip
                        key={p.player_name}
                        component={Link}
                        clickable
                        to={`/players/${encodeURIComponent(p.player_name)}`}
                        label={`${p.player_name} · ${p.online ? formatDuration(p.duration_seconds || 0) : "离线"}`}
                        variant="outlined"
                      />
                    ))
                  : <Typography color="text.secondary">暂无在线玩家</Typography>}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Stack>
  );
}
