import { useEffect, useState } from 'react'
import { apiService, ServerNode } from '../services/api'
import { useWebSocket } from '../hooks/useWebSocket'
import './NodesPage.css'

function NodesPage() {
  const [nodes, setNodes] = useState<ServerNode[]>([])
  const [loading, setLoading] = useState(true)
  const { lastUpdate } = useWebSocket()

  useEffect(() => {
    loadNodes()
  }, [lastUpdate])

  const loadNodes = async () => {
    try {
      setLoading(true)
      const data = await apiService.getNodes()
      setNodes(data)
    } catch (error) {
      console.error('Failed to load nodes:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading && nodes.length === 0) {
    return <div className="loading-container"><div className="spinner"></div></div>
  }

  return (
    <div className="nodes-page">
      <div className="page-header">
        <h1>节点列表</h1>
      </div>

      <div className="nodes-list">
        {nodes.map(node => (
          <div key={node.id} className={`node-item ${node.online ? 'online' : 'offline'}`}>
            <div className="node-main">
              <div className="node-info-group">
                <h3 className="node-title">{node.name}</h3>
                <div className="node-address">{node.host}:{node.port}</div>
              </div>
              <div className={`node-badge ${node.online ? 'online' : 'offline'}`}>
                {node.online ? '在线' : '离线'}
              </div>
            </div>
            
            {node.online && (
              <div className="node-details">
                {node.latency !== undefined && (
                  <div className="detail-item">
                    <span className="detail-label">延迟</span>
                    <span className="detail-value">{node.latency.toFixed(0)}ms</span>
                  </div>
                )}
                {node.players_online !== undefined && (
                  <div className="detail-item">
                    <span className="detail-label">玩家</span>
                    <span className="detail-value">{node.players_online}/{node.players_max}</span>
                  </div>
                )}
                {node.version && (
                  <div className="detail-item">
                    <span className="detail-label">版本</span>
                    <span className="detail-value">{node.version}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default NodesPage
