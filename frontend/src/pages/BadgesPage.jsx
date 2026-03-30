import { useEffect, useMemo, useState } from "react";
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
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
  alpha,
  useTheme
} from "@mui/material";
import BadgeRoundedIcon from "@mui/icons-material/BadgeRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import ImageRoundedIcon from "@mui/icons-material/ImageRounded";
import CodeRoundedIcon from "@mui/icons-material/CodeRounded";
import LinkRoundedIcon from "@mui/icons-material/LinkRounded";
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

/**
 * Material You 风格的徽章页面
 */
export default function BadgesPage() {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  
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
  const [copied, setCopied] = useState(null);
  const [snackbar, setSnackbar] = useState(false);

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
    const socket = io(SOCKET_BASE, {
      path: "/api/socket.io",
      transports: ["websocket"]
    });
    socket.on("connect", () => setSocketState("connected"));
    socket.on("disconnect", () => setSocketState("disconnected"));
    socket.on("poll_complete", () => setRefreshSalt(Date.now()));
    return () => socket.disconnect();
  }, []);

  const rows = useMemo(() => {
    const n = nodeId || (nodes.length ? String(nodes[0].id) : "1");
    const p = playerName || "Steve";

    return [
      { section: "服务器", icon: <ImageRoundedIcon sx={{ fontSize: 18 }} /> },
      { type: "状态", name: "服务器状态", path: "/api/badge/server/status" },
      { type: "在线率", name: "服务器在线率", path: withHours("/api/badge/server/uptime", hours) },
      { type: "玩家", name: "在线玩家数", path: "/api/badge/server/players" },
      { section: "节点", icon: <LinkRoundedIcon sx={{ fontSize: 18 }} /> },
      { type: "状态", name: "节点状态", path: `/api/badge/node/${n}/status` },
      { type: "在线率", name: "节点在线率", path: withHours(`/api/badge/node/${n}/uptime`, hours) },
      { type: "延迟", name: "节点延迟", path: `/api/badge/node/${n}/latency` },
      { type: "统计", name: "平均延迟", path: withHours(`/api/badge/node/${n}/latency-stats?stat=avg`, hours) },
      { type: "统计", name: "最小延迟", path: withHours(`/api/badge/node/${n}/latency-stats?stat=min`, hours) },
      { type: "统计", name: "最大延迟", path: withHours(`/api/badge/node/${n}/latency-stats?stat=max`, hours) },
      { type: "统计", name: "标准差", path: withHours(`/api/badge/node/${n}/latency-stats?stat=std`, hours) },
      { type: "统计", name: "变异系数", path: withHours(`/api/badge/node/${n}/latency-stats?stat=cv`, hours) },
      { section: "玩家", icon: <CodeRoundedIcon sx={{ fontSize: 18 }} /> },
      { type: "状态", name: "玩家在线状态", path: `/api/badge/player/${encodeURIComponent(p)}/status` },
      { type: "会话", name: "当前会话时长", path: `/api/badge/player/${encodeURIComponent(p)}/current-session` },
      { type: "时长", name: "时段游戏时长", path: withHours(`/api/badge/player/${encodeURIComponent(p)}/period-playtime`, hours) },
      { type: "实时", name: "实时状态", path: `/api/badge/player/${encodeURIComponent(p)}/live` }
    ];
  }, [hours, nodeId, nodes, playerName]);

  const copyText = async (text, idx) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(idx);
      setSnackbar(true);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      const area = document.createElement("textarea");
      area.value = text;
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      document.body.removeChild(area);
      setCopied(idx);
      setSnackbar(true);
      setTimeout(() => setCopied(null), 2000);
    }
  };

  // 格式类型图标
  const getFormatIcon = () => {
    switch (formatType) {
      case "html":
        return <CodeRoundedIcon sx={{ fontSize: 18 }} />;
      case "markdown":
        return <ImageRoundedIcon sx={{ fontSize: 18 }} />;
      default:
        return <LinkRoundedIcon sx={{ fontSize: 18 }} />;
    }
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
                ? alpha(theme.palette.primary.main, 0.18)
                : alpha(theme.palette.primary.main, 0.1)
            }}
          >
            <BadgeRoundedIcon color="primary" />
          </Box>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 600 }}>
              Badge 生成器
            </Typography>
            <Typography variant="body2" color="text.secondary">
              生成状态徽章，可在任何地方嵌入使用
            </Typography>
          </Box>
        </Stack>

        <Stack direction="row" spacing={1.5} alignItems="center">
          <Chip
            size="small"
            label={`WebSocket: ${socketState}`}
            variant="outlined"
            sx={{ borderRadius: 2 }}
          />
          <Button
            variant="contained"
            startIcon={<RefreshRoundedIcon />}
            onClick={loadData}
            disabled={loading}
          >
            刷新数据
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

      {/* 配置面板 */}
      <Card elevation={0}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
            配置选项
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel id="badge-format">输出格式</InputLabel>
                <Select
                  labelId="badge-format"
                  label="输出格式"
                  value={formatType}
                  onChange={(e) => setFormatType(e.target.value)}
                  startAdornment={
                    <Box sx={{ mr: 1, display: "flex", alignItems: "center" }}>
                      {getFormatIcon()}
                    </Box>
                  }
                >
                  <MenuItem value="url">
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <LinkRoundedIcon sx={{ fontSize: 18 }} />
                      <span>URL</span>
                    </Stack>
                  </MenuItem>
                  <MenuItem value="html">
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <CodeRoundedIcon sx={{ fontSize: 18 }} />
                      <span>HTML</span>
                    </Stack>
                  </MenuItem>
                  <MenuItem value="markdown">
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <ImageRoundedIcon sx={{ fontSize: 18 }} />
                      <span>Markdown</span>
                    </Stack>
                  </MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel id="badge-hours">统计时间</InputLabel>
                <Select
                  labelId="badge-hours"
                  label="统计时间"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                >
                  {TIME_OPTIONS.map((item) => (
                    <MenuItem key={`${item.label}-${item.value}`} value={item.value}>
                      {item.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel id="badge-node">节点</InputLabel>
                <Select
                  labelId="badge-node"
                  label="节点"
                  value={nodeId}
                  onChange={(e) => setNodeId(e.target.value)}
                >
                  {nodes.map((n) => (
                    <MenuItem key={n.id} value={String(n.id)}>
                      {n.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel id="badge-player">玩家</InputLabel>
                <Select
                  labelId="badge-player"
                  label="玩家"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                >
                  {(players.length ? players : ["Steve"]).map((name) => (
                    <MenuItem key={name} value={name}>
                      {name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* 徽章表格 */}
      <Card elevation={0}>
        <CardContent sx={{ p: 3, overflowX: "auto" }}>
          <Table size="small" sx={{ minWidth: 900 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 80 }}>类型</TableCell>
                <TableCell sx={{ width: 150 }}>名称</TableCell>
                <TableCell sx={{ width: 200 }}>预览</TableCell>
                <TableCell>输出</TableCell>
                <TableCell sx={{ width: 80 }} align="center">操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row, idx) => {
                if (row.section) {
                  return (
                    <TableRow key={`section-${idx}`}>
                      <TableCell colSpan={5}>
                        <Stack
                          direction="row"
                          alignItems="center"
                          spacing={1}
                          sx={{
                            py: 1,
                            px: 1.5,
                            bgcolor: isDark
                              ? alpha(theme.palette.primary.main, 0.08)
                              : alpha(theme.palette.primary.main, 0.04),
                            borderRadius: 2,
                            my: 0.5
                          }}
                        >
                          {row.icon}
                          <Typography
                            variant="subtitle2"
                            sx={{ fontWeight: 600 }}
                          >
                            {row.section}
                          </Typography>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                }
                const rawUrl = `${apiBase}${row.path}`;
                const previewUrl = `${rawUrl}${rawUrl.includes("?") ? "&" : "?"}t=${refreshSalt}`;
                const output = formatOutput(rawUrl, formatType);

                return (
                  <TableRow
                    key={`${row.path}-${idx}`}
                    sx={{
                      transition: theme.transitions.create("background-color", {
                        duration: theme.transitions.duration.short
                      }),
                      "&:hover": {
                        bgcolor: isDark
                          ? alpha(theme.palette.surface?.on || "#fff", 0.04)
                          : alpha(theme.palette.primary.main, 0.02)
                      }
                    }}
                  >
                    <TableCell>
                      <Chip
                        label={row.type}
                        size="small"
                        variant="outlined"
                        sx={{
                          borderRadius: 1.5,
                          fontSize: "0.6875rem",
                          height: 24
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {row.name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box
                        sx={{
                          p: 1,
                          borderRadius: 2,
                          bgcolor: isDark
                            ? alpha(theme.palette.surface?.variant || "#333", 0.2)
                            : alpha(theme.palette.background.default, 1),
                          display: "inline-flex"
                        }}
                      >
                        <img
                          src={previewUrl}
                          alt={row.name}
                          style={{
                            display: "block",
                            height: 20
                          }}
                        />
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          p: 1,
                          borderRadius: 2,
                          bgcolor: isDark
                            ? alpha(theme.palette.surface?.variant || "#333", 0.15)
                            : alpha(theme.palette.background.default, 0.8),
                          border: "1px solid",
                          borderColor: "divider"
                        }}
                      >
                        <Typography
                          variant="body2"
                          sx={{
                            fontFamily: '"JetBrains Mono", monospace',
                            fontSize: "0.75rem",
                            wordBreak: "break-all",
                            flex: 1,
                            color: "text.secondary"
                          }}
                        >
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
                            borderRadius: 2,
                            bgcolor: copied === idx
                              ? alpha(theme.palette.success.main, 0.12)
                              : "transparent",
                            color: copied === idx
                              ? "success.main"
                              : "text.secondary",
                            "&:hover": {
                              bgcolor: isDark
                                ? alpha(theme.palette.surface?.on || "#fff", 0.08)
                                : alpha(theme.palette.primary.main, 0.08)
                            }
                          }}
                        >
                          {copied === idx ? (
                            <CheckRoundedIcon sx={{ fontSize: 18 }} />
                          ) : (
                            <ContentCopyRoundedIcon sx={{ fontSize: 18 }} />
                          )}
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

      {/* 复制成功提示 */}
      <Snackbar
        open={snackbar}
        autoHideDuration={2000}
        onClose={() => setSnackbar(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        message="已复制到剪贴板"
        sx={{
          "& .MuiSnackbarContent-root": {
            borderRadius: 3,
            bgcolor: isDark
              ? alpha(theme.palette.success.main, 0.2)
              : theme.palette.success.main,
            color: isDark
              ? theme.palette.success.light
              : "#fff"
          }
        }}
      />
    </Stack>
  );
}
