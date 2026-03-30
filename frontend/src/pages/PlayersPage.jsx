import { useEffect, useMemo, useState } from "react";
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
  InputAdornment,
  LinearProgress,
  Stack,
  TextField,
  Tooltip,
  Typography,
  alpha,
  useTheme
} from "@mui/material";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import AccessTimeRoundedIcon from "@mui/icons-material/AccessTimeRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import StatusPill, { StatusDot } from "../components/StatusPill";
import { api, SOCKET_BASE } from "../api";
import { formatDuration, formatTime } from "../utils/format";

/**
 * 将热力图数据转换为24小时块
 */
function to24hBlocks(heatmap) {
  if (!Array.isArray(heatmap) || heatmap.length === 0) {
    return Array(24).fill(0);
  }
  const now = Date.now();
  const start = now - 24 * 3600 * 1000;
  const blocks = Array(24).fill(0);

  heatmap.forEach((item) => {
    const hour = String(item.hour).padStart(2, "0");
    const ts = new Date(`${item.date}T${hour}:00:00`).getTime();
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
 * Material You 风格的热力条组件
 */
function HeatStrip({ blocks }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const max = Math.max(...blocks, 1);

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: "repeat(24, 1fr)",
        gap: 0.5
      }}
    >
      {blocks.map((seconds, idx) => {
        const intensity = seconds / max;
        let bgColor;
        if (intensity > 0.7) {
          bgColor = isDark
            ? alpha(theme.palette.success.main, 0.6)
            : theme.palette.success.main;
        } else if (intensity > 0.4) {
          bgColor = isDark
            ? alpha(theme.palette.success.main, 0.35)
            : alpha(theme.palette.success.main, 0.5);
        } else if (intensity > 0) {
          bgColor = isDark
            ? alpha(theme.palette.success.main, 0.18)
            : alpha(theme.palette.success.main, 0.2);
        } else {
          bgColor = isDark
            ? "rgba(255,255,255,0.04)"
            : "rgba(0,0,0,0.04)";
        }

        return (
          <Tooltip
            key={idx}
            title={seconds > 0 ? formatDuration(seconds) : "无数据"}
            arrow
            placement="top"
          >
            <Box
              sx={{
                height: 8,
                borderRadius: 0.75,
                bgcolor: bgColor,
                border: intensity > 0
                  ? `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)"}`
                  : "none",
                transition: theme.transitions.create(["transform", "opacity"], {
                  duration: theme.transitions.duration.short
                }),
                cursor: "pointer",
                "&:hover": {
                  transform: "scaleY(1.5)",
                  opacity: 0.85
                }
              }}
            />
          </Tooltip>
        );
      })}
    </Box>
  );
}

/**
 * Material You 风格的玩家卡片组件
 */
function PlayerCard({ player }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  return (
    <Card
      elevation={0}
      sx={{
        height: "100%",
        position: "relative",
        overflow: "hidden",
        transition: theme.transitions.create(["transform", "box-shadow"], {
          duration: theme.transitions.duration.short
        }),
        "&:hover": {
          transform: "translateY(-4px)",
          boxShadow: theme.shadows[4]
        }
      }}
    >
      {/* 顶部状态条 */}
      <Box
        sx={{
          height: 3,
          bgcolor: player.online
            ? isDark
              ? alpha(theme.palette.success.main, 0.6)
              : theme.palette.success.main
            : "transparent"
        }}
      />

      <CardContent sx={{ p: 2.5 }}>
        <Stack spacing={1.5}>
          {/* 玩家标题 */}
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Stack direction="row" alignItems="center" spacing={1.25}>
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: 2,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  bgcolor: player.online
                    ? isDark
                      ? alpha(theme.palette.success.main, 0.18)
                      : alpha(theme.palette.success.main, 0.12)
                    : isDark
                      ? alpha(theme.palette.surface?.variant || "#444", 0.3)
                      : alpha(theme.palette.text.disabled, 0.08),
                  color: player.online
                    ? isDark
                      ? theme.palette.success.light
                      : theme.palette.success.dark
                    : "text.disabled"
                }}
              >
                <PersonRoundedIcon sx={{ fontSize: 20 }} />
              </Box>
              <Typography
                component={Link}
                to={`/players/${encodeURIComponent(player.player_name)}`}
                sx={{
                  fontWeight: 600,
                  fontSize: "0.9375rem",
                  textDecoration: "none",
                  color: "text.primary",
                  "&:hover": {
                    color: "primary.main"
                  }
                }}
              >
                {player.player_name}
              </Typography>
            </Stack>
            <StatusPill online={player.online} size="small" />
          </Stack>

          {/* 时间信息 */}
          <Stack spacing={0.75}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <AccessTimeRoundedIcon
                sx={{ fontSize: 14, color: "text.disabled" }}
              />
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.75rem" }}>
                {player.online
                  ? `当前在线: ${formatDuration(player.duration_seconds || 0)}`
                  : `最后在线: ${formatTime(player.last_seen)}`}
              </Typography>
            </Stack>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontSize: "0.75rem", pl: 2.5 }}
            >
              24h 在线总时长: {formatDuration(player.duration24h || 0)}
            </Typography>
          </Stack>

          {/* 热力条 */}
          <HeatStrip blocks={player.heatBlocks || Array(24).fill(0)} />

          {/* 24小时标签 */}
          <Stack
            direction="row"
            justifyContent="space-between"
            sx={{ mt: 0.5 }}
          >
            <Typography
              variant="caption"
              sx={{ fontSize: "0.625rem", color: "text.disabled" }}
            >
              24h前
            </Typography>
            <Typography
              variant="caption"
              sx={{ fontSize: "0.625rem", color: "text.disabled" }}
            >
              现在
            </Typography>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

