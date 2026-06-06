// ─── API Types — exactly matching the Rust backend ─────────────────────────

export interface AppStatus {
  version: string
  server_name: string
  poll_interval: number
  port: number
  group_count: number
  server_count: number
  node_count: number
}

export interface GroupItem {
  id: string
  name: string
  sort_order: number
  server_count: number
  online_node_count: number
  total_node_count: number
  total_players_online: number
}

export interface GroupDetail {
  id: string
  name: string
  sort_order: number
  servers: Array<{
    id: string
    name: string
    group_id: string | null
    sort_order: number
    node_count: number
    online_node_count: number
    total_players_online: number
    avg_latency: number | null
  }>
}

export interface ServerAggregate {
  online: boolean
  online_node_count: number
  total_node_count: number
  total_players_online: number
  total_players_max: number
  avg_latency: number | null
}

export interface ServerItem {
  id: string
  group_id: string | null
  name: string
  sort_order: number
  aggregate: ServerAggregate
}

export interface ServerDetail {
  id: string
  group_id: string | null
  name: string
  sort_order: number
  nodes: NodeWithStats[]
  aggregate: ServerAggregate
}

export interface NodeStatus {
  timestamp: string
  online: boolean
  latency: number | null
  players_online: number | null
  players_max: number | null
  version: string | null
  motd: string | null
}

export interface LatencyStats {
  uptime_percentage: number
  avg_latency: number | null
  std_dev: number | null
  min_latency: number | null
  max_latency: number | null
  p95_latency: number | null
  cv: number | null
  total_checks: number
  online_checks: number
}

/** Matches NodeWithStats from backend (serde(flatten) on Node) */
export interface NodeWithStats {
  id: string
  server_id: string
  name: string
  host: string
  port: number
  edition: string
  color?: string | null
  enabled: boolean
  sort_order: number
  created_at?: string
  updated_at?: string
  latest_status?: NodeStatus | null
  latency_stats?: LatencyStats | null
}

export interface StatusLog {
  id: number
  node_id: string
  timestamp: string
  online: boolean
  latency: number | null
  players_online: number | null
  players_max: number | null
  version: string | null
  motd: string | null
  sample_players: string | null
}

export interface PlayerServerEntry {
  node_id: string
  node_name: string
  server_id: string
  server_name: string
  online: boolean
  first_seen: string
  last_seen: string
}

export interface PlayerListItem {
  player_name: string
  online: boolean
  session_start: string | null
  last_seen: string | null
  duration_seconds: number | null
  servers: PlayerServerEntry[]
}

export interface PlayerSessionHistory {
  id: number
  server_id: string
  player_name: string
  session_start: string
  session_end: string
}

export interface PlayerHeatmap {
  hour: number
  weekday: number
  count: number
}

export interface DailyStats {
  date: string
  total_minutes: number
}

export interface PlayerWeeklyStats {
  player_name: string
  daily_stats: DailyStats[]
}

export interface PlayerDetail {
  player_name: string
  online: boolean
  session_start: string | null
  last_seen: string
  duration_seconds: number | null
  servers: PlayerServerEntry[]
  sessions: PlayerSessionHistory[]
}

export interface AdminSettings {
  server_name: string
  poll_interval: number
  webhook_alert: {
    url: string
    method: string
    headers: Record<string, string>
    body: string
    delta_minutes: number
    offline_confirm_frames: number
    online_confirm_frames: number
    enable: boolean
  }
}

export interface AdminGroup {
  id: string
  name: string
  sort_order: number
}

export interface AdminServer {
  id: string
  group_id: string | null
  name: string
  sort_order: number
  created_at: string
  updated_at: string
}

export interface AdminNode {
  id: string
  server_id: string
  name: string
  host: string
  port: number
  edition: string
  color: string
  enabled: boolean
  sort_order: number
  created_at: string
  updated_at: string
}
