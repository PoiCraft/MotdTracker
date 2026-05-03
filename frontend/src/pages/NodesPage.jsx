import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
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
import M3StatusTag from "../components/M3StatusTag";
import MetricGrid from "../components/MetricGrid";
import { api } from "../api";
import { useWsEvent } from "../utils/ws";
import { formatTime } from "../utils/format";

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
          }}
        >
          {value}
        </Typography>
      </Box>
    </Box>
  );
}

function getLatencyTone(latency, online, c) {
  if (!online || latency == null) {
    return { color: c?.outline || "#5F6368", emphasis: false };
  }
  if (latency <= 80) {
    return { color: c?.success || "#188038", emphasis: false };
  }
  if (latency <= 180) {
    return { color: c?.warning || "#B05D00", emphasis: false };
  }
  return { color: c?.error || "#B3261E", emphasis: true };
}

function getPlayerLoadTone(currentPlayers, maxPlayers, online, c) {
  if (!online) {
    return { color: c?.outline || "#5F6368", emphasis: false };
  }
  const max = Number(maxPlayers || 0);
  const cur = Number(currentPlayers || 0);
  const ratio = max > 0 ? cur / max : 0;

  if (ratio >= 0.85) {
    return { color: c?.error || "#B3261E", emphasis: true };
  }
  if (ratio >= 0.6) {
    return { color: c?.warning || "#B05D00", emphasis: true };
  }
  return { color: c?.primary || "#1A73E8", emphasis: false };
}

function NodeCard({ node }) {
  const theme = useTheme();
  const c = theme.gemini?.colors;
  const status = node.latest_status;
  const online = Boolean(status?.online);
  const latencyTone = getLatencyTone(status?.latency, online, c);
  const playerLoadTone = getPlayerLoadTone(
    status?.players_online,
    status?.players_max,
    online,
    c
  );

  return (
    <Card
      elevation={0}
      sx={{
        height: "100%",
        position: "relative",
        backgroundColor: online ? c?.successContainer : c?.errorContainer,
        filter: online ? "none" : "saturate(0.62)",
      }}
    >
      <Box sx={{ position: "absolute", top: 16, right: 16, zIndex: 1 }}>
        <M3StatusTag online={online} size="small" />
      </Box>
          <CardContent sx={{ p: 4, "&:last-child": { pb: 4 } }}>
        <Stack spacing={2}>
          <Stack direction="row" alignItems="center">
            <Box>
              <Typography
                variant="subtitle1"
                sx={{
                  fontWeight: 500,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  maxWidth: 200,
                }}
              >
                {node.name}
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  color: c?.onSurfaceVariant,
                  fontFamily: '"JetBrains Mono", monospace',
                }}
              >
                {node.host}:{node.port}
              </Typography>
            </Box>
          </Stack>

          <Stack direction="row" spacing={1} sx={{ width: "100%" }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <StatPill
                icon={<SpeedRoundedIcon />}
                label="延迟"
                value={status?.latency ? `${Math.round(status.latency)}ms` : "—"}
                color={latencyTone.color}
                emphasis={latencyTone.emphasis}
                muted={!online}
              />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <StatPill
                icon={<PeopleRoundedIcon />}
                label="玩家"
                value={`${status?.players_online ?? 0}/${status?.players_max ?? 0}`}
                color={playerLoadTone.color}
                emphasis={playerLoadTone.emphasis}
                muted={!online}
              />
            </Box>
          </Stack>

          <Stack spacing={0.5}>
            <Stack direction="row" alignItems="center" spacing={0.75}>
              <AccessTimeRoundedIcon
                sx={{ fontSize: 14, color: c?.outline }}
              />
              <Typography variant="body2" sx={{ color: c?.onSurfaceVariant }}>
                版本: {status?.version || "—"}
              </Typography>
            </Stack>
            <Typography variant="body2" sx={{ color: c?.outline, pl: 2.75 }}>
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
  const c = theme.gemini?.colors;
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

  useWsEvent(() => loadNodes());

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
          <Typography variant="h5" sx={{ fontWeight: 600, mb: 0.25 }}>
            节点总览
          </Typography>
          <Typography variant="body2" sx={{ color: c?.onSurfaceVariant }}>
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

      <Stack direction="row" spacing={1} alignItems="center">
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

      <MetricGrid itemSize={{ xs: 12, sm: 6, lg: 4 }}>
        {nodes.map((node) => (
          <NodeCard key={node.id} node={node} />
        ))}
      </MetricGrid>

      {!loading && nodes.length === 0 && (
        <Card elevation={0}>
          <CardContent sx={{ py: 8, textAlign: "center" }}>
            <DnsRoundedIcon
              sx={{ fontSize: 48, color: c?.outline, mb: 2 }}
            />
            <Typography variant="subtitle1" sx={{ color: c?.onSurfaceVariant }}>
              暂无节点数据
            </Typography>
            <Typography variant="body2" sx={{ color: c?.outline }}>
              请检查后端配置或添加新的监控节点
            </Typography>
          </CardContent>
        </Card>
      )}
    </Stack>
  );
}
