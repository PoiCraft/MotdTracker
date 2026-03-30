import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import { useParams, Link } from "react-router-dom";
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
  Tooltip,
  Typography,
  alpha
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import DnsRoundedIcon from "@mui/icons-material/DnsRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import SpeedRoundedIcon from "@mui/icons-material/SpeedRounded";
import PeopleRoundedIcon from "@mui/icons-material/PeopleRounded";
import ScheduleRoundedIcon from "@mui/icons-material/ScheduleRounded";
import WifiRoundedIcon from "@mui/icons-material/WifiRounded";
import WifiOffRoundedIcon from "@mui/icons-material/WifiOffRounded";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import PercentRoundedIcon from "@mui/icons-material/PercentRounded";
import MetricCard from "../components/MetricCard";
import StatusPill, { StatusDot } from "../components/StatusPill";
import { api, SOCKET_BASE } from "../api";
import { recreateChart, destroyChart } from "../utils/charts";
import { formatTime, toTimeLabel } from "../utils/format";

/**
 * 合并节点历史数据
 */
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

/**
 * 构建热力图数据
 */
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
    result.push({ key: hourStart.toISOString(), level, hour: hourStart.getHours() });
  }

  return result;
}

/**
 * Material You 风格的节点详情页面
 */
export default function NodeDetailPage() {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
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

    // 延迟图表
    recreateChart(latencyChart, latencyCanvas.current, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "延迟",
            data: history.latency || [],
            borderColor: theme.palette.secondary.main,
            backgroundColor: alpha(theme.palette.secondary.main, 0.15),
            fill: true,
            pointRadius: 0,
            tension: 0.35,
            borderWidth: 2.5
          }
        ]
      },
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
            backgroundColor: alpha(theme.palette.success.main, 0.15),
            fill: true,
            pointRadius: 0,
            tension: 0.35,
            borderWidth: 2.5
          },
          {
            label: "最大玩家",
            data: history.players_max || [],
            borderColor: theme.palette.text.secondary,
            borderDash: [5, 5],
            fill: false,
            pointRadius: 0,
            tension: 0.35,
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
            data: (history.online || []).map((v) => (v ? 1 : 0)),
            borderColor: theme.palette.primary.main,
            backgroundColor: alpha(theme.palette.primary.main, 0.18),
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
            ticks: { callback: (v) => (v === 1 ? "在线" : "离线") }
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
  }, [nodeId, hours]);

  useEffect(() => {
    const socket = io(SOCKET_BASE, {
      path: "/api/socket.io",
      transports: ["websocket"]
    });
    socket.on("poll_complete", async () => {
      try {
        const head = await api.node.head(nodeId, hours);
        setPayload((prev) => {
          if (!prev) return prev;
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
          <Button
            component={Link}
            to="/nodes"
            startIcon={<ArrowBackRoundedIcon />}
            sx={{
              borderRadius: 3,
              minWidth: "auto",
              px: 1.5
            }}
          >
            返回
          </Button>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 2,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              bgcolor: isDark
                ? alpha(theme.palette.primary.main, 0.18)
                : alpha(theme.palette.primary.main, 0.1)
            }}
          >
            <DnsRoundedIcon color="primary" />
          </Box>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 600 }}>
              节点详情
            </Typography>
            <Typography variant="body2" color="text.secondary">
              #{nodeId} · {node?.name || "未知节点"} · {node?.host}:{node?.port}
            </Typography>
          </Box>
        </Stack>

        <Stack direction="row" spacing={1.5} alignItems="center">
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel id="node-hours">时间范围</InputLabel>
            <Select
              labelId="node-hours"
              label="时间范围"
              value={hours}
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
            value={status?.online ? "在线" : "离线"}
            icon={status?.online ? <WifiRoundedIcon /> : <WifiOffRoundedIcon />}
            color={status?.online ? "success" : "error"}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="当前延迟"
            value={status?.latency ? `${Math.round(status.latency)}ms` : "-"}
            icon={<SpeedRoundedIcon />}
            color="primary"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="在线玩家"
            value={`${status?.players_online ?? 0}/${status?.players_max ?? 0}`}
            icon={<PeopleRoundedIcon />}
            color="success"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="最近采样"
            value={formatTime(status?.timestamp)}
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
                title={`${cell.hour}:00 - ${cell.level === "high" ? "在线" : cell.level === "mid" ? "部分在线" : cell.level === "low" ? "离线" : "无数据"}`}
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

      {/* 图表区域 */}
      <Grid container spacing={2}>
        <Grid item xs={12} md={8}>
          <Card elevation={0} sx={{ height: "100%" }}>
            <CardContent sx={{ p: 3, height: "100%", display: "flex", flexDirection: "column" }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                延迟趋势
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
                在线状态
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
      </Grid>

      {/* 统计摘要 */}
      <Card elevation={0}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
            统计摘要
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <Box
                sx={{
                  p: 2,
                  borderRadius: 3,
                  bgcolor: isDark
                    ? alpha(theme.palette.primary.main, 0.08)
                    : alpha(theme.palette.primary.main, 0.04)
                }}
              >
                <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                  <PercentRoundedIcon sx={{ fontSize: 18, color: "primary.main" }} />
                  <Typography variant="caption" color="text.secondary">在线率</Typography>
                </Stack>
                <Typography variant="h5" sx={{ fontWeight: 600 }}>
                  {stats.uptime_percentage !== undefined
                    ? `${Number(stats.uptime_percentage).toFixed(1)}%`
                    : "-"}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Box
                sx={{
                  p: 2,
                  borderRadius: 3,
                  bgcolor: isDark
                    ? alpha(theme.palette.success.main, 0.08)
                    : alpha(theme.palette.success.main, 0.04)
                }}
              >
                <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                  <TrendingUpRoundedIcon sx={{ fontSize: 18, color: "success.main" }} />
                  <Typography variant="caption" color="text.secondary">平均延迟</Typography>
                </Stack>
                <Typography variant="h5" sx={{ fontWeight: 600 }}>
                  {stats.avg_latency ? `${Math.round(stats.avg_latency)}ms` : "-"}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Box
                sx={{
                  p: 2,
                  borderRadius: 3,
                  bgcolor: isDark
                    ? alpha(theme.palette.warning.main, 0.08)
                    : alpha(theme.palette.warning.main, 0.04)
                }}
              >
                <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                  <SpeedRoundedIcon sx={{ fontSize: 18, color: "warning.main" }} />
                  <Typography variant="caption" color="text.secondary">P95 延迟</Typography>
                </Stack>
                <Typography variant="h5" sx={{ fontWeight: 600 }}>
                  {stats.p95_latency ? `${Math.round(stats.p95_latency)}ms` : "-"}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Box
                sx={{
                  p: 2,
                  borderRadius: 3,
                  bgcolor: isDark
                    ? alpha(theme.palette.secondary.main, 0.08)
                    : alpha(theme.palette.secondary.main, 0.04)
                }}
              >
                <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                  <TrendingUpRoundedIcon sx={{ fontSize: 18, color: "secondary.main" }} />
                  <Typography variant="caption" color="text.secondary">波动系数 CV</Typography>
                </Stack>
                <Typography variant="h5" sx={{ fontWeight: 600 }}>
                  {stats.cv !== undefined && stats.cv !== null
                    ? `${Number(stats.cv).toFixed(1)}%`
                    : "-"}
                </Typography>
              </Box>
            </Grid>
          </Grid>

          {/* 详细统计表格 */}
          <Table size="small" sx={{ mt: 3 }}>
            <TableHead>
              <TableRow>
                <TableCell>指标</TableCell>
                <TableCell>值</TableCell>
                <TableCell>说明</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow>
                <TableCell>在线率</TableCell>
                <TableCell>{stats.uptime_percentage !== undefined ? `${Number(stats.uptime_percentage).toFixed(1)}%` : "-"}</TableCell>
                <TableCell>统计时间范围内的在线时间占比</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>平均延迟</TableCell>
                <TableCell>{stats.avg_latency ? `${Math.round(stats.avg_latency)}ms` : "-"}</TableCell>
                <TableCell>所有成功请求的平均响应时间</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>P95 延迟</TableCell>
                <TableCell>{stats.p95_latency ? `${Math.round(stats.p95_latency)}ms` : "-"}</TableCell>
                <TableCell>95% 的请求延迟低于此值</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>波动系数 CV</TableCell>
                <TableCell>{stats.cv !== undefined && stats.cv !== null ? `${Number(stats.cv).toFixed(1)}%` : "-"}</TableCell>
                <TableCell>延迟标准差与平均值的比率，越小越稳定</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </Stack>
  );
}
