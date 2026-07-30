import { useState, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { useQuery } from "@tanstack/react-query"
import { api } from "@/api/endpoints"
import type { NodeWithStats } from "@/api/types"
import { HIGH_LATENCY_THRESHOLD, HIGH_LOAD_THRESHOLD } from "@/lib/thresholds"

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
  groupId: string | null
  groupName: string
  sortOrder: number
  servers: GroupedNodes[]
}

export function useMonitorData() {
  const { t } = useTranslation()
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all")
  const [sortMode, setSortMode] = useState<SortMode>("default")
  const [searchQuery, setSearchQuery] = useState("")

  const {
    data: tree,
    isLoading: nodesLoading,
    error: nodesError,
  } = useQuery({
    queryKey: ["tree"],
    queryFn: () => api.tree.get(),
    staleTime: 5000,
    refetchInterval: 30000,
  })

  const groups = useMemo(() => tree?.groups ?? [], [tree])
  const servers = useMemo(
    () => [
      ...groups.flatMap((g) => g.servers),
      ...(tree?.ungrouped_servers ?? []),
    ],
    [groups, tree]
  )
  const nodes = useMemo(
    () => [
      ...servers.flatMap((s) => s.nodes),
      ...(tree?.orphan_nodes ?? []),
    ],
    [servers, tree]
  )

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
            return la - lb
          }
          case "players": {
            const pa = a.latest_status?.players_online ?? 0
            const pb = b.latest_status?.players_online ?? 0
            return pb - pa
          }
          case "uptime": {
            const ua = a.latency_stats?.uptime_percentage ?? 0
            const ub = b.latency_stats?.uptime_percentage ?? 0
            return ub - ua
          }
          default:
            return 0
        }
      })
    } else {
      result.sort((a, b) => {
        const aOnline = a.latest_status?.online ?? false
        const bOnline = b.latest_status?.online ?? false
        if (aOnline !== bOnline) return aOnline ? -1 : 1
        const aHigh = (a.latest_status?.latency ?? 0) > HIGH_LATENCY_THRESHOLD
        const bHigh = (b.latest_status?.latency ?? 0) > HIGH_LATENCY_THRESHOLD
        if (aHigh !== bHigh) return aHigh ? -1 : 1
        return a.name.localeCompare(b.name)
      })
    }

    return result
  }, [nodes, filterStatus, sortMode, searchQuery])

  const grouped: GroupedNodes[] = useMemo(() => {
    const visible = new Set(filteredAndSorted.map((n) => n.id))
    const out: GroupedNodes[] = []
    for (const s of servers) {
      const list = s.nodes.filter((n) => visible.has(n.id))
      if (list.length > 0) {
        out.push({ serverId: s.id, serverName: s.name, nodes: list })
      }
    }
    // 孤儿节点（server_id 悬空）按 server_id 各自成组，保持可见
    const orphanByServer = new Map<string, NodeWithStats[]>()
    for (const n of tree?.orphan_nodes ?? []) {
      if (!visible.has(n.id)) continue
      const list = orphanByServer.get(n.server_id) ?? []
      list.push(n)
      orphanByServer.set(n.server_id, list)
    }
    for (const [serverId, list] of orphanByServer) {
      out.push({ serverId, serverName: serverId, nodes: list })
    }
    return out
  }, [filteredAndSorted, servers, tree])

  const groupedByGroup: MonitorGroup[] = useMemo(() => {
    const byServerId = new Map(grouped.map((g) => [g.serverId, g]))
    const result: MonitorGroup[] = []
    for (const g of groups) {
      const serverList = g.servers
        .map((s) => byServerId.get(s.id))
        .filter((x): x is GroupedNodes => x !== undefined)
      if (serverList.length > 0) {
        result.push({
          groupId: g.id,
          groupName: g.name,
          sortOrder: g.sort_order,
          servers: serverList,
        })
      }
    }
    const ungroupedList = (tree?.ungrouped_servers ?? [])
      .map((s) => byServerId.get(s.id))
      .filter((x): x is GroupedNodes => x !== undefined)
    if (ungroupedList.length > 0) {
      result.push({
        groupId: null,
        groupName: t("admin.ungrouped"),
        sortOrder: 9999,
        servers: ungroupedList,
      })
    }

    result.sort((a, b) => a.sortOrder - b.sortOrder)
    return result
  }, [grouped, groups, tree, t])

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
