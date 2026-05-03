import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  InputAdornment,
  LinearProgress,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import AccessTimeRoundedIcon from "@mui/icons-material/AccessTimeRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import M3StatusTag from "../components/M3StatusTag";
import MetricGrid from "../components/MetricGrid";
import { api } from "../api";
import HeatCell from "../components/HeatCell";
import HeatStrip from "../components/HeatStrip";
import { useWsEvent } from "../utils/ws";
import { formatDuration, formatTime } from "../utils/format";

function to24hBlocks(heatmap) {
  if (!Array.isArray(heatmap) || !heatmap.length) return Array(24).fill(0);
  const now = Date.now();
  const start = now - 86400000;
  const blocks = Array(24).fill(0);
  heatmap.forEach((item) => {
    const hour = String(item.hour).padStart(2, "0");
    const ts = new Date(`${item.date}T${hour}:00:00`).getTime();
    if (ts >= start && ts <= now) {
      const off = Math.floor((now - ts) / 3600000);
      if (off >= 0 && off < 24) blocks[23 - off] += Number(item.seconds || 0);
    }
  });
  return blocks;
}

function HeatStripRow({ blocks }) {
  const theme = useTheme();
  const c = theme.gemini?.colors;
  const max = Math.max(...blocks, 1);
  return (
    <HeatStrip minWidth={{ xs: 200, sm: "auto" }}>
      {blocks.map((sec, i) => {
          const ratio = sec / max;
          const bg =
            ratio > 0.7
              ? "#188038"
              : ratio > 0.35
              ? alpha("#188038", 0.5)
              : ratio > 0
              ? alpha("#188038", 0.2)
              : "#E0E2E0";
          return (
            <Box key={i} sx={{ flex: 1 }}>
              <HeatCell color={bg} title={sec > 0 ? formatDuration(sec) : "无数据"} height={8} />
            </Box>
          );
        })}
    </HeatStrip>
  );
}

