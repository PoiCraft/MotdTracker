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
import StatusPill from "../components/StatusPill";
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
  const md3 = theme.md3?.colors;
  const isDark = theme.md3?.isDark;
  const max = Math.max(...blocks, 1);

  return (
    <Box sx={{ display: "grid", gridTemplateColumns: "repeat(24, 1fr)", gap: 0.5 }}>
      {blocks.map((sec, i) => {
        const ratio = sec / max;
        const bg =
          ratio > 0.7
            ? md3?.success
            : ratio > 0.35
            ? alpha(md3?.success || "#137333", 0.5)
            : ratio > 0
            ? alpha(md3?.success || "#137333", 0.2)
            : isDark
            ? "rgba(255,255,255,0.04)"
            : "rgba(0,0,0,0.04)";
        return (
          <Tooltip key={i} title={sec > 0 ? formatDuration(sec) : "无数据"} arrow>
            <Box
              sx={{
                height: 6,
                borderRadius: 99,
                bgcolor: bg,
                cursor: "pointer",
                transition: "transform 150ms cubic-bezier(0.2,0,0,1)",
                "&:hover": { transform: "scaleY(2)" },
              }}
            />
          </Tooltip>
        );
      })}
    </Box>
  );
}

function PlayerCard({ player }) {
  const theme = useTheme();
  const md3 = theme.md3?.colors;

  return (
    <Card
      variant="outlined"
      sx={{
        height: "100%",
        borderColor: md3?.outlineVariant,
        backgroundColor: md3?.surfaceContainerLow,
        transition: "box-shadow 200ms cubic-bezier(0.2,0,0,1)",
        "&:hover": { boxShadow: theme.shadows[1] },
      }}
    >
      <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
        <Stack spacing={1.5}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
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
                    ? md3?.successContainer
                    : md3?.surfaceContainerHighest,
                  color: player.online
                    ? md3?.onSuccessContainer
                    : md3?.outline,
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
                  color: md3?.onSurface,
                  textDecoration: "none",
                  "&:hover": { color: md3?.primary },
                }}
              >
                {player.player_name}
              </Typography>
            </Stack>
            <StatusPill online={player.online} size="small" />
          </Stack>

          <Stack spacing={0.5}>
            <Stack direction="row" alignItems="center" spacing={0.75}>
              <AccessTimeRoundedIcon sx={{ fontSize: 14, color: md3?.outline }} />
              <Typography variant="body2" sx={{ color: md3?.onSurfaceVariant }}>
                {player.online
                  ? `在线 ${formatDuration(player.duration_seconds || 0)}`
                  : `最后在线 ${formatTime(player.last_seen)}`}
              </Typography>
            </Stack>
            <Typography variant="body2" sx={{ color: md3?.outline, pl: 2.5 }}>
              24h: {formatDuration(player.duration24h || 0)}
            </Typography>
          </Stack>

          <HeatStrip blocks={player.heatBlocks || Array(24).fill(0)} />

          <Stack direction="row" justifyContent="space-between">
            <Typography variant="caption" sx={{ color: md3?.outline, fontSize: "0.625rem" }}>24h前</Typography>
            <Typography variant="caption" sx={{ color: md3?.outline, fontSize: "0.625rem" }}>现在</Typography>
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
  const md3 = theme.md3?.colors;
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
          <Typography variant="h5" sx={{ fontWeight: 500, mb: 0.25 }}>玩家面板</Typography>
          <Typography variant="body2" sx={{ color: md3?.onSurfaceVariant }}>
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
                  <SearchRoundedIcon sx={{ fontSize: 18, color: md3?.outline }} />
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

      <Grid container spacing={2}>
        {filtered.map((player) => (
          <Grid item xs={12} sm={6} lg={4} xl={3} key={player.player_name}>
            <PlayerCard player={player} />
          </Grid>
        ))}
      </Grid>

      {!loading && filtered.length === 0 && (
        <Card variant="outlined" sx={{ borderColor: md3?.outlineVariant }}>
          <CardContent sx={{ py: 8, textAlign: "center" }}>
            <GroupsRoundedIcon sx={{ fontSize: 48, color: md3?.outline, mb: 2 }} />
            <Typography variant="subtitle1" sx={{ color: md3?.onSurfaceVariant }}>
              {keyword ? "没有匹配的玩家" : "暂无玩家数据"}
            </Typography>
            <Typography variant="body2" sx={{ color: md3?.outline }}>
              {keyword ? "请尝试其他搜索关键词" : "服务器上暂无玩家数据记录"}
            </Typography>
          </CardContent>
        </Card>
      )}
    </Stack>
  );
}
