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
  Typography,
  alpha,
  useTheme
} from "@mui/material";
import DnsRoundedIcon from "@mui/icons-material/DnsRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import AccessTimeRoundedIcon from "@mui/icons-material/AccessTimeRounded";
import SpeedRoundedIcon from "@mui/icons-material/SpeedRounded";
import PeopleRoundedIcon from "@mui/icons-material/PeopleRounded";
import InfoRoundedIcon from "@mui/icons-material/InfoRounded";
import StatusPill, { StatusDot } from "../components/StatusPill";
import { api, SOCKET_BASE } from "../api";
import { formatTime } from "../utils/format";

/**
 * Material You 风格的节点卡片组件
 */
function NodeCard({ node }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const status = node.latest_status;
  const online = Boolean(status?.online);

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
          height: 4,
          bgcolor: online
            ? isDark
              ? alpha(theme.palette.success.main, 0.6)
              : theme.palette.success.main
            : isDark
              ? alpha(theme.palette.error.main, 0.6)
              : theme.palette.error.main
        }}
      />

      <CardContent sx={{ p: 2.5 }}>
        <Stack spacing={2}>
          {/* 节点标题 */}
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <StatusDot online={online} size={10} />
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 600,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap"
                  }}
                >
                  {node.name}
                </Typography>
              </Stack>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  mt: 0.5,
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: "0.75rem"
                }}
              >
                {node.host}:{node.port}
              </Typography>
            </Box>
            <StatusPill online={online} size="small" />
          </Stack>

          {/* 指标网格 */}
          <Grid container spacing={1.5}>
            <Grid item xs={6}>
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  bgcolor: isDark
                    ? alpha(theme.palette.primary.main, 0.08)
                    : alpha(theme.palette.primary.main, 0.04)
                }}
              >
                <Stack direction="row" alignItems="center" spacing={0.75}>
                  <SpeedRoundedIcon
                    sx={{
                      fontSize: 16,
                      color: isDark
                        ? theme.palette.primary.light
                        : theme.palette.primary.main
                    }}
                  />
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ fontSize: "0.6875rem" }}
                  >
                    延迟
                  </Typography>
                </Stack>
                <Typography
                  variant="subtitle1"
                  sx={{
                    mt: 0.5,
                    fontWeight: 600,
                    fontFamily: '"Roboto Flex", sans-serif',
                    fontFeatureSettings: '"tnum"'
                  }}
                >
                  {status?.latency ? `${Math.round(status.latency)}ms` : "-"}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6}>
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  bgcolor: isDark
                    ? alpha(theme.palette.success.main, 0.08)
                    : alpha(theme.palette.success.main, 0.04)
                }}
              >
                <Stack direction="row" alignItems="center" spacing={0.75}>
                  <PeopleRoundedIcon
                    sx={{
                      fontSize: 16,
                      color: isDark
                        ? theme.palette.success.light
                        : theme.palette.success.main
                    }}
                  />
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ fontSize: "0.6875rem" }}
                  >
                    玩家
                  </Typography>
                </Stack>
                <Typography
                  variant="subtitle1"
                  sx={{
                    mt: 0.5,
                    fontWeight: 600,
                    fontFamily: '"Roboto Flex", sans-serif',
                    fontFeatureSettings: '"tnum"'
                  }}
                >
                  {status?.players_online ?? 0}/{status?.players_max ?? 0}
                </Typography>
              </Box>
            </Grid>
          </Grid>

          {/* 版本与时间信息 */}
          <Stack spacing={0.75}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <InfoRoundedIcon
                sx={{ fontSize: 14, color: "text.disabled" }}
              />
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontSize: "0.75rem" }}
              >
                版本: {status?.version || "-"}
              </Typography>
            </Stack>
            <Stack direction="row" alignItems="center" spacing={1}>
              <AccessTimeRoundedIcon
                sx={{ fontSize: 14, color: "text.disabled" }}
              />
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontSize: "0.75rem" }}
              >
                最近采样: {formatTime(status?.timestamp)}
              </Typography>
            </Stack>
          </Stack>

          {/* 操作按钮 */}
          <Button
            component={Link}
            to={`/nodes/${node.id}`}
            variant="contained"
            fullWidth
            sx={{
              mt: 1,
              borderRadius: 2
            }}
          >
            查看节点详情
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}