function StatPill({ icon, label, value, color, emphasis = false, muted = false }) {
  return (
    <Box
      sx={{
        p: 1,
        borderRadius: 999,
        display: "flex",
        alignItems: "center",
        gap: 1,
        minWidth: 0,
        bgcolor: alpha(color || "#000", 0.06),
        border: `1px solid ${alpha(color || "#000", 0.14)}`,
        boxShadow: emphasis
          ? `0 0 0 1px ${alpha(color || "#000", 0.2)} inset`
          : "none",
        filter: muted ? "saturate(0.55)" : "none",
        opacity: muted ? 0.9 : 1,
      }}
    >
      <Box
        sx={{
          width: 30,
          height: 30,
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: alpha(color || "#000", 0.12),
          color: color || "inherit",
          flexShrink: 0,
          "& svg": { fontSize: 16 },
        }}
      >
        {icon}
      </Box>

      <Box sx={{ minWidth: 0, lineHeight: 1.1 }}>
        <Typography
          variant="caption"
          sx={{ color: "text.secondary", display: "block" }}
        >
          {label}
        </Typography>
        <Typography
          variant="subtitle2"
          sx={{
            fontWeight: 700,
            fontFeatureSettings: '"tnum"',
            letterSpacing: "0.01em",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {value}
        </Typography>
      </Box>
    </Box>
  );
}

function getSessionTone(durationSeconds, online, c) {
  if (!online) {
    return { color: c?.outline || "#5F6368", emphasis: false };
  }
  const sec = Number(durationSeconds || 0);
  if (sec >= 4 * 3600) {
    return { color: c?.warning || "#B05D00", emphasis: true };
  }
  return { color: c?.success || "#188038", emphasis: false };
}

function getActivityTone(duration24h, c) {
  const sec = Number(duration24h || 0);
  if (sec >= 4 * 3600) {
    return { color: c?.success || "#188038", emphasis: true };
  }
  if (sec >= 3600) {
    return { color: c?.primary || "#1A73E8", emphasis: false };
  }
  if (sec > 0) {
    return { color: c?.warning || "#B05D00", emphasis: false };
  }
  return { color: c?.outline || "#5F6368", emphasis: false };
}

function PlayerCard({ player }) {
  const theme = useTheme();
  const c = theme.gemini?.colors;
  const sessionTone = getSessionTone(player.duration_seconds, player.online, c);
  const activityTone = getActivityTone(player.duration24h, c);

  return (
    <Card
      elevation={0}
      sx={{
        height: "100%",
        position: "relative",
        backgroundColor: player.online ? c?.successContainer : c?.surface,
        filter: player.online ? "none" : "saturate(0.62)",
      }}
    >
      <Box sx={{ position: "absolute", top: 16, right: 16, zIndex: 1 }}>
        <M3StatusTag online={player.online} size="small" />
      </Box>
      <CardContent sx={{ p: 4, "&:last-child": { pb: 4 } }}>
        <Stack spacing={2}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                bgcolor: player.online
                  ? alpha(c?.success || "#188038", 0.12)
                  : alpha(c?.onSurface || "#000", 0.06),
                color: player.online
                  ? c?.success
                  : c?.outline,
              }}
            >
              <PersonRoundedIcon sx={{ fontSize: 18 }} />
            </Box>
            <Typography
              component={Link}
              to={`/players/${encodeURIComponent(player.player_name)}`}
              variant="subtitle2"
              sx={{
                fontWeight: 500,
                color: c?.onSurface,
                textDecoration: "none",
                "&:hover": { color: c?.primary },
              }}
            >
              {player.player_name}
            </Typography>
          </Stack>

          <Stack direction="row" spacing={1} sx={{ width: "100%" }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <StatPill
                icon={<AccessTimeRoundedIcon />}
                label={player.online ? "当前会话" : "最后在线"}
                value={
                  player.online
                    ? formatDuration(player.duration_seconds || 0)
                    : formatTime(player.last_seen)
                }
                color={sessionTone.color}
                emphasis={sessionTone.emphasis}
                muted={!player.online}
              />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <StatPill
                icon={<GroupsRoundedIcon />}
                label="24h活跃"
                value={formatDuration(player.duration24h || 0)}
                color={activityTone.color}
                emphasis={activityTone.emphasis}
                muted={!player.online && !(player.duration24h > 0)}
              />
            </Box>
          </Stack>

          <HeatStripRow blocks={player.heatBlocks || Array(24).fill(0)} />

          <Stack direction="row" justifyContent="space-between">
            <Typography variant="caption" sx={{ color: c?.outline, fontSize: "0.625rem" }}>24h前</Typography>
            <Typography variant="caption" sx={{ color: c?.outline, fontSize: "0.625rem" }}>现在</Typography>
          </Stack>

          <Button
            component={Link}
            to={`/players/${encodeURIComponent(player.player_name)}`}
            variant="outlined"
            fullWidth
          >
            查看详情
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}

export default function PlayersPage() {
  const theme = useTheme();
  const c = theme.gemini?.colors;
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [keyword, setKeyword] = useState("");

  const loadPlayers = async () => {
    setLoading(true);
    setError("");
    try {
      const list = await api.player.list();
      const enhanced = await Promise.all(
        (list || []).map(async (p) => {
          try {
            const sessions = await api.player.sessions(p.player_name, 2);
            const blocks = to24hBlocks(sessions.heatmap || []);
            return { ...p, heatBlocks: blocks, duration24h: blocks.reduce((a, b) => a + b, 0) };
          } catch {
            return { ...p, heatBlocks: Array(24).fill(0), duration24h: 0 };
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

  useEffect(() => { loadPlayers(); }, []);

  useWsEvent(() => loadPlayers());

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return kw ? players.filter((p) => p.player_name.toLowerCase().includes(kw)) : players;
  }, [players, keyword]);

  const onlineCount = useMemo(() => players.filter((p) => p.online).length, [players]);

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", md: "center" }} spacing={2}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 600, mb: 0.25 }}>玩家面板</Typography>
          <Typography variant="body2" sx={{ color: c?.onSurfaceVariant }}>
            在线 {onlineCount}/{players.length}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <TextField
            size="small"
            placeholder="搜索玩家..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRoundedIcon sx={{ fontSize: 18, color: c?.outline }} />
                </InputAdornment>
              ),
            }}
            sx={{ minWidth: 200 }}
          />
          <Button variant="outlined" startIcon={<RefreshRoundedIcon />} onClick={loadPlayers} disabled={loading}>刷新</Button>
        </Stack>
      </Stack>

      {loading && <LinearProgress />}
      {error && <Alert severity="error">{error}</Alert>}

      <MetricGrid itemSize={{ xs: 12, sm: 6, lg: 4 }}>
        {filtered.map((player) => (
          <PlayerCard key={player.player_name} player={player} />
        ))}
      </MetricGrid>

      {!loading && filtered.length === 0 && (
        <Card elevation={0}>
          <CardContent sx={{ py: 8, textAlign: "center" }}>
            <GroupsRoundedIcon sx={{ fontSize: 48, color: c?.outline, mb: 2 }} />
            <Typography variant="subtitle1" sx={{ color: c?.onSurfaceVariant }}>
              {keyword ? "没有匹配的玩家" : "暂无玩家数据"}
            </Typography>
            <Typography variant="body2" sx={{ color: c?.outline }}>
              {keyword ? "请尝试其他搜索关键词" : "服务器上暂无玩家数据记录"}
            </Typography>
          </CardContent>
        </Card>
      )}
    </Stack>
  );
}
