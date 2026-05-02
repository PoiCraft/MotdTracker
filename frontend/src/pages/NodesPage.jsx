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
  LinearProgress,
  Stack,
  Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import DnsRoundedIcon from "@mui/icons-material/DnsRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import AccessTimeRoundedIcon from "@mui/icons-material/AccessTimeRounded";
import SpeedRoundedIcon from "@mui/icons-material/SpeedRounded";
import PeopleRoundedIcon from "@mui/icons-material/PeopleRounded";
import StatusPill, { StatusDot } from "../components/StatusPill";
import { api } from "../api";
import { useWsEvent } from "../utils/ws";
import { formatTime } from "../utils/format";

function NodeCard({ node }) {
  const theme = useTheme();
  const md3 = theme.md3?.colors;
  const isDark = theme.md3?.isDark;
  const status = node.latest_status;
  const online = Boolean(status?.online);

  return (
    <Card
      variant="outlined"
      sx={{
        height: "100%",
        borderColor: md3?.outlineVariant,
        backgroundColor: md3?.surfaceContainerLow,
        transition: "box-shadow 200ms cubic-bezier(0.2,0,0,1), border-color 200ms",
        "&:hover": {
          boxShadow: theme.shadows[1],
          borderColor: online ? md3?.primary : md3?.error,
        },
      }}
    >
      <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
        <Stack spacing={2}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Stack direction="row" alignItems="center" spacing={1}>
              <StatusDot online={online} size={8} />
              <Box>
                <Typography
                  variant="subtitle1"
                  sx={{
                    fontWeight: 500,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    maxWidth: 160,
                  }}
                >
                  {node.name}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    color: md3?.onSurfaceVariant,
                    fontFamily: '"JetBrains Mono", monospace',
                  }}
                >
                  {node.host}:{node.port}
                </Typography>
              </Box>
            </Stack>
            <StatusPill online={online} size="small" />
          </Stack>

          <Grid container spacing={1}>
            <Grid item xs={6}>
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  bgcolor: md3?.surfaceContainerHighest,
                }}
              >
                <Stack direction="row" alignItems="center" spacing={0.5} mb={0.5}>
                  <SpeedRoundedIcon
                    sx={{ fontSize: 14, color: md3?.onSurfaceVariant }}
                  />
                  <Typography
                    variant="caption"
                    sx={{ color: md3?.onSurfaceVariant }}
                  >
                    延迟
                  </Typography>
                </Stack>
                <Typography
                  variant="subtitle2"
                  sx={{
                    fontWeight: 600,
                    fontFeatureSettings: '"tnum"',
                  }}
                >
                  {status?.latency ? `${Math.round(status.latency)}ms` : "—"}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6}>
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  bgcolor: md3?.surfaceContainerHighest,
                }}
              >
                <Stack direction="row" alignItems="center" spacing={0.5} mb={0.5}>
                  <PeopleRoundedIcon
                    sx={{ fontSize: 14, color: md3?.onSurfaceVariant }}
                  />
                  <Typography
                    variant="caption"
                    sx={{ color: md3?.onSurfaceVariant }}
                  >
                    玩家
                  </Typography>
                </Stack>
                <Typography
                  variant="subtitle2"
                  sx={{
                    fontWeight: 600,
                    fontFeatureSettings: '"tnum"',
                  }}
                >
                  {status?.players_online ?? 0}/{status?.players_max ?? 0}
                </Typography>
              </Box>
            </Grid>
          </Grid>

          <Stack spacing={0.5}>
            <Stack direction="row" alignItems="center" spacing={0.75}>
              <AccessTimeRoundedIcon
                sx={{ fontSize: 14, color: md3?.outline }}
              />
              <Typography variant="body2" sx={{ color: md3?.onSurfaceVariant }}>
                版本: {status?.version || "—"}
              </Typography>
            </Stack>
            <Typography variant="body2" sx={{ color: md3?.outline, pl: 2.75 }}>
              {formatTime(status?.timestamp)}
            </Typography>
          </Stack>

          <Button
            component={Link}
            to={`/nodes/${node.id}`}
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

export default function NodesPage() {
  const theme = useTheme();
  const md3 = theme.md3?.colors;
  const [nodes, setNodes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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

  const wsState = useWsEvent(() => loadNodes());

  const stats = useMemo(() => {
    const on = nodes.filter((n) => n.latest_status?.online);
    const lats = on
      .map((n) => n.latest_status?.latency)
      .filter((l) => l != null);
    return {
      onlineCount: on.length,
      avgLatency:
        lats.length > 0
          ? Math.round(lats.reduce((a, b) => a + b, 0) / lats.length)
          : null,
      totalPlayers: on.reduce(
        (s, n) => s + (n.latest_status?.players_online || 0),
        0
      ),
    };
  }, [nodes]);

  return (
    <Stack spacing={3}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", sm: "center" }}
        spacing={2}
      >
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 500, mb: 0.25 }}>
            节点总览
          </Typography>
          <Typography variant="body2" sx={{ color: md3?.onSurfaceVariant }}>
            {nodes.length} 个节点 · 在线 {stats.onlineCount}
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<RefreshRoundedIcon />}
          onClick={loadNodes}
          disabled={loading}
        >
          刷新
        </Button>
      </Stack>

      <Stack direction="row" spacing={1}>
        <Chip
          size="small"
          label={`WebSocket: ${wsState}`}
          variant="outlined"
        />
        {stats.avgLatency != null && (
          <Chip
            size="small"
            label={`平均延迟: ${stats.avgLatency}ms`}
            variant="outlined"
          />
        )}
        <Chip
          size="small"
          label={`在线玩家: ${stats.totalPlayers}`}
          variant="outlined"
        />
      </Stack>

      {loading && <LinearProgress />}
      {error && <Alert severity="error">{error}</Alert>}

      <Grid container spacing={2}>
        {nodes.map((node) => (
          <Grid key={node.id} item xs={12} sm={6} lg={4} xl={3}>
            <NodeCard node={node} />
          </Grid>
        ))}
      </Grid>

      {!loading && nodes.length === 0 && (
        <Card variant="outlined" sx={{ borderColor: md3?.outlineVariant }}>
          <CardContent sx={{ py: 8, textAlign: "center" }}>
            <DnsRoundedIcon
              sx={{ fontSize: 48, color: md3?.outline, mb: 2 }}
            />
            <Typography variant="subtitle1" sx={{ color: md3?.onSurfaceVariant }}>
              暂无节点数据
            </Typography>
            <Typography variant="body2" sx={{ color: md3?.outline }}>
              请检查后端配置或添加新的监控节点
            </Typography>
          </CardContent>
        </Card>
      )}
    </Stack>
  );
}
