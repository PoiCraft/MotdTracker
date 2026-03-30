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
  LinearProgress,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { api, SOCKET_BASE } from "../api";
import { formatDuration, formatTime } from "../utils/format";

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

function HeatStrip({ blocks, theme }) {
  const max = Math.max(...blocks, 1);
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: "repeat(24, 1fr)", gap: 0.35 }}>
      {blocks.map((seconds, idx) => {
        const intensity = seconds / max;
        const bg = intensity > 0.7
          ? "success.main"
          : intensity > 0.4
            ? "success.light"
            : intensity > 0
              ? alpha(theme.palette.success.main, 0.28)
              : "action.hover";
        return <Box key={idx} sx={{ height: 10, borderRadius: 0.7, bgcolor: bg, border: "1px solid", borderColor: "divider" }} />;
      })}
    </Box>
  );
}

function PlayerCard({ player, theme }) {
  return (
    <Card variant="outlined" sx={{ height: "100%" }}>
      <CardContent>
        <Stack spacing={1}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography component={Link} to={`/players/${encodeURIComponent(player.player_name)}`} sx={{ textDecoration: "none", fontWeight: 700 }}>
              {player.player_name}
            </Typography>
            <Chip size="small" color={player.online ? "success" : "default"} label={player.online ? "在线" : "离线"} />
          </Stack>

          <Typography variant="body2" color="text.secondary">
            {player.online ? `当前在线: ${formatDuration(player.duration_seconds || 0)}` : `最后在线: ${formatTime(player.last_seen)}`}
          </Typography>
          <Typography variant="body2" color="text.secondary">24h 在线总时长: {formatDuration(player.duration24h || 0)}</Typography>

          <HeatStrip blocks={player.heatBlocks || Array(24).fill(0)} theme={theme} />
        </Stack>
      </CardContent>
    </Card>
  );
}

export default function PlayersPage() {
  const theme = useTheme();
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
    const socket = io(SOCKET_BASE, { path: "/api/socket.io", transports: ["websocket"] });
    socket.on("connect", () => setSocketState("connected"));
    socket.on("disconnect", () => setSocketState("disconnected"));
    socket.on("poll_complete", () => loadPlayers());
    return () => socket.disconnect();
  }, []);

  const filtered = useMemo(() => {
    const text = keyword.trim().toLowerCase();
    if (!text) {
      return players;
    }
    return players.filter((p) => p.player_name.toLowerCase().includes(text));
  }, [players, keyword]);

  const onlineCount = useMemo(() => players.filter((p) => p.online).length, [players]);

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", md: "center" }} spacing={1}>
        <Box>
          <Typography variant="h4">玩家面板</Typography>
          <Typography color="text.secondary">在线 {onlineCount}/{players.length} · Socket: {socketState}</Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <TextField size="small" label="搜索玩家" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
          <Button variant="contained" onClick={loadPlayers}>刷新</Button>
        </Stack>
      </Stack>

      {loading ? <LinearProgress /> : null}
      {error ? <Alert severity="error">{error}</Alert> : null}

      <Grid container spacing={1.5}>
        {filtered.map((player) => (
          <Grid item xs={12} sm={6} lg={4} key={player.player_name}>
            <PlayerCard player={player} theme={theme} />
          </Grid>
        ))}
      </Grid>

      {!loading && filtered.length === 0 ? (
        <Card variant="outlined"><CardContent><Typography color="text.secondary">没有匹配玩家</Typography></CardContent></Card>
      ) : null}
    </Stack>
  );
}
