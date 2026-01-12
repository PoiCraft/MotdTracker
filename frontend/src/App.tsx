import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import ServerPage from './pages/ServerPage'
import NodesPage from './pages/NodesPage'
import PlayersPage from './pages/PlayersPage'
import BadgesPage from './pages/BadgesPage'
import './App.css'

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to="/server" replace />} />
          <Route path="/server" element={<ServerPage />} />
          <Route path="/nodes" element={<NodesPage />} />
          <Route path="/players" element={<PlayersPage />} />
          <Route path="/badges" element={<BadgesPage />} />
        </Routes>
      </Layout>
    </Router>
  )
}

export default App