/**
 * Material You 风格的节点总览页面
 */
export default function NodesPage() {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const [nodes, setNodes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [socketState, setSocketState] = useState("connecting");

  const loadNodes = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await api.server.nodes();
      setNodes(Array.isArray(result) ? result : result?.nodes || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNodes();
  }, []);

  useEffect(() => {
    const socket = io(SOCKET_BASE, {
      path: "/api/socket.io",
      transports: ["websocket"]
    });
    socket.on("connect", () => setSocketState("connected"));
    socket.on("disconnect", () => setSocketState("disconnected"));
    socket.on("poll_complete", () => loadNodes());
    return () => socket.disconnect();
  }, []);

  const onlineCount = useMemo(
    () => nodes.filter((n) => n.latest_status?.online).length,
    [nodes]
  );

  // 统计数据
  const stats = useMemo(() => {
    const onlineNodes = nodes.filter((n) => n.latest_status?.online);
    const latencies = onlineNodes
      .map((n) => n.latest_status?.latency)
      .filter((l) => l != null);
    const avgLatency =
      latencies.length > 0
        ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
        : null;
    const totalPlayers = onlineNodes.reduce(
      (sum, n) => sum + (n.latest_status?.players_online || 0),
      0
    );
    return { onlineCount, avgLatency, totalPlayers };
  }, [nodes, onlineCount]);

  return (
    <Stack spacing={3}>
      {/* 页面标题栏 */}
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", sm: "center" }}
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
            <DnsRoundedIcon color="primary" />
          </Box>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 600 }}>
              节点总览
            </Typography>
            <Typography variant="body2" color="text.secondary">
              管理 {nodes.length} 个监控节点 · 在线 {stats.onlineCount} 个
            </Typography>
          </Box>
        </Stack>

        <Button
          variant="contained"
          startIcon={<RefreshRoundedIcon />}
          onClick={loadNodes}
          disabled={loading}
        >
          刷新
        </Button>
      </Stack>

      {/* 连接状态指示器 */}
      <Stack direction="row" spacing={2} alignItems="center">
        <Chip
          size="small"
          label={`WebSocket: ${socketState}`}
          variant="outlined"
          sx={{
            borderRadius: 2,
            fontSize: "0.75rem"
          }}
        />
        {stats.avgLatency && (
          <Chip
            size="small"
            label={`平均延迟: ${stats.avgLatency}ms`}
            variant="outlined"
            sx={{
              borderRadius: 2,
              fontSize: "0.75rem"
            }}
          />
        )}
        <Chip
          size="small"
          label={`总在线玩家: ${stats.totalPlayers}`}
          variant="outlined"
          sx={{
            borderRadius: 2,
            fontSize: "0.75rem"
          }}
        />
      </Stack>

      {/* 加载状态 */}
      {loading && <LinearProgress sx={{ borderRadius: 1 }} />}

      {/* 错误提示 */}
      {error && (
        <Alert severity="error" sx={{ borderRadius: 3 }}>
          {error}
        </Alert>
      )}

      {/* 节点卡片网格 */}
      <Grid container spacing={2}>
        {nodes.map((node) => (
          <Grid key={node.id} item xs={12} sm={6} lg={4} xl={3}>
            <NodeCard node={node} />
          </Grid>
        ))}
      </Grid>

      {/* 空状态 */}
      {!loading && nodes.length === 0 && (
        <Card
          elevation={0}
          sx={{
            borderRadius: 4,
            border: "2px dashed",
            borderColor: "divider"
          }}
        >
          <CardContent sx={{ py: 8, textAlign: "center" }}>
            <DnsRoundedIcon
              sx={{
                fontSize: 64,
                color: "text.disabled",
                mb: 2
              }}
            />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              暂无节点数据
            </Typography>
            <Typography variant="body2" color="text.disabled">
              请检查后端配置或添加新的监控节点
            </Typography>
          </CardContent>
        </Card>
      )}
    </Stack>
  );
}
