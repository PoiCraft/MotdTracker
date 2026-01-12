import { useEffect, useState } from 'react'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import { apiService, ServerNode, ServerStats } from '../services/api'
import { useWebSocket } from '../hooks/useWebSocket'
import './ServerPage.css'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

function ServerPage() {
  const [nodes, setNodes] = useState<ServerNode[]>([])
  const [stats, setStats] = useState<ServerStats | null>(null)
  const [loading, setLoading] = useState(true)
  const { lastUpdate } = useWebSocket()

  useEffect(() => {
    loadData()
  }, [lastUpdate])

  const loadData = async () => {
    try {
      setLoading(true)
      const [nodesData, statsData] = await Promise.all([
        apiService.getNodes(),
        apiService.getServerStats(),
      ])
      setNodes(nodesData)
      setStats(statsData)
    } catch (error) {
      console.error('Failed to load server data:', error)
    } finally {
      setLoading(false)
    }
  }

  const onlineNodes = nodes.filter(n => n.online).length
  const totalPlayers = nodes.reduce((sum, n) => sum + (n.players_online || 0), 0)

  if (loading && nodes.length === 0) {
    return <div className="loading-container"><div className="spinner"></div></div>
  }

  return (
    <div className="server-page">
      <div className="page-header">
        <h1>服务器总览</h1>
        {lastUpdate && (
          <div className="last-update">
            最后更新: {lastUpdate.toLocaleTimeString('zh-CN')}
          </div>
        )}
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">在线率 (24h)</div>
          <div className="stat-value">
            {stats?.online_rate?.toFixed(1) || '--'}%
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">平均延迟</div>
          <div className="stat-value">
            {stats?.avg_latency?.toFixed(0) || '--'}ms
          </div>
          {stats?.stddev_latency && (
            <div className="stat-meta">±{stats.stddev_latency.toFixed(0)}ms</div>
          )}
        </div>
        <div className="stat-card">
          <div className="stat-label">在线玩家</div>
          <div className="stat-value">{totalPlayers}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">活跃节点</div>
          <div className="stat-value">
            {onlineNodes}/{nodes.length}
          </div>
        </div>
      </div>

      <div className="nodes-section">
        <h2>节点状态</h2>
        <div className="nodes-grid">
          {nodes.map(node => (
            <div key={node.id} className={`node-card ${node.online ? 'online' : 'offline'}`}>
              <div className="node-header">
                <div className="node-name">{node.name}</div>
                <div className={`node-status ${node.online ? 'online' : 'offline'}`}>
                  {node.online ? '在线' : '离线'}
                </div>
              </div>
              <div className="node-info">
                <div className="node-address">{node.host}:{node.port}</div>
                {node.online && (
                  <>
                    {node.latency !== undefined && (
                      <div className="node-latency">延迟: {node.latency.toFixed(0)}ms</div>
                    )}
                    {node.players_online !== undefined && (
                      <div className="node-players">
                        玩家: {node.players_online}/{node.players_max}
                      </div>
                    )}
                    {node.version && (
                      <div className="node-version">{node.version}</div>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {stats && (
        <div className="detailed-stats">
          <h2>延迟统计</h2>
          <div className="stats-details">
            <div className="stat-item">
              <span className="stat-item-label">最小值:</span>
              <span className="stat-item-value">{stats.min_latency?.toFixed(0) || '--'}ms</span>
            </div>
            <div className="stat-item">
              <span className="stat-item-label">最大值:</span>
              <span className="stat-item-value">{stats.max_latency?.toFixed(0) || '--'}ms</span>
            </div>
            <div className="stat-item">
              <span className="stat-item-label">P95:</span>
              <span className="stat-item-value">{stats.p95_latency?.toFixed(0) || '--'}ms</span>
            </div>
            <div className="stat-item">
              <span className="stat-item-label">变异系数:</span>
              <span className="stat-item-value">{stats.cv?.toFixed(2) || '--'}%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ServerPage
