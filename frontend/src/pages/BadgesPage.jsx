import { useEffect, useMemo, useState } from "react";
import {
  Alert, Box, Button, Card, CardContent, Chip, FormControl, Grid,
  IconButton, InputLabel, LinearProgress, MenuItem, Select,
  Snackbar, Stack, Table, TableBody, TableCell, TableHead, TableRow,
  Tooltip, Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import BadgeRoundedIcon from "@mui/icons-material/BadgeRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import ImageRoundedIcon from "@mui/icons-material/ImageRounded";
import CodeRoundedIcon from "@mui/icons-material/CodeRounded";
import LinkRoundedIcon from "@mui/icons-material/LinkRounded";
import { api, getApiBase } from "../api";
import { useWsEvent } from "../utils/ws";

const TIME_OPTIONS = [
  { label: "24h", value: "24" },
  { label: "1h", value: "1" }, { label: "3h", value: "3" },
  { label: "6h", value: "6" }, { label: "12h", value: "12" },
  { label: "3d", value: "72" },
  { label: "7d", value: "168" }, { label: "30d", value: "720" },
];

function withHours(path, hours) {
  if (!hours) return path;
  return path.includes("?") ? `${path}&hours=${hours}` : `${path}?hours=${hours}`;
}

function formatOutput(url, type) {
  if (type === "html") return `<img src="${url.replace(/&/g, "&amp;")}" alt="badge" />`;
  if (type === "markdown") return `![badge](${url})`;
  return url;
}

function SectionHeader({ children, icon }) {
  const theme = useTheme();
  const c = theme.gemini?.colors;
  return (
    <Stack direction="row" alignItems="center" spacing={1} sx={{ py: 1, px: 1.5, bgcolor: alpha(c?.onSurface || "#000", 0.04), borderRadius: 2 }}>
      <Box sx={{ color: c?.onSurfaceVariant }}>{icon}</Box>
      <Typography variant="subtitle2" sx={{ fontWeight: 500 }}>{children}</Typography>
    </Stack>
  );
}

export default function BadgesPage() {
  const theme = useTheme();
  const c = theme.gemini?.colors;
  const isDark = theme.gemini?.isDark;

  const [nodes, setNodes] = useState([]);
  const [players, setPlayers] = useState([]);
  const [nodeId, setNodeId] = useState("");
  const [playerName, setPlayerName] = useState("Steve");
  const [hours, setHours] = useState("24");
  const [formatType, setFormatType] = useState("url");
  const [refreshSalt, setRefreshSalt] = useState(Date.now());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(null);
  const [snackbar, setSnackbar] = useState(false);

  const apiBase = getApiBase();

  const loadData = async () => {
    setLoading(true); setError("");
    try {
      const [nodeResult, playerResult] = await Promise.all([api.badge.nodes(), api.player.list()]);
      const nextNodes = Array.isArray(nodeResult) ? nodeResult : nodeResult?.nodes || [];
      const names = (playerResult || []).map((p) => p.player_name);
      setNodes(nextNodes);
      setPlayers(names);
      if (nextNodes.length && !nodeId) setNodeId(String(nextNodes[0].id));
      if (names.length && (!playerName || !names.includes(playerName)))
        setPlayerName(names.includes("Steve") ? "Steve" : names[0]);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  useWsEvent(() => setRefreshSalt(Date.now()));

  const rows = useMemo(() => {
    const n = nodeId || (nodes.length ? String(nodes[0].id) : "1");
    const p = playerName || "Steve";
    return [
      { section: "服务器", icon: <ImageRoundedIcon sx={{ fontSize: 16 }} /> },
      { type: "状态", name: "服务器状态", path: "/api/badge/server/status" },
      { type: "在线率", name: "服务器在线率", path: withHours("/api/badge/server/uptime", hours) },
      { type: "玩家", name: "在线玩家数", path: "/api/badge/server/players" },
      { section: "节点", icon: <LinkRoundedIcon sx={{ fontSize: 16 }} /> },
      { type: "状态", name: "节点状态", path: `/api/badge/node/${n}/status` },
      { type: "在线率", name: "节点在线率", path: withHours(`/api/badge/node/${n}/uptime`, hours) },
      { type: "延迟", name: "节点延迟", path: `/api/badge/node/${n}/latency` },
      { type: "玩家", name: "节点玩家数", path: `/api/badge/node/${n}/players` },
      { type: "统计", name: "平均延迟", path: withHours(`/api/badge/node/${n}/latency-stats?stat=avg`, hours) },
      { type: "统计", name: "最小延迟", path: withHours(`/api/badge/node/${n}/latency-stats?stat=min`, hours) },
      { type: "统计", name: "最大延迟", path: withHours(`/api/badge/node/${n}/latency-stats?stat=max`, hours) },
      { type: "统计", name: "P95 延迟", path: withHours(`/api/badge/node/${n}/latency-stats?stat=p95`, hours) },
      { type: "统计", name: "标准差", path: withHours(`/api/badge/node/${n}/latency-stats?stat=std`, hours) },
      { type: "统计", name: "变异系数", path: withHours(`/api/badge/node/${n}/latency-stats?stat=cv`, hours) },
      { section: "玩家", icon: <CodeRoundedIcon sx={{ fontSize: 16 }} /> },
      { type: "状态", name: "玩家在线状态", path: `/api/badge/player/${encodeURIComponent(p)}/status` },
      { type: "会话", name: "当前会话时长", path: `/api/badge/player/${encodeURIComponent(p)}/current-session` },
      { type: "时长", name: "时段游戏时长", path: withHours(`/api/badge/player/${encodeURIComponent(p)}/period-playtime`, hours) },
      { type: "实时", name: "实时状态", path: `/api/badge/player/${encodeURIComponent(p)}/live` },
    ];
  }, [hours, nodeId, nodes, playerName]);

  const copyText = async (text, idx) => {
    try { await navigator.clipboard.writeText(text); } catch {
      const ta = document.createElement("textarea"); ta.value = text;
      document.body.appendChild(ta); ta.select(); document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(idx); setSnackbar(true); setTimeout(() => setCopied(null), 2000);
  };

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", md: "center" }} spacing={2}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 600, mb: 0.25 }}>Badge 生成器</Typography>
          <Typography variant="body2" sx={{ color: c?.onSurfaceVariant }}>生成状态徽章，可在任何地方嵌入使用</Typography>
        </Box>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Button variant="outlined" startIcon={<RefreshRoundedIcon />} onClick={loadData} disabled={loading}>刷新</Button>
        </Stack>
      </Stack>

      {loading && <LinearProgress />}
      {error && <Alert severity="error">{error}</Alert>}

      {/* Config */}
      <Card elevation={0}>
        <CardContent>
          <Typography variant="subtitle2" sx={{ fontWeight: 500, mb: 2 }}>配置选项</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>输出格式</InputLabel>
                <Select value={formatType} label="输出格式" onChange={(e) => setFormatType(e.target.value)}>
                  <MenuItem value="url"><Stack direction="row" alignItems="center" spacing={1}><LinkRoundedIcon sx={{ fontSize: 16 }} /><span>URL</span></Stack></MenuItem>
                  <MenuItem value="html"><Stack direction="row" alignItems="center" spacing={1}><CodeRoundedIcon sx={{ fontSize: 16 }} /><span>HTML</span></Stack></MenuItem>
                  <MenuItem value="markdown"><Stack direction="row" alignItems="center" spacing={1}><ImageRoundedIcon sx={{ fontSize: 16 }} /><span>Markdown</span></Stack></MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>统计时间</InputLabel>
                <Select value={hours} label="统计时间" onChange={(e) => setHours(e.target.value)}>
                  {TIME_OPTIONS.map((i) => <MenuItem key={i.value} value={i.value}>{i.label}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>节点</InputLabel>
                <Select value={nodeId} label="节点" onChange={(e) => setNodeId(e.target.value)}>
                  {nodes.map((n) => <MenuItem key={n.id} value={String(n.id)}>{n.name}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>玩家</InputLabel>
                <Select value={playerName} label="玩家" onChange={(e) => setPlayerName(e.target.value)}>
                  {(players.length ? players : ["Steve"]).map((n) => <MenuItem key={n} value={n}>{n}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Table */}
      <Card elevation={0}>
        <CardContent sx={{ overflowX: "auto" }}>
          <Table size="small" sx={{ minWidth: { xs: "auto", md: 860 } }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 72, display: { xs: "none", sm: "table-cell" } }}>类型</TableCell>
                <TableCell sx={{ width: 140 }}>名称</TableCell>
                <TableCell sx={{ width: 180 }}>预览</TableCell>
                <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>输出</TableCell>
                <TableCell sx={{ width: 64 }} align="center">复制</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row, idx) => {
                if (row.section) {
                  return (
                    <TableRow key={`s-${idx}`}>
                      <TableCell colSpan={5} sx={{ p: 0, pt: 1.5, border: 0 }}>
                        <SectionHeader icon={row.icon}>{row.section}</SectionHeader>
                      </TableCell>
                    </TableRow>
                  );
                }
                const rawUrl = `${apiBase}${row.path}`;
                const previewUrl = `${rawUrl}${rawUrl.includes("?") ? "&" : "?"}t=${refreshSalt}`;
                const output = formatOutput(rawUrl, formatType);

                return (
                  <TableRow key={`${row.path}-${idx}`} sx={{ "&:hover": { bgcolor: alpha(c?.onSurface || "#000", 0.04) } }}>
                    <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>
                      <Chip label={row.type} size="small" variant="outlined" sx={{ height: 24, fontSize: "0.6875rem" }} />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>{row.name}</Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ p: 0.75, borderRadius: 2, bgcolor: alpha(c?.onSurface || "#000", 0.04), display: "inline-flex" }}>
                        <img src={previewUrl} alt={row.name} style={{ display: "block", height: 18 }} />
                      </Box>
                    </TableCell>
                    <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>
                      <Box sx={{ p: 1, borderRadius: 2, bgcolor: alpha(c?.onSurface || "#000", 0.04) }}>
                        <Typography variant="body2" sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: "0.6875rem", wordBreak: "break-all", color: c?.onSurfaceVariant }}>
                          {output}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title={copied === idx ? "已复制" : "复制"} arrow>
                        <IconButton
                          size="small"
                          onClick={() => copyText(output, idx)}
                          sx={{
                            color: copied === idx ? c?.primary : c?.onSurfaceVariant,
                            bgcolor: copied === idx ? alpha(c?.primary || "#1A73E8", 0.12) : "transparent",
                          }}
                        >
                          {copied === idx ? <CheckRoundedIcon sx={{ fontSize: 16 }} /> : <ContentCopyRoundedIcon sx={{ fontSize: 16 }} />}
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Snackbar
        open={snackbar}
        autoHideDuration={2000}
        onClose={() => setSnackbar(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        message="已复制到剪贴板"
      />
    </Stack>
  );
}
