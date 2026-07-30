/**
 * StatusLog / 玩家会话的派生逻辑（纯函数，无 React 依赖）
 *
 * 收编原先嵌在各页面组件里的数据变换：
 * - 历史分桶（aggregateServerHistory / aggregateHistory / aggregateHourly）
 * - 多节点延迟序列（buildLatencyChartData + LATENCY_CHART_COLORS）
 * - 会话统计（computeSessionStats）
 * - 在线玩家提取（extractLatestOnlinePlayers / parseSamplePlayers）
 *
 * 时区约定：后端返回 GMT+8 无时区字符串，new Date() 按浏览器本地时区解析，
 * 分桶与格式化均使用本地时间方法（getHours / toLocaleTimeString）。
 */
import type { StatusLog, NodeWithStats, PlayerSessionHistory } from "@/api/types"

/** 多节点延迟图表的调色板（节点未配置颜色时按序取用） */
export const LATENCY_CHART_COLORS = [
  "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6",
  "#EC4899", "#06B6D4", "#84CC16", "#F97316", "#6366F1",
  "#14B8A6", "#A855F7",
]

const HH_MM: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" }

/** 解析 sample_players JSON 字符串，非法输入返回 [] */
export function parseSamplePlayers(samplePlayers: string | null | undefined): string[] {
  if (!samplePlayers) return []
  try {
    return JSON.parse(samplePlayers) as string[]
  } catch {
    return []
  }
}

