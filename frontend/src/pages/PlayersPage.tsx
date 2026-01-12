import { useEffect, useState } from 'react'
import { apiService } from '../services/api'
import './PlayersPage.css'

interface Player {
  name: string
  server_name: string
  session_start: string
  duration_seconds: number
}

function PlayersPage() {
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadPlayers()
  }, [])

  const loadPlayers = async () => {
    try {
      setLoading(true)
      const data = await apiService.getPlayers()
      setPlayers(data)
    } catch (error) {
      console.error('Failed to load players:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    if (hours > 0) {
      return `${hours}h ${minutes}m`
    }
    return `${minutes}m`
  }

  if (loading) {
    return <div className="loading-container"><div className="spinner"></div></div>
  }

  return (
    <div className="players-page">
      <div className="page-header">
        <h1>在线玩家</h1>
        <div className="player-count">{players.length} 名玩家在线</div>
      </div>

      {players.length === 0 ? (
        <div className="empty-state">
          <p>当前没有玩家在线</p>
        </div>
      ) : (
        <div className="players-grid">
          {players.map((player, index) => (
            <div key={index} className="player-card">
              <div className="player-avatar">👤</div>
              <div className="player-info">
                <div className="player-name">{player.name}</div>
                <div className="player-server">{player.server_name}</div>
                <div className="player-duration">
                  在线时长: {formatDuration(player.duration_seconds)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default PlayersPage
