import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import ServerPage from "./pages/ServerPage";
import NodesPage from "./pages/NodesPage";
import NodeDetailPage from "./pages/NodeDetailPage";
import PlayersPage from "./pages/PlayersPage";
import PlayerDetailPage from "./pages/PlayerDetailPage";
import BadgesPage from "./pages/BadgesPage";

export default function App() {
  return (
    <Layout>
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
    </Layout>
  );
}