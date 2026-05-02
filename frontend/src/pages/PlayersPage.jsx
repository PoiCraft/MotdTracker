import { useEffect, useMemo, useState } from "react";
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
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import AccessTimeRoundedIcon from "@mui/icons-material/AccessTimeRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import M3StatusTag from "../components/M3StatusTag";
import { api } from "../api";
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

function HeatStrip({ blocks }) {
  const theme = useTheme();
  const c = theme.gemini?.colors;
  const max = Math.max(...blocks, 1);

  return (
    <Box sx={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
      <Stack direction="row" spacing={0.5} sx={{ minWidth: { xs: 200, sm: "auto" } }}>
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
            <Tooltip key={i} title={sec > 0 ? formatDuration(sec) : "无数据"} arrow>
              <Box
                sx={{
                  flex: 1,
                  height: 8,
                  borderRadius: 100,
                  bgcolor: bg,
                  cursor: "pointer",
                  transition: "transform 150ms cubic-bezier(0.2,0,0,1)",
                  "&:hover": { transform: "scaleY(2)" },
                }}
              />
            </Tooltip>
          );
        })}
      </Stack>
    </Box>
  );
}

function PlayerCard({ player }) {
  const theme = useTheme();
  const c = theme.gemini?.colors;

  return (
    <Card
      elevation={0}
      sx={{
        height: "100%",
        position: "relative",
        backgroundColor: player.online ? c?.successContainer : c?.surface,
      }}
    >
      <Box sx={{ position: "absolute", top: 16, right: 16, zIndex: 1 }}>
        <M3StatusTag online={player.online} size="small" />
      </Box>
      <CardContent sx={{ p: 3, "&:last-child": { pb: 3 } }}>
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

          <Stack spacing={0.5}>
            <Stack direction="row" alignItems="center" spacing={0.75}>
              <AccessTimeRoundedIcon sx={{ fontSize: 14, color: c?.outline }} />
              <Typography variant="body2" sx={{ color: c?.onSurfaceVariant }}>
                {player.online
                  ? `在线 ${formatDuration(player.duration_seconds || 0)}`
                  : `最后在线 ${formatTime(player.last_seen)}`}
              </Typography>
            </Stack>
            <Typography variant="body2" sx={{ color: c?.outline, pl: 2.5 }}>
              24h: {formatDuration(player.duration24h || 0)}
            </Typography>
          </Stack>

          <HeatStrip blocks={player.heatBlocks || Array(24).fill(0)} />

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

      <Grid container spacing={3}>
        {filtered.map((player) => (
          <Grid item xs={12} sm={6} lg={3} key={player.player_name}>
            <PlayerCard player={player} />
          </Grid>
        ))}
      </Grid>

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
