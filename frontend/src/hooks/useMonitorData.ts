import { useState, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { api } from "@/api/endpoints"
import type { NodeWithStats, ServerItem, GroupItem } from "@/api/types"

export type FilterStatus = "all" | "online" | "offline" | "issues"
export type SortMode = "default" | "latency" | "players" | "uptime"

export interface MonitorStats {
  totalNodes: number
  onlineNodes: number
  offlineNodes: number
  totalPlayers: number
  totalCapacity: number
  avgLatency: number | null
  highLatencyCount: number
  issueCount: number
  onlineRate: number
}

export interface GroupedNodes {
  serverId: string
  serverName: string
  nodes: NodeWithStats[]
}

export interface MonitorGroup {
  groupId: string
  groupName: string
  sortOrder: number
  servers: GroupedNodes[]
}

const HIGH_LATENCY_THRESHOLD = 500
const HIGH_LOAD_THRESHOLD = 0.85

export function useMonitorData() {
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all")
  const [sortMode, setSortMode] = useState<SortMode>("default")
  const [searchQuery, setSearchQuery] = useState("")

  const {
    data: nodes = [],
    isLoading: nodesLoading,
    error: nodesError,
  } = useQuery({
    queryKey: ["nodes"],
    queryFn: () => api.nodes.list(),
    staleTime: 5000,
    refetchInterval: 30000,
  })

  const { data: servers = [] } = useQuery({
    queryKey: ["servers"],
    queryFn: () => api.servers.list(),
    staleTime: 60000,
  })

  const { data: groups = [] } = useQuery({
    queryKey: ["groups"],
    queryFn: () => api.groups.list(),
    staleTime: 60000,
  })

  const stats: MonitorStats = useMemo(() => {
    let online = 0
    let offline = 0
    let totalPlayers = 0
    let totalCapacity = 0
    let totalLatency = 0
    let latencyCount = 0
    let highLatency = 0
    let issue = 0

    for (const node of nodes) {
      const status = node.latest_status
      const onlineStatus = status?.online ?? false
      const latency = status?.latency
      const playersMax = status?.players_max ?? 0
      const playersOnline = status?.players_online ?? 0

      if (onlineStatus) {
        online++
        if (latency != null) {
          totalLatency += latency
          latencyCount++
          if (latency > HIGH_LATENCY_THRESHOLD) {
            highLatency++
            issue++
          }
        }
        const load = playersMax > 0 ? playersOnline / playersMax : 0
        if (load >= HIGH_LOAD_THRESHOLD) {
          issue++
        }
      } else {
        offline++
        issue++
      }

      if (playersOnline != null) totalPlayers += playersOnline
      if (playersMax != null) totalCapacity += playersMax
    }

    return {
      totalNodes: nodes.length,
      onlineNodes: online,
      offlineNodes: offline,
      totalPlayers,
      totalCapacity,
      avgLatency: latencyCount > 0 ? Math.round(totalLatency / latencyCount) : null,
      highLatencyCount: highLatency,
      issueCount: issue,
      onlineRate: nodes.length > 0 ? Math.round((online / nodes.length) * 100) : 0,
    }
  }, [nodes])

  const filteredAndSorted = useMemo(() => {
    let result = [...nodes]

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (n) =>
          n.name.toLowerCase().includes(q) ||
          n.host.toLowerCase().includes(q) ||
          (n.latest_status?.motd ?? "").toLowerCase().includes(q)
      )
    }

    if (filterStatus !== "all") {
      result = result.filter((n) => {
        const status = n.latest_status
        const online = status?.online ?? false
        const latency = status?.latency ?? 0
        const playersMax = status?.players_max ?? 0
        const playersOnline = status?.players_online ?? 0
        const load = playersMax > 0 ? playersOnline / playersMax : 0

        switch (filterStatus) {
          case "online":
            return online
          case "offline":
            return !online
          case "issues":
            return (
              !online ||
              (online && latency > HIGH_LATENCY_THRESHOLD) ||
              (online && load >= HIGH_LOAD_THRESHOLD)
            )
          default:
            return true
        }
      })
    }

    if (sortMode !== "default") {
      result.sort((a, b) => {
        switch (sortMode) {
          case "latency": {
            const la = a.latest_status?.latency ?? Infinity
            const lb = b.latest_status?.latency ?? Infinity
            return lb - la
          }
          case "players": {
            const pa = a.latest_status?.players_online ?? 0
            const pb = b.latest_status?.players_online ?? 0
            return pb - pa
          }
          case "uptime": {
            const ua = a.latency_stats?.uptime_percentage ?? 0
            const ub = b.latency_stats?.uptime_percentage ?? 0
            return ua - ub
          }
          default:
            return 0
        }
      })
    } else {
      result.sort((a, b) => {
        const aOnline = a.latest_status?.online ?? false
        const bOnline = b.latest_status?.online ?? false
        if (aOnline !== bOnline) return aOnline ? 1 : -1
        const aHigh = (a.latest_status?.latency ?? 0) > HIGH_LATENCY_THRESHOLD
        const bHigh = (b.latest_status?.latency ?? 0) > HIGH_LATENCY_THRESHOLD
        if (aHigh !== bHigh) return aHigh ? -1 : 1
        return a.name.localeCompare(b.name)
      })
    }

    return result
  }, [nodes, filterStatus, sortMode, searchQuery])

  const grouped: GroupedNodes[] = useMemo(() => {
    const serverMap = new Map<string, ServerItem>()
    for (const s of servers) {
      serverMap.set(s.id, s)
    }

    const map = new Map<string, NodeWithStats[]>()
    for (const node of filteredAndSorted) {
      const list = map.get(node.server_id) || []
      list.push(node)
      map.set(node.server_id, list)
    }

    const groups: GroupedNodes[] = []
    for (const [serverId, nodeList] of map) {
      const server = serverMap.get(serverId)
      groups.push({
        serverId,
        serverName: server?.name || serverId,
        nodes: nodeList,
      })
    }

    groups.sort((a, b) => {
      const sa = serverMap.get(a.serverId)
      const sb = serverMap.get(b.serverId)
      return (sa?.sort_order ?? 0) - (sb?.sort_order ?? 0)
    })

    return groups
  }, [filteredAndSorted, servers])

  const groupedByGroup: MonitorGroup[] = useMemo(() => {
    const serverMap = new Map<string, ServerItem>()
    for (const s of servers) {
      serverMap.set(s.id, s)
    }

    const groupMap = new Map<string, GroupItem>()
    for (const g of groups) {
      groupMap.set(g.id, g)
    }

    // Map group_id -> list of server groupings
    const byGroup = new Map<string, GroupedNodes[]>()
    for (const sg of grouped) {
      const server = serverMap.get(sg.serverId)
      const gid = server?.group_id || "__ungrouped"
      const list = byGroup.get(gid) || []
      list.push(sg)
      byGroup.set(gid, list)
    }

    const result: MonitorGroup[] = []
    for (const [groupId, serverList] of byGroup) {
      const group = groupMap.get(groupId)
      result.push({
        groupId,
        groupName: group?.name || (groupId === "__ungrouped" ? "未分组" : groupId),
        sortOrder: group?.sort_order ?? 9999,
        servers: serverList,
      })
    }

    result.sort((a, b) => a.sortOrder - b.sortOrder)
    return result
  }, [grouped, servers, groups])

  return {
    nodes,
    servers,
    groups,
    stats,
    grouped,
    groupedByGroup,
    isLoading: nodesLoading,
    error: nodesError,
    filterStatus,
    setFilterStatus,
    sortMode,
    setSortMode,
    searchQuery,
    setSearchQuery,
  }
}
