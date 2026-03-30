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
  IconButton,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
  alpha
} from "@mui/material";
import { useTheme, alpha as muiAlpha } from "@mui/material/styles";
import { Link } from "react-router-dom";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import DnsRoundedIcon from "@mui/icons-material/DnsRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import ScheduleRoundedIcon from "@mui/icons-material/ScheduleRounded";
import WifiRoundedIcon from "@mui/icons-material/WifiRounded";
import WifiOffRoundedIcon from "@mui/icons-material/WifiOffRounded";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import MetricCard from "../components/MetricCard";
import StatusPill, { StatusDot } from "../components/StatusPill";
import { api, SOCKET_BASE } from "../api";
import { recreateChart, destroyChart } from "../utils/charts";
import { formatDuration, formatTime, toTimeLabel } from "../utils/format";

/**
 * 合并最新数据点到历史记录
 */
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

/**
 * 构建24小时可用性热力图数据
 */
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

    rows.push({
      key: hourStart.toISOString(),
      hour: hourStart.getHours(),
      total,
      level
    });
  }

  return rows;
}

/**
 * Material You 风格的服务器总览页面
 */
export default function ServerPage() {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
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

  /**
   * 渲染图表
   */
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

    // 延迟图表
    const latencyDatasets = Object.entries(history.latencies || {}).map(([name, values], i) => {
      const palette = theme.custom?.charts?.series || [
        theme.palette.primary.main,
        theme.palette.success.main,
        theme.palette.secondary.main
      ];
      return {
        label: name,
        data: values,
        borderColor: palette[i % palette.length],
        backgroundColor: "transparent",
        pointRadius: 0,
        borderWidth: 2.5,
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
        plugins: {
          legend: {
            display: true,
            position: "top",
            labels: {
              usePointStyle: true,
              pointStyle: "circle",
              padding: 16,
              font: { family: theme.typography.fontFamily, size: 12 }
            }
          }
        },
        scales: {
          x: { grid: { display: false } },
          y: { grid: { color: theme.custom?.charts?.grid || "rgba(0,0,0,0.06)" } }
        }
      }
    });

    // 玩家图表
    recreateChart(playersChart, playersCanvas.current, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "在线玩家",
            data: history.players_online || [],
            borderColor: theme.palette.success.main,
            backgroundColor: muiAlpha(theme.palette.success.main, 0.15),
            fill: true,
            tension: 0.35,
            pointRadius: 0,
            borderWidth: 2.5
          },
          {
            label: "最大玩家",
            data: history.players_max || [],
            borderColor: theme.palette.secondary.main,
            borderDash: [5, 5],
            fill: false,
            tension: 0.35,
            pointRadius: 0,
            borderWidth: 2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: "top",
            labels: {
              usePointStyle: true,
              pointStyle: "circle",
              padding: 16,
              font: { family: theme.typography.fontFamily, size: 12 }
            }
          }
        },
        scales: {
          x: { grid: { display: false } },
          y: {
            beginAtZero: true,
            grid: { color: theme.custom?.charts?.grid || "rgba(0,0,0,0.06)" },
            ticks: { precision: 0 }
          }
        }
      }
    });

    // 状态图表
    recreateChart(statusChart, statusCanvas.current, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "在线状态",
            data: online,
            borderColor: theme.palette.primary.main,
            backgroundColor: muiAlpha(theme.palette.primary.main, 0.18),
            stepped: true,
            fill: true,
            pointRadius: 0,
            borderWidth: 2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: "top",
            labels: {
              usePointStyle: true,
              pointStyle: "circle",
              padding: 16,
              font: { family: theme.typography.fontFamily, size: 12 }
            }
          }
        },
        scales: {
          x: { grid: { display: false } },
          y: {
            min: 0,
            max: 1,
            grid: { color: theme.custom?.charts?.grid || "rgba(0,0,0,0.06)" },
            ticks: {
              callback: (v) => (v === 1 ? "在线" : "离线")
            }
          }
        }
      }
    });
  };

  /**
   * 加载完整数据
   */
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
      transports: ["websocket"]
    });

    socket.on("connect", () => setSocketStatus("connected"));
    socket.on("disconnect", () => setSocketStatus("disconnected"));
    socket.on("poll_complete", async () => {
      try {
        const head = await api.server.head(hours);
        setPayload((prev) => {
          if (!prev) return prev;
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

  // 热力图颜色映射
  const getHeatmapColor = (level) => {
    const colors = {
      high: isDark ? theme.palette.success.dark : theme.palette.success.main,
      mid: isDark ? theme.palette.warning.dark : theme.palette.warning.main,
      low: isDark ? theme.palette.error.dark : theme.palette.error.main,
      none: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)"
    };
    return colors[level] || colors.none;
  };

  return (
    <Stack spacing={3}>
      {/* 页面标题栏 */}
      <Stack
        direction={{ xs: "column", md: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", md: "center" }}
        spacing={2}
      >
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 2,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              bgcolor: isDark
                ? muiAlpha(theme.palette.primary.main, 0.18)
                : muiAlpha(theme.palette.primary.main, 0.1)
            }}
          >
            <HomeRoundedIcon color="primary" />
          </Box>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 600 }}>
              服务器总览
            </Typography>
            <Typography variant="body2" color="text.secondary">
              实时监控服务器状态与性能指标
            </Typography>
          </Box>
        </Stack>

        <Stack direction="row" spacing={1.5} alignItems="center">
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel id="hours-select">时间范围</InputLabel>
            <Select
              labelId="hours-select"
              value={hours}
              label="时间范围"
              onChange={(e) => setHours(Number(e.target.value))}
            >
              <MenuItem value={3}>3 小时</MenuItem>
              <MenuItem value={6}>6 小时</MenuItem>
              <MenuItem value={12}>12 小时</MenuItem>
              <MenuItem value={24}>24 小时</MenuItem>
              <MenuItem value={48}>48 小时</MenuItem>
              <MenuItem value={72}>72 小时</MenuItem>
            </Select>
          </FormControl>
          <Button
            variant="contained"
            startIcon={<RefreshRoundedIcon />}
            onClick={loadFull}
            disabled={loading}
          >
            刷新
          </Button>
        </Stack>
      </Stack>

      {/* 加载状态 */}
      {loading && <LinearProgress sx={{ borderRadius: 1 }} />}

      {/* 错误提示 */}
      {error && (
        <Alert severity="error" sx={{ borderRadius: 3 }}>
          {error}
        </Alert>
      )}

      {/* 统计卡片 */}
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="服务状态"
            value={head.online ? "在线" : "离线"}
            hint={`WebSocket: ${socketStatus}`}
            icon={head.online ? <WifiRoundedIcon /> : <WifiOffRoundedIcon />}
            color={head.online ? "success" : "error"}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="在线节点"
            value={`${onlineNodes}/${nodes.length}`}
            hint="活跃入口节点"
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
            hint={payload?.config?.server_name || "MotdTracker"}
            icon={<ScheduleRoundedIcon />}
            color="primary"
          />
        </Grid>
      </Grid>

      {/* 热力图卡片 */}
      <Card elevation={0}>
        <CardContent sx={{ p: 3 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              24小时可用性
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <Box sx={{ width: 12, height: 12, borderRadius: 1, bgcolor: getHeatmapColor("high") }} />
              <Typography variant="caption" color="text.secondary">在线</Typography>
              <Box sx={{ width: 12, height: 12, borderRadius: 1, bgcolor: getHeatmapColor("mid"), ml: 1 }} />
              <Typography variant="caption" color="text.secondary">部分</Typography>
              <Box sx={{ width: 12, height: 12, borderRadius: 1, bgcolor: getHeatmapColor("low"), ml: 1 }} />
              <Typography variant="caption" color="text.secondary">离线</Typography>
            </Stack>
          </Stack>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(24, 1fr)",
              gap: 0.75
            }}
          >
            {heatmap.map((cell) => (
              <Tooltip
                key={cell.key}
                title={`${cell.hour}:00 - ${cell.total > 0 ? (cell.level === "high" ? "全部在线" : cell.level === "mid" ? "部分在线" : "全部离线") : "无数据"}`}
                arrow
              >
                <Box
                  sx={{
                    height: 24,
                    borderRadius: 1.5,
                    border: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}`,
                    bgcolor: getHeatmapColor(cell.level),
                    transition: theme.transitions.create(["transform", "opacity"], {
                      duration: theme.transitions.duration.short
                    }),
                    cursor: "pointer",
                    "&:hover": {
                      transform: "scaleY(1.2)",
                      opacity: 0.85
                    }
                  }}
                />
              </Tooltip>
            ))}
          </Box>
        </CardContent>
      </Card>

      {/* 节点状态表格 */}
      <Card elevation={0}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
            节点实时状态
          </Typography>
          <Table>
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
                    <StatusPill online={node.latest_status?.online} size="small" />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {node.latest_status?.latency
                        ? `${Math.round(node.latest_status.latency)}ms`
                        : "-"}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {node.latest_status?.players_online ?? 0}/{node.latest_status?.players_max ?? 0}
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

      {/* 图表区域 */}
      <Grid container spacing={2}>
        <Grid item xs={12} md={8}>
          <Card elevation={0} sx={{ height: "100%" }}>
            <CardContent sx={{ p: 3, height: "100%", display: "flex", flexDirection: "column" }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                节点延迟趋势
              </Typography>
              <Box sx={{ flex: 1, minHeight: 280 }}>
                <canvas ref={latencyCanvas} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card elevation={0} sx={{ height: "100%" }}>
            <CardContent sx={{ p: 3, height: "100%", display: "flex", flexDirection: "column" }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                在线状态趋势
              </Typography>
              <Box sx={{ flex: 1, minHeight: 280 }}>
                <canvas ref={statusCanvas} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <Card elevation={0}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                玩家数量趋势
              </Typography>
              <Box sx={{ height: 260 }}>
                <canvas ref={playersCanvas} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* 在线玩家列表 */}
        <Grid item xs={12}>
          <Card elevation={0}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                当前在线玩家
              </Typography>
              <Stack direction="row" flexWrap="wrap" gap={1}>
                {players.length > 0 ? (
                  players.map((p) => (
                    <Chip
                      key={p.player_name}
                      component={Link}
                      clickable
                      to={`/players/${encodeURIComponent(p.player_name)}`}
                      label={`${p.player_name} · ${p.online ? formatDuration(p.duration_seconds || 0) : "离线"}`}
                      variant="outlined"
                      sx={{
                        borderRadius: 3,
                        "&:hover": {
                          bgcolor: isDark
                            ? muiAlpha(theme.palette.primary.main, 0.12)
                            : muiAlpha(theme.palette.primary.main, 0.08)
                        }
                      }}
                    />
                  ))
                ) : (
                  <Typography color="text.secondary" sx={{ py: 2 }}>
                    暂无在线玩家
                  </Typography>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Stack>
  );
}
