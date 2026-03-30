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
  Grid,
  LinearProgress,
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
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import AccessTimeRoundedIcon from "@mui/icons-material/AccessTimeRounded";
import ScheduleRoundedIcon from "@mui/icons-material/ScheduleRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import MetricCard from "../components/MetricCard";
import StatusPill, { StatusDot } from "../components/StatusPill";
import { api, SOCKET_BASE } from "../api";
import { recreateChart, destroyChart } from "../utils/charts";
import { formatDuration, formatTime } from "../utils/format";

/**
 * 构建24小时热力块数据
 */
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

/**
 * 周热力图单元格颜色
 */
function weeklyCellColor(value, max, theme, isDark) {
  const x = max > 0 ? value / max : 0;
  if (x > 0.7) {
    return isDark ? theme.palette.success.dark : theme.palette.success.main;
  }
  if (x > 0.45) {
    return isDark
      ? alpha(theme.palette.success.main, 0.6)
      : theme.palette.success.light;
  }
  if (x > 0.1) {
    return isDark
      ? alpha(theme.palette.success.main, 0.28)
      : alpha(theme.palette.success.main, 0.3);
  }
  return isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)";
}

/**
 * Material You 风格的玩家详情页面
 */
export default function PlayerDetailPage() {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
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

  /**
   * 绘制图表
   */
  const drawCharts = (sessionsData, weeklyData) => {
    const hourly = sessionsData?.hourly_average || [];
    const daily = [...(sessionsData?.daily || [])].sort((a, b) => a.date.localeCompare(b.date));
    const weekday = weeklyData?.weekday_preference || [];

    // 每小时平均在线图表
    recreateChart(hourlyChart, hourlyCanvas.current, {
      type: "bar",
      data: {
        labels: hourly.map((h) => `${String(h.hour).padStart(2, "0")}:00`),
        datasets: [
          {
            label: "每小时平均在线(分钟)",
            data: hourly.map((h) => Number(h.avg_seconds || 0) / 60),
            backgroundColor: alpha(theme.palette.secondary.main, 0.7),
            borderColor: theme.palette.secondary.main,
            borderWidth: 1,
            borderRadius: 4
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
            grid: { color: theme.custom?.charts?.grid || "rgba(0,0,0,0.06)" }
          }
        }
      }
    });

    // 每日在线趋势图表
    recreateChart(dailyChart, dailyCanvas.current, {
      type: "bar",
      data: {
        labels: daily.map((d) =>
          new Date(d.date).toLocaleDateString("zh-CN", { month: "short", day: "numeric" })
        ),
        datasets: [
          {
            label: "每日在线时长",
            data: daily.map((d) => Number(d.total_seconds || 0)),
            backgroundColor: alpha(theme.palette.success.main, 0.7),
            borderColor: theme.palette.success.main,
            borderWidth: 1,
            borderRadius: 4
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
          },
          tooltip: {
            callbacks: {
              label: (ctx) => `在线时长: ${formatDuration(ctx.parsed.y || 0)}`
            }
          }
        },
        scales: {
          x: { grid: { display: false } },
          y: {
            beginAtZero: true,
            grid: { color: theme.custom?.charts?.grid || "rgba(0,0,0,0.06)" }
          }
        }
      }
    });

    // 星期偏好图表
    recreateChart(weekdayChart, weekdayCanvas.current, {
      type: "bar",
      data: {
        labels: weekday.map((w) => w.day_name),
        datasets: [
          {
            label: "星期偏好",
            data: weekday.map((w) => Number(w.avg_seconds || 0)),
            backgroundColor: alpha(theme.palette.primary.main, 0.7),
            borderColor: theme.palette.primary.main,
            borderWidth: 1,
            borderRadius: 4
          }
        ]
      },
      options: {
        indexAxis: "y",
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
          },
          tooltip: {
            callbacks: {
              label: (ctx) => `平均在线: ${formatDuration(ctx.parsed.x || 0)}`
            }
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            grid: { color: theme.custom?.charts?.grid || "rgba(0,0,0,0.06)" }
          },
          y: { grid: { display: false } }
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
    const socket = io(SOCKET_BASE, {
      path: "/api/socket.io",
      transports: ["websocket"]
    });
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

  const weeklyMax = useMemo(
    () =>
      Math.max(
        ...(weekly?.weekly_heatmap || []).map((i) => i.avg_seconds || 0),
        1
      ),
    [weekly]
  );

  const recentSessions = useMemo(() => {
    const rows = [];
    (sessions?.daily || []).forEach((d) => {
      (d.sessions || []).forEach((s) => {
        rows.push({
          start: s.start,
          end: s.end,
          server_name: s.server_name || "默认"
        });
      });
    });
    return rows.sort((a, b) => new Date(b.start) - new Date(a.start)).slice(0, 20);
  }, [sessions]);

  // 24小时热力图颜色映射
  const get24hColor = (seconds, max) => {
    const ratio = seconds / max;
    if (ratio > 0.7) {
      return isDark ? theme.palette.success.dark : theme.palette.success.main;
    }
    if (ratio > 0.4) {
      return isDark
        ? alpha(theme.palette.success.main, 0.6)
        : theme.palette.success.light;
    }
    if (ratio > 0) {
      return isDark
        ? alpha(theme.palette.success.main, 0.28)
        : alpha(theme.palette.success.main, 0.3);
    }
    return isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)";
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
            to="/players"
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
              bgcolor: summary?.online
                ? isDark
                  ? alpha(theme.palette.success.main, 0.18)
                  : alpha(theme.palette.success.main, 0.12)
                : isDark
                  ? alpha(theme.palette.surface?.variant || "#444", 0.3)
                  : alpha(theme.palette.text.disabled, 0.08)
            }}
          >
            <PersonRoundedIcon
              sx={{
                color: summary?.online
                  ? isDark
                    ? theme.palette.success.light
                    : theme.palette.success.dark
                  : "text.disabled"
              }}
            />
          </Box>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 600 }}>
              玩家详情
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {name}
            </Typography>
          </Box>
        </Stack>

        <Button
          variant="contained"
          startIcon={<RefreshRoundedIcon />}
          onClick={loadFull}
          disabled={loading}
        >
          刷新
        </Button>
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
            title="当前状态"
            value={summary?.online ? "在线" : "离线"}
            icon={summary?.online ? <AccessTimeRoundedIcon /> : <AccessTimeRoundedIcon />}
            color={summary?.online ? "success" : "error"}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="当前会话"
            value={summary?.online ? formatDuration(summary.duration_seconds || 0) : "-"}
            icon={<ScheduleRoundedIcon />}
            color="primary"
            hint={summary?.online ? "正在游戏" : "未在线"}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="最后在线"
            value={formatTime(summary?.last_seen)}
            icon={<HistoryRoundedIcon />}
            color="primary"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="样本天数"
            value={weekly?.total_sample_days ?? 0}
            icon={<CalendarMonthRoundedIcon />}
            color="primary"
            hint="统计数据范围"
          />
        </Grid>
      </Grid>

      {/* 24小时活跃热力图 */}
      <Card elevation={0}>
        <CardContent sx={{ p: 3 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              过去24小时活跃热力
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <Box sx={{ width: 12, height: 12, borderRadius: 1, bgcolor: get24hColor(blocks24hMax, blocks24hMax) }} />
              <Typography variant="caption" color="text.secondary">活跃</Typography>
              <Box sx={{ width: 12, height: 12, borderRadius: 1, bgcolor: get24hColor(0, 1), ml: 1 }} />
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
            {blocks24h.map((seconds, idx) => (
              <Tooltip
                key={idx}
                title={seconds > 0 ? formatDuration(seconds) : "离线"}
                arrow
              >
                <Box
                  sx={{
                    height: 20,
                    borderRadius: 1.5,
                    border: seconds > 0
                      ? `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)"}`
                      : "none",
                    bgcolor: get24hColor(seconds, blocks24hMax),
                    transition: theme.transitions.create(["transform", "opacity"], {
                      duration: theme.transitions.duration.short
                    }),
                    cursor: "pointer",
                    "&:hover": {
                      transform: "scaleY(1.3)",
                      opacity: 0.85
                    }
                  }}
                />
              </Tooltip>
            ))}
          </Box>
          <Stack direction="row" justifyContent="space-between" mt={1}>
            <Typography variant="caption" sx={{ fontSize: "0.625rem", color: "text.disabled" }}>
              24小时前
            </Typography>
            <Typography variant="caption" sx={{ fontSize: "0.625rem", color: "text.disabled" }}>
              现在
            </Typography>
          </Stack>
        </CardContent>
      </Card>

      {/* 图表区域 */}
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Card elevation={0} sx={{ height: "100%" }}>
            <CardContent sx={{ p: 3, height: "100%", display: "flex", flexDirection: "column" }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                每小时平均在线
              </Typography>
              <Box sx={{ flex: 1, minHeight: 260 }}>
                <canvas ref={hourlyCanvas} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card elevation={0} sx={{ height: "100%" }}>
            <CardContent sx={{ p: 3, height: "100%", display: "flex", flexDirection: "column" }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                星期偏好
              </Typography>
              <Box sx={{ flex: 1, minHeight: 260 }}>
                <canvas ref={weekdayCanvas} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12}>
          <Card elevation={0}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                30天在线趋势
              </Typography>
              <Box sx={{ height: 260 }}>
                <canvas ref={dailyCanvas} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* 周活跃热力图 */}
      <Card elevation={0}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
            周活跃热力图
          </Typography>
          <Box sx={{ overflowX: "auto" }}>
            <Box
              sx={{
                minWidth: 740,
                display: "grid",
                gridTemplateColumns: "60px repeat(24, 1fr)",
                gap: 0.5
              }}
            >
              {/* 时间标题行 */}
              <Box />
              {Array.from({ length: 24 }).map((_, h) => (
                <Typography
                  key={h}
                  variant="caption"
                  color="text.disabled"
                  align="center"
                  sx={{ fontSize: "0.625rem" }}
                >
                  {h}
                </Typography>
              ))}

              {/* 每日热力行 */}
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
                  <Typography
                    variant="caption"
                    sx={{
                      fontSize: "0.75rem",
                      lineHeight: "20px",
                      display: "flex",
                      alignItems: "center",
                      color: "text.secondary",
                      fontWeight: 500
                    }}
                  >
                    {row.label}
                  </Typography>
                  {Array.from({ length: 24 }).map((_, hour) => {
                    const value = weeklyMap?.[row.day]?.[hour] || 0;
                    return (
                      <Tooltip
                        key={`${row.day}-${hour}`}
                        title={value > 0 ? formatDuration(value) : "无数据"}
                        arrow
                      >
                        <Box
                          sx={{
                            height: 20,
                            borderRadius: 0.75,
                            border: value > 0
                              ? `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)"}`
                              : "none",
                            bgcolor: weeklyCellColor(value, weeklyMax, theme, isDark),
                            transition: theme.transitions.create(["transform", "opacity"], {
                              duration: theme.transitions.duration.short
                            }),
                            cursor: "pointer",
                            "&:hover": {
                              transform: "scale(1.1)",
                              opacity: 0.85
                            }
                          }}
                        />
                      </Tooltip>
                    );
                  })}
                </Box>
              ))}
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* 最近会话表格 */}
      <Card elevation={0}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
            最近会话（20条）
          </Typography>
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
                const start = new Date(s.start);
                const end = new Date(s.end);
                const seconds = Math.max(0, Math.floor((end - start) / 1000));
                return (
                  <TableRow key={`${s.start}-${idx}`}>
                    <TableCell>{formatTime(s.start)}</TableCell>
                    <TableCell>{formatTime(s.end)}</TableCell>
                    <TableCell>
                      <Chip
                        label={formatDuration(seconds)}
                        size="small"
                        sx={{
                          borderRadius: 1.5,
                          fontSize: "0.75rem",
                          height: 24
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {s.server_name}
                      </Typography>
                    </TableCell>
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
