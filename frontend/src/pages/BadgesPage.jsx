import { useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
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
import { api, getApiBase, SOCKET_BASE } from "../api";

const TIME_OPTIONS = [
  { label: "24h(默认)", value: "" },
  { label: "1h", value: "1" },
  { label: "3h", value: "3" },
  { label: "6h", value: "6" },
  { label: "12h", value: "12" },
  { label: "24h", value: "24" },
  { label: "3d", value: "72" },
  { label: "7d", value: "168" },
  { label: "30d", value: "720" }
];

function withHours(path, hours) {
  if (!hours) {
    return path;
  }
  return path.includes("?") ? `${path}&hours=${hours}` : `${path}?hours=${hours}`;
}

function formatOutput(url, type) {
  if (type === "html") {
    return `<img src="${url}" alt="badge" />`;
  }
  if (type === "markdown") {
    return `![badge](${url})`;
  }
  return url;
}

export default function BadgesPage() {
  const [nodes, setNodes] = useState([]);
  const [players, setPlayers] = useState([]);
  const [nodeId, setNodeId] = useState("");
  const [playerName, setPlayerName] = useState("Steve");
  const [hours, setHours] = useState("");
  const [formatType, setFormatType] = useState("url");
  const [socketState, setSocketState] = useState("connecting");
  const [refreshSalt, setRefreshSalt] = useState(Date.now());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const apiBase = getApiBase();

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [nodeResult, playerResult] = await Promise.all([
        api.badge.nodes(),
        api.player.list()
      ]);
      const nextNodes = Array.isArray(nodeResult) ? nodeResult : nodeResult?.nodes || [];
      const playerNames = (playerResult || []).map((p) => p.player_name);

      setNodes(nextNodes);
      setPlayers(playerNames);
      if (nextNodes.length && !nodeId) {
        setNodeId(String(nextNodes[0].id));
      }
      if (playerNames.length && (!playerName || !playerNames.includes(playerName))) {
        setPlayerName(playerNames.includes("Steve") ? "Steve" : playerNames[0]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const socket = io(SOCKET_BASE, { path: "/api/socket.io", transports: ["websocket"] });
    socket.on("connect", () => setSocketState("connected"));
    socket.on("disconnect", () => setSocketState("disconnected"));
    socket.on("poll_complete", () => setRefreshSalt(Date.now()));
    return () => socket.disconnect();
  }, []);

  const rows = useMemo(() => {
    const n = nodeId || (nodes.length ? String(nodes[0].id) : "1");
    const p = playerName || "Steve";

    return [
      { section: "服务器" },
      { type: "状态", name: "服务器状态", path: "/api/badge/server/status" },
      { type: "在线率", name: "服务器在线率", path: withHours("/api/badge/server/uptime", hours) },
      { type: "玩家", name: "在线玩家数", path: "/api/badge/server/players" },
      { section: "节点" },
      { type: "状态", name: "节点状态", path: `/api/badge/node/${n}/status` },
      { type: "在线率", name: "节点在线率", path: withHours(`/api/badge/node/${n}/uptime`, hours) },
      { type: "延迟", name: "节点延迟", path: `/api/badge/node/${n}/latency` },
      { type: "统计", name: "平均延迟", path: withHours(`/api/badge/node/${n}/latency-stats?stat=avg`, hours) },
      { type: "统计", name: "最小延迟", path: withHours(`/api/badge/node/${n}/latency-stats?stat=min`, hours) },
      { type: "统计", name: "最大延迟", path: withHours(`/api/badge/node/${n}/latency-stats?stat=max`, hours) },
      { type: "统计", name: "标准差", path: withHours(`/api/badge/node/${n}/latency-stats?stat=std`, hours) },
      { type: "统计", name: "变异系数", path: withHours(`/api/badge/node/${n}/latency-stats?stat=cv`, hours) },
      { section: "玩家" },
      { type: "状态", name: "玩家在线状态", path: `/api/badge/player/${encodeURIComponent(p)}/status` },
      { type: "会话", name: "当前会话时长", path: `/api/badge/player/${encodeURIComponent(p)}/current-session` },
      { type: "时长", name: "时段游戏时长", path: withHours(`/api/badge/player/${encodeURIComponent(p)}/period-playtime`, hours) },
      { type: "实时", name: "实时状态", path: `/api/badge/player/${encodeURIComponent(p)}/live` }
    ];
  }, [hours, nodeId, nodes, playerName]);

  const copyText = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const area = document.createElement("textarea");
      area.value = text;
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      document.body.removeChild(area);
    }
  };

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", md: "center" }} spacing={1}>
        <Box>
          <Typography variant="h4">Badge 生成器</Typography>
          <Typography color="text.secondary">Socket: {socketState}</Typography>
        </Box>
        <Button variant="contained" onClick={loadData}>刷新数据</Button>
      </Stack>

      {loading ? <LinearProgress /> : null}
      {error ? <Alert severity="error">{error}</Alert> : null}

      <Card>
        <CardContent>
          <Grid container spacing={1.5}>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel id="badge-format">输出格式</InputLabel>
                <Select labelId="badge-format" label="输出格式" value={formatType} onChange={(e) => setFormatType(e.target.value)}>
                  <MenuItem value="url">URL</MenuItem>
                  <MenuItem value="html">HTML</MenuItem>
                  <MenuItem value="markdown">Markdown</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel id="badge-hours">统计时间</InputLabel>
                <Select labelId="badge-hours" label="统计时间" value={hours} onChange={(e) => setHours(e.target.value)}>
                  {TIME_OPTIONS.map((item) => (
                    <MenuItem key={`${item.label}-${item.value}`} value={item.value}>{item.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel id="badge-node">节点</InputLabel>
                <Select labelId="badge-node" label="节点" value={nodeId} onChange={(e) => setNodeId(e.target.value)}>
                  {nodes.map((n) => (
                    <MenuItem key={n.id} value={String(n.id)}>{n.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel id="badge-player">玩家</InputLabel>
                <Select labelId="badge-player" label="玩家" value={playerName} onChange={(e) => setPlayerName(e.target.value)}>
                  {(players.length ? players : ["Steve"]).map((name) => (
                    <MenuItem key={name} value={name}>{name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card>
        <CardContent sx={{ overflowX: "auto" }}>
          <Table size="small" sx={{ minWidth: 980 }}>
            <TableHead>
              <TableRow>
                <TableCell>类型</TableCell>
                <TableCell>名称</TableCell>
                <TableCell>预览</TableCell>
                <TableCell>输出</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row, idx) => {
                if (row.section) {
                  return (
                    <TableRow key={`section-${idx}`}>
                      <TableCell colSpan={4}><Typography variant="subtitle2">{row.section}</Typography></TableCell>
                    </TableRow>
                  );
                }
                const rawUrl = `${apiBase}${row.path}`;
                const previewUrl = `${rawUrl}${rawUrl.includes("?") ? "&" : "?"}t=${refreshSalt}`;
                const output = formatOutput(rawUrl, formatType);
                return (
                  <TableRow key={`${row.path}-${idx}`}>
                    <TableCell>{row.type}</TableCell>
                    <TableCell>{row.name}</TableCell>
                    <TableCell><img src={previewUrl} alt={row.name} /></TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="body2" sx={{ fontFamily: "monospace", wordBreak: "break-all" }}>{output}</Typography>
                        <Button size="small" variant="outlined" onClick={() => copyText(output)}>复制</Button>
                      </Stack>
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