/**
 * Material You 风格的玩家面板页面
 */
export default function PlayersPage() {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [socketState, setSocketState] = useState("connecting");
  const [keyword, setKeyword] = useState("");

  const loadPlayers = async () => {
    setLoading(true);
    setError("");
    try {
      const list = await api.player.list();
      const enhanced = await Promise.all(
        (list || []).map(async (player) => {
          try {
            const sessions = await api.player.sessions(player.player_name, 2);
            const blocks = to24hBlocks(sessions.heatmap || []);
            return {
              ...player,
              heatBlocks: blocks,
              duration24h: blocks.reduce((sum, v) => sum + v, 0)
            };
          } catch {
            return {
              ...player,
              heatBlocks: Array(24).fill(0),
              duration24h: 0
            };
          }
        })
      );
      setPlayers(enhanced);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlayers();
  }, []);

  useEffect(() => {
    const socket = io(SOCKET_BASE, {
      path: "/api/socket.io",
      transports: ["websocket"]
    });
    socket.on("connect", () => setSocketState("connected"));
    socket.on("disconnect", () => setSocketState("disconnected"));
    socket.on("poll_complete", () => loadPlayers());
    return () => socket.disconnect();
  }, []);

  const filtered = useMemo(() => {
    const text = keyword.trim().toLowerCase();
    if (!text) return players;
    return players.filter((p) =>
      p.player_name.toLowerCase().includes(text)
    );
  }, [players, keyword]);

  const onlineCount = useMemo(
    () => players.filter((p) => p.online).length,
    [players]
  );

  // 统计信息
  const stats = useMemo(() => {
    const totalDuration = players.reduce(
      (sum, p) => sum + (p.duration24h || 0),
      0
    );
    return {
      onlineCount,
      totalCount: players.length,
      avgDuration: players.length > 0 ? Math.round(totalDuration / players.length) : 0
    };
  }, [players, onlineCount]);

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
                ? alpha(theme.palette.primary.main, 0.18)
                : alpha(theme.palette.primary.main, 0.1)
            }}
          >
            <GroupsRoundedIcon color="primary" />
          </Box>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 600 }}>
              玩家面板
            </Typography>
            <Typography variant="body2" color="text.secondary">
              在线 {stats.onlineCount}/{stats.totalCount} · 平均 24h 在线{" "}
              {formatDuration(stats.avgDuration)}
            </Typography>
          </Box>
        </Stack>

        <Stack direction="row" spacing={1.5} alignItems="center">
          <TextField
            size="small"
            placeholder="搜索玩家..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRoundedIcon
                    sx={{ fontSize: 20, color: "text.disabled" }}
                  />
                </InputAdornment>
              )
            }}
            sx={{
              minWidth: 200,
              "& .MuiOutlinedInput-root": {
                borderRadius: 3
              }
            }}
          />
          <Button
            variant="contained"
            startIcon={<RefreshRoundedIcon />}
            onClick={loadPlayers}
            disabled={loading}
          >
            刷新
          </Button>
        </Stack>
      </Stack>

      {/* 连接状态指示器 */}
      <Chip
        size="small"
        label={`WebSocket: ${socketState}`}
        variant="outlined"
        sx={{
          borderRadius: 2,
          fontSize: "0.75rem",
          alignSelf: "flex-start"
        }}
      />

      {/* 加载状态 */}
      {loading && <LinearProgress sx={{ borderRadius: 1 }} />}

      {/* 错误提示 */}
      {error && (
        <Alert severity="error" sx={{ borderRadius: 3 }}>
          {error}
        </Alert>
      )}

      {/* 玩家卡片网格 */}
      <Grid container spacing={2}>
        {filtered.map((player) => (
          <Grid item xs={12} sm={6} lg={4} xl={3} key={player.player_name}>
            <PlayerCard player={player} />
          </Grid>
        ))}
      </Grid>

      {/* 空状态 */}
      {!loading && filtered.length === 0 && (
        <Card
          elevation={0}
          sx={{
            borderRadius: 4,
            border: "2px dashed",
            borderColor: "divider"
          }}
        >
          <CardContent sx={{ py: 8, textAlign: "center" }}>
            <GroupsRoundedIcon
              sx={{
                fontSize: 64,
                color: "text.disabled",
                mb: 2
              }}
            />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              {keyword ? "没有匹配的玩家" : "暂无玩家数据"}
            </Typography>
            <Typography variant="body2" color="text.disabled">
              {keyword
                ? "请尝试其他搜索关键词"
                : "服务器上暂无玩家数据记录"}
            </Typography>
          </CardContent>
        </Card>
      )}
    </Stack>
  );
}
