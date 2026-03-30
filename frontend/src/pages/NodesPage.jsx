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
  Typography
} from "@mui/material";
import { api, SOCKET_BASE } from "../api";
import { formatTime } from "../utils/format";

function NodeCard({ node }) {
  const status = node.latest_status;
  const online = Boolean(status?.online);

  return (
    <Card variant="outlined" sx={{ height: "100%" }}>
      <CardContent>
        <Stack spacing={1.2}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
            <Box>
              <Typography variant="h6">{node.name}</Typography>
              <Typography color="text.secondary" variant="body2">{node.host}:{node.port}</Typography>
            </Box>
            <Chip size="small" color={online ? "success" : "default"} label={online ? "在线" : "离线"} />
          </Stack>

          <Grid container spacing={1}>
            <Grid item xs={6}>
              <Typography variant="body2" color="text.secondary">延迟</Typography>
              <Typography variant="subtitle1">{status?.latency ? `${Math.round(status.latency)}ms` : "-"}</Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="body2" color="text.secondary">玩家</Typography>
              <Typography variant="subtitle1">{status?.players_online ?? 0}/{status?.players_max ?? 0}</Typography>
            </Grid>
          </Grid>

          <Typography variant="body2" color="text.secondary">版本: {status?.version || "-"}</Typography>
          <Typography variant="body2" color="text.secondary">最近采样: {formatTime(status?.timestamp)}</Typography>

          <Button component={Link} to={`/nodes/${node.id}`} variant="contained" size="small">
            查看节点详情
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}

export default function NodesPage() {
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
    const socket = io(SOCKET_BASE, { path: "/api/socket.io", transports: ["websocket"] });
    socket.on("connect", () => setSocketState("connected"));
    socket.on("disconnect", () => setSocketState("disconnected"));
    socket.on("poll_complete", () => {
      loadNodes();
    });
    return () => socket.disconnect();
  }, []);

  const onlineCount = useMemo(() => nodes.filter((n) => n.latest_status?.online).length, [nodes]);

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }} spacing={1}>
        <Box>
          <Typography variant="h4">节点总览</Typography>
          <Typography color="text.secondary">在线 {onlineCount}/{nodes.length} · Socket: {socketState}</Typography>
        </Box>
        <Button variant="contained" onClick={loadNodes}>刷新</Button>
      </Stack>

      {loading ? <LinearProgress /> : null}
      {error ? <Alert severity="error">{error}</Alert> : null}

      <Grid container spacing={1.5}>
        {nodes.map((node) => (
          <Grid key={node.id} item xs={12} sm={6} lg={4}>
            <NodeCard node={node} />
          </Grid>
        ))}
      </Grid>

      {!loading && nodes.length === 0 ? (
        <Card variant="outlined"><CardContent><Typography color="text.secondary">暂无节点数据</Typography></CardContent></Card>
      ) : null}
    </Stack>
  );
}