/** 按时间戳分组，每个时间戳下每个节点保留最新一条（同刻后来者胜出） */
function groupByTimeKeepLatest(history: StatusLog[]): [string, Map<string, StatusLog>][] {
  const byTime = new Map<string, Map<string, StatusLog>>()
  for (const log of history) {
    if (!byTime.has(log.timestamp)) {
      byTime.set(log.timestamp, new Map())
    }
    byTime.get(log.timestamp)!.set(log.node_id, log)
  }
  return Array.from(byTime.entries()).sort(
    (a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime()
  )
}

export interface ServerHistoryPoint {
  time: string
  onlineNodes: number
  totalPlayers: number
  totalNodes: number
}

/** 服务器维度历史：每个时间点在线节点数与玩家总数 */
export function aggregateServerHistory(
  history: StatusLog[],
  totalNodes: number
): ServerHistoryPoint[] {
  if (history.length === 0) return []

  return groupByTimeKeepLatest(history).map(([timestamp, nodeMap]) => {
    let onlineNodes = 0
    let totalPlayers = 0
    for (const log of nodeMap.values()) {
      if (log.online) {
        onlineNodes++
        totalPlayers += log.players_online ?? 0
      }
    }
    return {
      time: new Date(timestamp).toLocaleTimeString([], HH_MM),
      onlineNodes,
      totalPlayers,
      totalNodes,
    }
  })
}

export interface LatencyChartData {
  data: Record<string, number | string | null>[]
  nodes: { id: string; name: string; color: string }[]
}

/** 将 StatusLog[] 转换为多节点延迟趋势图表数据（离线/无延迟为 null，图表断线） */
export function buildLatencyChartData(
  history: StatusLog[],
  serverNodes: NodeWithStats[]
): LatencyChartData {
  if (history.length === 0) return { data: [], nodes: [] }

  // 从服务器节点列表构建 id -> { name, color } 映射
  const nodeMeta = new Map<string, { name: string; color: string | null }>()
  for (const n of serverNodes) {
    nodeMeta.set(n.id, { name: n.name, color: n.color && n.color.trim() ? n.color : null })
  }

  // 收集历史记录中出现的所有节点 id（保持 serverNodes 顺序，再追加未在列表中的）
  const seenIds = new Set<string>()
  const orderedIds: string[] = []
  for (const n of serverNodes) {
    orderedIds.push(n.id)
    seenIds.add(n.id)
  }
  for (const log of history) {
    if (!seenIds.has(log.node_id)) {
      orderedIds.push(log.node_id)
      seenIds.add(log.node_id)
    }
  }

  // 构建图表数据：每个时间点一个对象 { time, [nodeId]: latency | null }
  const data = groupByTimeKeepLatest(history).map(([timestamp, nodeMap]) => {
    const point: Record<string, number | string | null> = {
      time: new Date(timestamp).toLocaleTimeString([], HH_MM),
    }
    for (const nodeId of orderedIds) {
      const log = nodeMap.get(nodeId)
      point[nodeId] = log && log.online && log.latency != null
        ? Math.round(log.latency)
        : null
    }
    return point
  })

  const nodes = orderedIds.map((id, i) => {
    const meta = nodeMeta.get(id)
    return {
      id,
      name: meta?.name ?? id,
      // 优先使用节点配置的颜色，没有则用调色板
      color: meta?.color ?? LATENCY_CHART_COLORS[i % LATENCY_CHART_COLORS.length],
    }
  })

  return { data, nodes }
}

/** 从历史记录（新到旧排序）中提取最近出现过的在线玩家，去重排序 */
export function extractLatestOnlinePlayers(history: StatusLog[]): string[] {
  const set = new Set<string>()
  // Iterate from latest to oldest to gather sample players
  for (let i = history.length - 1; i >= 0; i--) {
    const log = history[i]
    if (!log.players_online) continue
    for (const p of parseSamplePlayers(log.sample_players)) {
      set.add(p)
    }
  }
  return Array.from(set).sort()
}

export interface TrendSeries {
  onlineNodes: number[]
  totalPlayers: number[]
}

/** 多服务器历史按 sampleCount 个时间窗口分桶：每窗口在线节点数与玩家总数 */
export function aggregateHistory(histories: StatusLog[][], sampleCount = 12): TrendSeries {
  const empty: TrendSeries = { onlineNodes: [], totalPlayers: [] }
  if (histories.length === 0) return empty

  const allTimestamps = histories
    .flat()
    .map((l) => new Date(l.timestamp).getTime())
    .sort((a, b) => a - b)

  if (allTimestamps.length === 0) return empty

  const minTime = allTimestamps[0]
  const maxTime = allTimestamps[allTimestamps.length - 1]
  const range = maxTime - minTime || 1
  const step = range / sampleCount

  const onlineNodes: number[] = []
  const totalPlayers: number[] = []

  for (let i = 0; i < sampleCount; i++) {
    const windowStart = minTime + step * i
    const windowEnd = minTime + step * (i + 1)

    let online = 0
    let players = 0
    for (const serverLogs of histories) {
      // 按节点分组，取每个节点在时间窗口内最新的一条日志
      const latestByNode = new Map<string, StatusLog>()
      for (const log of serverLogs) {
        const t = new Date(log.timestamp).getTime()
        if (t >= windowStart && t < windowEnd) {
          const existing = latestByNode.get(log.node_id)
          if (!existing || t > new Date(existing.timestamp).getTime()) {
            latestByNode.set(log.node_id, log)
          }
        }
      }
      // 统计该服务器在窗口内在线的节点
      for (const log of latestByNode.values()) {
        if (log.online) {
          online++
          players += log.players_online ?? 0
        }
      }
    }
    onlineNodes.push(online)
    totalPlayers.push(players)
  }

  return { onlineNodes, totalPlayers }
}

export interface HourlyBucket {
  hour: number
  minutes: number
}

/** 会话时长按小时（0-23）分桶，跨小时的会话按边界切分；返回全部 24 个桶 */
export function aggregateHourly(
  sessions: Array<{ session_start: string; session_end: string | null }>
): HourlyBucket[] {
  const buckets = new Map<number, number>()
  for (const s of sessions) {
    const start = new Date(s.session_start).getTime()
    const end = s.session_end ? new Date(s.session_end).getTime() : Date.now()
    if (end <= start) continue
    let cursor = start
    while (cursor < end) {
      const hourStart = new Date(cursor)
      hourStart.setMinutes(0, 0, 0)
      const nextHour = hourStart.getTime() + 3600_000
      const chunkEnd = Math.min(nextHour, end)
      const minutes = (chunkEnd - cursor) / 1000 / 60
      const h = new Date(cursor).getHours()
      buckets.set(h, (buckets.get(h) || 0) + minutes)
      cursor = chunkEnd
    }
  }
  // Fill all 24 hours with 0 for missing buckets
  return Array.from({ length: 24 }, (_, hour) => ({
    hour,
    minutes: Math.round(buckets.get(hour) || 0),
  }))
}

export interface SessionStats {
  /** 已结束会话的平均时长（秒） */
  avg: number
  /** 已结束会话的最长时长（秒） */
  longest: number
  /** 会话次数最多的服务器 id */
  favorite: string
  favCount: number
}

/** 会话统计：平均/最长只计已结束的会话，favorite 按会话频次 */
export function computeSessionStats(sessions: PlayerSessionHistory[]): SessionStats {
  let total = 0
  let longest = 0
  const serverFreq = new Map<string, number>()

  for (const s of sessions) {
    const start = new Date(s.session_start).getTime()
    const end = s.session_end ? new Date(s.session_end).getTime() : Date.now()
    const dur = Math.max(0, (end - start) / 1000)
    if (s.session_end) {
      total += dur
      longest = Math.max(longest, dur)
    }
    serverFreq.set(s.server_id, (serverFreq.get(s.server_id) || 0) + 1)
  }

  const closed = sessions.filter((s) => s.session_end != null).length
  const avg = closed > 0 ? total / closed : 0

  let favorite = ""
  let favCount = 0
  for (const [sid, count] of serverFreq) {
    if (count > favCount) {
      favCount = count
      favorite = sid
    }
  }

  return { avg, longest, favorite, favCount }
}
