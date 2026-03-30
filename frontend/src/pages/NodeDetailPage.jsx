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
import { api, SOCKET_BASE } from "../api";
import { recreateChart, destroyChart } from "../utils/charts";
import { formatTime, toTimeLabel } from "../utils/format";

function mergeNodeHistory(history, latestPoint) {
  if (!history || !latestPoint?.timestamp) {
    return history;
  }
  const next = {
    ...history,
    timestamps: [...(history.timestamps || [])],
    online: [...(history.online || [])],
    latency: [...(history.latency || [])],
    players_online: [...(history.players_online || [])],
    players_max: [...(history.players_max || [])]
  };

  const idx = next.timestamps.indexOf(latestPoint.timestamp);
  if (idx >= 0) {
    next.online[idx] = Boolean(latestPoint.online);
    next.latency[idx] = latestPoint.latency ?? null;
    next.players_online[idx] = latestPoint.players_online ?? 0;
    next.players_max[idx] = latestPoint.players_max ?? 0;
    return next;
  }

  next.timestamps.push(latestPoint.timestamp);
  next.online.push(Boolean(latestPoint.online));
  next.latency.push(latestPoint.latency ?? null);
  next.players_online.push(latestPoint.players_online ?? 0);
  next.players_max.push(latestPoint.players_max ?? 0);
  return next;
}

function buildHeatmap(timeline) {
  const timestamps = timeline?.timestamps || [];
  const online = timeline?.online || [];
  const now = new Date();
  const result = [];

  for (let i = 0; i < 24; i += 1) {
    const hourStart = new Date(now.getTime() - (23 - i) * 3600 * 1000);
    hourStart.setMinutes(0, 0, 0);
    const hourEnd = new Date(hourStart.getTime() + 3600 * 1000);
    let total = 0;
    let up = 0;

    for (let j = 0; j < timestamps.length; j += 1) {
      const t = new Date(timestamps[j]);
      if (t >= hourStart && t < hourEnd) {
        total += 1;
        if (online[j]) {
          up += 1;
        }
      }
    }

    const level = total === 0 ? "none" : up === total ? "high" : up > 0 ? "mid" : "low";
    result.push({ key: hourStart.toISOString(), level });
  }

  return result;
}

export default function NodeDetailPage() {
  const theme = useTheme();
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
    const history = data?.history;
    if (!history?.timestamps?.length) {
      destroyChart(latencyChart);
      destroyChart(playersChart);
      destroyChart(statusChart);
      return;
    }

    const labels = history.timestamps.map((t) => toTimeLabel(t, hours));

    recreateChart(latencyChart, latencyCanvas.current, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "延迟",
            data: history.latency || [],
            borderColor: theme.palette.secondary.main,
            backgroundColor: alpha(theme.palette.secondary.main, 0.16),
            fill: true,
            pointRadius: 0,
            tension: 0.35
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "nearest", axis: "x", intersect: false }
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
            backgroundColor: alpha(theme.palette.success.main, 0.16),
            fill: true,
            pointRadius: 0,
            tension: 0.35
          },
          {
            label: "最大玩家",
            data: history.players_max || [],
            borderColor: theme.palette.text.secondary,
            borderDash: [4, 4],
            fill: false,
            pointRadius: 0,
            tension: 0.35
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
            data: (history.online || []).map((v) => (v ? 1 : 0)),
            borderColor: theme.palette.primary.main,
            backgroundColor: alpha(theme.palette.primary.main, 0.16),
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
            ticks: { callback: (v) => (v === 1 ? "在线" : "离线") }
          }
        }
      }
    });
  };

  const loadFull = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.node.full(nodeId, hours);
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
  }, [nodeId, hours, theme]);

  useEffect(() => {
    const socket = io(SOCKET_BASE, { path: "/api/socket.io", transports: ["websocket"] });
    socket.on("poll_complete", async () => {
      try {
        const head = await api.node.head(nodeId, hours);
        setPayload((prev) => {
          if (!prev) {
            return prev;
          }
          const next = {
            ...prev,
            stats: head.stats || prev.stats,
            server: head.server || prev.server,
            status_timeline: head.status_timeline || prev.status_timeline,
            history: mergeNodeHistory(prev.history, head.latest_history_point)
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
  }, [nodeId, hours]);

  const node = payload?.server;
  const status = node?.latest_status;
  const stats = payload?.stats || {};
  const heatmap = useMemo(() => buildHeatmap(payload?.status_timeline), [payload]);

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", md: "center" }} spacing={1}>
        <Box>
          <Typography variant="h4">节点详情</Typography>
          <Typography color="text.secondary">#{nodeId} · {node?.name || "未知节点"}</Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <FormControl size="small" sx={{ minWidth: 130 }}>
            <InputLabel id="node-hours">时间范围</InputLabel>
            <Select labelId="node-hours" label="时间范围" value={hours} onChange={(e) => setHours(Number(e.target.value))}>
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
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="h5">{status?.online ? "在线" : "离线"}</Typography>
              <Chip size="small" color={status?.online ? "success" : "default"} label={status?.online ? "UP" : "DOWN"} />
            </Stack>
          </CardContent></Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card><CardContent>
            <Typography variant="overline" color="text.secondary">当前延迟</Typography>
            <Typography variant="h5">{status?.latency ? `${Math.round(status.latency)}ms` : "-"}</Typography>
          </CardContent></Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card><CardContent>
            <Typography variant="overline" color="text.secondary">在线玩家</Typography>
            <Typography variant="h5">{status?.players_online ?? 0}/{status?.players_max ?? 0}</Typography>
          </CardContent></Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card><CardContent>
            <Typography variant="overline" color="text.secondary">最近采样</Typography>
            <Typography variant="h6">{formatTime(status?.timestamp)}</Typography>
          </CardContent></Card>
        </Grid>
      </Grid>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>24h 在线热力</Typography>
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
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>延迟趋势</Typography>
              <Box sx={{ height: 280 }}><canvas ref={latencyCanvas} /></Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>在线状态</Typography>
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
      </Grid>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>统计摘要</Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>指标</TableCell>
                <TableCell>值</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow><TableCell>在线率</TableCell><TableCell>{stats.uptime_percentage !== undefined ? `${Number(stats.uptime_percentage).toFixed(1)}%` : "-"}</TableCell></TableRow>
              <TableRow><TableCell>平均延迟</TableCell><TableCell>{stats.avg_latency ? `${Math.round(stats.avg_latency)}ms` : "-"}</TableCell></TableRow>
              <TableRow><TableCell>P95</TableCell><TableCell>{stats.p95_latency ? `${Math.round(stats.p95_latency)}ms` : "-"}</TableCell></TableRow>
              <TableRow><TableCell>波动系数 CV</TableCell><TableCell>{stats.cv !== undefined && stats.cv !== null ? `${Number(stats.cv).toFixed(1)}%` : "-"}</TableCell></TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </Stack>
  );
}
