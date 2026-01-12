import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
})

export interface ServerNode {
  id: number
  name: string
  host: string
  port: number
  color?: string
  online: boolean
  latency?: number
  players_online?: number
  players_max?: number
  version?: string
}

export interface ServerStats {
  online_rate: number
  avg_latency?: number
  stddev_latency?: number
  min_latency?: number
  max_latency?: number
  p95_latency?: number
  cv?: number
}

export interface PlayerSession {
  id: number
  server_id: number
  player_name: string
  session_start: string
  session_end?: string
  is_online: boolean
}

export const apiService = {
  // Server APIs
  async getNodes(): Promise<ServerNode[]> {
    const response = await api.get('/server/nodes')
    return response.data.nodes || []
  },

  async getServerHistory(hours: number = 24): Promise<any> {
    const response = await api.get(`/server/history?hours=${hours}`)
    return response.data
  },

  async getServerStats(): Promise<ServerStats> {
    const response = await api.get('/server/stats')
    return response.data
  },

  // Node APIs
  async getNodeDetails(id: number): Promise<ServerNode> {
    const response = await api.get(`/node/${id}`)
    return response.data
  },

  async getNodeHistory(id: number, hours: number = 24): Promise<any> {
    const response = await api.get(`/node/${id}/history?hours=${hours}`)
    return response.data
  },

  async getNodeStats(id: number): Promise<ServerStats> {
    const response = await api.get(`/node/${id}/stats`)
    return response.data
  },

  // Player APIs
  async getPlayers(): Promise<any[]> {
    const response = await api.get('/player/list')
    return response.data.players || []
  },

  async getPlayerHistory(name: string, days?: number): Promise<PlayerSession[]> {
    const url = days ? `/player/${name}/history?days=${days}` : `/player/${name}/history`
    const response = await api.get(url)
    return response.data
  },

  // Web API
  async getStatus(): Promise<any> {
    const response = await api.get('/web/status')
    return response.data
  },
}

export default apiService
