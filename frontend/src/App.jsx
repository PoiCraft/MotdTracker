import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Box, CircularProgress } from "@mui/material";
import Layout from "./components/Layout";
import { WebSocketProvider } from "./utils/ws";

const ServerPage = lazy(() => import("./pages/ServerPage"));
const NodesPage = lazy(() => import("./pages/NodesPage"));
const NodeDetailPage = lazy(() => import("./pages/NodeDetailPage"));
const PlayersPage = lazy(() => import("./pages/PlayersPage"));
const PlayerDetailPage = lazy(() => import("./pages/PlayerDetailPage"));
const BadgesPage = lazy(() => import("./pages/BadgesPage"));

function PageFallback() {
  return (
    <Box
      sx={{
        minHeight: "40vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <CircularProgress size={28} />
    </Box>
  );
}

export default function App() {
  return (
    <WebSocketProvider>
      <Layout>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/" element={<Navigate to="/server" replace />} />
            <Route path="/server" element={<ServerPage />} />
            <Route path="/nodes" element={<NodesPage />} />
            <Route path="/nodes/:nodeId" element={<NodeDetailPage />} />
            <Route path="/players" element={<PlayersPage />} />
            <Route path="/players/:playerName" element={<PlayerDetailPage />} />
            <Route path="/player/:playerName" element={<PlayerDetailPage />} />
            <Route path="/badges" element={<BadgesPage />} />
          </Routes>
        </Suspense>
      </Layout>
    </WebSocketProvider>
  );
}