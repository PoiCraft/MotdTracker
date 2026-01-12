import { NavLink } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useWebSocket } from '../hooks/useWebSocket'
import './Sidebar.css'

function Sidebar() {
  const [version, setVersion] = useState('v1.0.0')
  const { connected } = useWebSocket()

  useEffect(() => {
    // Fetch version from API
    fetch('/api/web/status')
      .then(res => res.json())
      .then(data => {
        if (data.version) {
          setVersion(data.version)
        }
      })
      .catch(() => {})
  }, [])

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h1 className="sidebar-title">MotdTracker</h1>
      </div>

      <nav className="sidebar-nav">
        <NavLink to="/server" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
          <span className="nav-icon">🖥️</span>
          <span>服务器</span>
        </NavLink>
        <NavLink to="/nodes" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
          <span className="nav-icon">📡</span>
          <span>节点</span>
        </NavLink>
        <NavLink to="/players" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
          <span className="nav-icon">👥</span>
          <span>玩家</span>
        </NavLink>
        <NavLink to="/badges" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
          <span className="nav-icon">🏷️</span>
          <span>Badges</span>
        </NavLink>
        <a href="/api/docs" className="nav-link" target="_blank" rel="noreferrer">
          <span className="nav-icon">📚</span>
          <span>API 文档</span>
        </a>
      </nav>

      <div className="sidebar-footer">
        <div className="version-info">{version}</div>
        <div className={`ws-status ${connected ? 'connected' : 'disconnected'}`}>
          <span className="status-dot"></span>
          <span className="status-text">{connected ? '已连接' : '未连接'}</span>
        </div>
      </div>
    </aside>
  )
}

export default Sidebar
