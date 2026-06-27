import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { useParams, useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { api } from "@/api/endpoints"
import type { StatusLog, NodeWithStats } from "@/api/types"
import { PageHeader } from "@/components/shared/PageHeader"
import { StatCard, StatGrid } from "@/components/shared/StatCard"
import { EmptyState } from "@/components/shared/EmptyState"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Network,
  Users,
  Gauge,
  Percent,
  UserCheck,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ReTooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"

function aggregateServerHistory(history: StatusLog[], totalNodes: number) {
  if (history.length === 0) return []

  // Group by timestamp, keeping latest log per node
  const byTime = new Map<string, Map<string, StatusLog>>()
  for (const log of history) {
    if (!byTime.has(log.timestamp)) {
      byTime.set(log.timestamp, new Map())
    }
    byTime.get(log.timestamp)!.set(log.node_id, log)
  }

  const sorted = Array.from(byTime.entries()).sort(
    (a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime()
  )

  return sorted.map(([timestamp, nodeMap]) => {
    let onlineNodes = 0
    let totalPlayers = 0
    for (const log of nodeMap.values()) {
      if (log.online) {
        onlineNodes++
        totalPlayers += log.players_online ?? 0
      }
    }
    return {
      time: new Date(timestamp).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      onlineNodes,
      totalPlayers,
      totalNodes,
    }
  })
}

function extractLatestOnlinePlayers(history: StatusLog[]): string[] {
  const set = new Set<string>()
  // Iterate from latest to oldest to gather sample players
  for (let i = history.length - 1; i >= 0; i--) {
    const log = history[i]
    if (!log.players_online) continue
    try {
      const players = JSON.parse(log.sample_players || "[]") as string[]
      players.forEach((p) => set.add(p))
    } catch {
      /* ignore */
    }
  }
  return Array.from(set).sort()
}

/** 图表使用的调色板 */
const LATENCY_CHART_COLORS = [
  "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6",
  "#EC4899", "#06B6D4", "#84CC16", "#F97316", "#6366F1",
  "#14B8A6", "#A855F7",
]

/** 将 StatusLog[] 转换为多节点延迟趋势图表数据 */
function buildLatencyChartData(
  history: StatusLog[],
  serverNodes: NodeWithStats[]
): {
  data: Record<string, number | string | null>[]
  nodes: { id: string; name: string; color: string }[]
} {
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

  // 按时间戳分组，每个时间戳下按 node_id 取最新一条
  const byTime = new Map<string, Map<string, StatusLog>>()
  for (const log of history) {
    if (!byTime.has(log.timestamp)) {
      byTime.set(log.timestamp, new Map())
    }
    byTime.get(log.timestamp)!.set(log.node_id, log)
  }

  const sorted = Array.from(byTime.entries()).sort(
    (a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime()
  )

  // 构建图表数据：每个时间点一个对象 { time, [nodeId]: latency | null }
  const data = sorted.map(([timestamp, nodeMap]) => {
    const point: Record<string, number | string | null> = {
      time: new Date(timestamp).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    }
    for (const nodeId of orderedIds) {
      const log = nodeMap.get(nodeId)
      // 离线或无延迟数据时设为 null（图表断线）
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

export default function ServerDetailPage() {
  const { serverId } = useParams<{ serverId: string }>()
  const { t } = useTranslation()
  const navigate = useNavigate()

  const { data: detail, isLoading } = useQuery({
    queryKey: ["server", serverId],
    queryFn: () => api.servers.detail(serverId!),
    enabled: !!serverId,
  })

  const { data: history = [] } = useQuery({
    queryKey: ["server-history", serverId],
    queryFn: () => api.servers.history(serverId!, 24),
    enabled: !!serverId,
  })

  const chartData = useMemo(
    () => aggregateServerHistory(history, detail?.nodes.length ?? 0),
    [history, detail?.nodes.length]
  )

  const onlinePlayers = useMemo(
    () => extractLatestOnlinePlayers(history),
    [history]
  )

  const latencyChart = useMemo(
    () => buildLatencyChartData(history, detail?.nodes ?? []),
    [history, detail?.nodes]
  )

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <StatGrid>
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </StatGrid>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  if (!detail) {
    return (
      <EmptyState
        title={t("dashboard.loadingFailed")}
        description={t("servers.noServers")}
      />
    )
  }

  const agg = detail.aggregate
  const onlineN = agg.online_node_count
  const totalN = agg.total_node_count
  const playerPercent =
    agg.total_players_max > 0
      ? Math.round((agg.total_players_online / agg.total_players_max) * 100)
      : 0

  // Average uptime across nodes
  const uptimeNodes = detail.nodes.filter((n) => n.latency_stats)
  const avgUptime =
    uptimeNodes.length > 0
      ? uptimeNodes.reduce(
          (sum, n) => sum + (n.latency_stats?.uptime_percentage ?? 0),
          0
        ) / uptimeNodes.length
      : null

  const glassCard = cn(
    "rounded-xl overflow-hidden",
    "bg-card/60 backdrop-blur-md border border-border/80",
    "dark:bg-card/60"
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title={detail.name}
        description={`${onlineN}/${totalN} ${t("server.onlineNodes")}`}
      />

      {/* Stats */}
      <StatGrid>
        <StatCard
          title={t("server.onlineNodes")}
          value={`${onlineN}/${totalN}`}
          icon={Network}
          variant={
            onlineN === totalN && totalN > 0 ? "success" : "warning"
          }
          subtitle={
            totalN > 0
              ? `${Math.round((onlineN / totalN) * 100)}%`
              : undefined
          }
        />
        <StatCard
          title={t("server.playerCapacity")}
          value={`${agg.total_players_online}/${agg.total_players_max}`}
          icon={Users}
          subtitle={agg.total_players_max > 0 ? `${playerPercent}%` : undefined}
        />
        <StatCard
          title={t("servers.avgLatency")}
          value={
            agg.avg_latency != null && agg.avg_latency > 0
              ? `${Math.round(agg.avg_latency)}ms`
              : "--"
          }
          icon={Gauge}
        />
        <StatCard
          title={t("server.avgUptime")}
          value={
            avgUptime != null ? `${avgUptime.toFixed(2)}%` : "--"
          }
          icon={Percent}
          variant={
            avgUptime != null && avgUptime >= 99
              ? "success"
              : avgUptime != null && avgUptime >= 95
                ? "warning"
                : "default"
          }
        />
      </StatGrid>

      {/* Charts */}
      {chartData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className={glassCard}>
            <div className="px-4 py-3 border-b border-border/60">
              <h3 className="text-sm font-medium">
                {t("server.playerTrend")}
              </h3>
            </div>
            <div className="p-4">
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={chartData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--muted)"
                    opacity={0.3}
                  />
                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 11 }}
                    stroke="var(--muted-foreground)"
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    stroke="var(--muted-foreground)"
                    allowDecimals={false}
                  />
                  <ReTooltip
                    contentStyle={{
                      backgroundColor: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="totalPlayers"
                    stroke="#3B82F6"
                    fill="#3B82F6"
                    fillOpacity={0.15}
                    connectNulls
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className={glassCard}>
            <div className="px-4 py-3 border-b border-border/60">
              <h3 className="text-sm font-medium">
                {t("server.nodeTrend")}
              </h3>
            </div>
            <div className="p-4">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--muted)"
                    opacity={0.3}
                  />
                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 11 }}
                    stroke="var(--muted-foreground)"
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    stroke="var(--muted-foreground)"
                    allowDecimals={false}
                    domain={[0, "auto"]}
                  />
                  <ReTooltip
                    contentStyle={{
                      backgroundColor: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="onlineNodes"
                    stroke="#10B981"
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Latency Trend — multi-node */}
      {latencyChart.data.length > 0 && latencyChart.nodes.length > 0 && (
        <div className={glassCard}>
          <div className="px-4 py-3 border-b border-border/60">
            <h3 className="text-sm font-medium">
              {t("server.latencyTrend")}
            </h3>
          </div>
          <div className="p-4">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={latencyChart.data}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--muted)"
                  opacity={0.3}
                />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 11 }}
                  stroke="var(--muted-foreground)"
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  stroke="var(--muted-foreground)"
                  unit="ms"
                  width={50}
                />
                <ReTooltip
                  contentStyle={{
                    backgroundColor: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  formatter={(value, name) => {
                    if (value == null) return ["—", name as string]
                    return [`${Math.round(Number(value))}ms`, name as string]
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                  iconType="line"
                />
                {latencyChart.nodes.map((node) => (
                  <Line
                    key={node.id}
                    type="monotone"
                    dataKey={node.id}
                    name={node.name}
                    stroke={node.color}
                    strokeWidth={2}
                    dot={false}
                    connectNulls={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Online Players */}
      {onlinePlayers.length > 0 && agg.total_players_online > 0 && (
        <div className={glassCard}>
          <div className="px-4 py-3 border-b border-border/60">
            <div className="flex items-center gap-1.5 text-sm font-medium">
              <UserCheck className="h-4 w-4 text-muted-foreground" />
              {t("server.currentPlayers")} ({onlinePlayers.length})
            </div>
          </div>
          <div className="p-4">
            <div className="flex flex-wrap gap-2">
              {onlinePlayers.map((name) => (
                <Badge
                  key={name}
                  variant="secondary"
                  className="cursor-pointer hover:bg-primary/10 hover:text-primary transition-colors"
                  onClick={() =>
                    navigate(`/players/${encodeURIComponent(name)}`)
                  }
                >
                  {name}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Node List */}
      <div className={glassCard}>
        <div className="px-5 py-4 border-b border-border/60">
          <h3 className="text-sm font-semibold">{t("server.nodeList")}</h3>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-b border-border/60 bg-muted/30">
              <TableHead className="py-3 text-xs font-medium text-muted-foreground">
                {t("nodes.name")}
              </TableHead>
              <TableHead className="py-3 text-xs font-medium text-muted-foreground">
                {t("nodes.status")}
              </TableHead>
              <TableHead className="py-3 text-right text-xs font-medium text-muted-foreground">
                {t("nodes.latency")}
              </TableHead>
              <TableHead className="py-3 text-right text-xs font-medium text-muted-foreground hidden md:table-cell">
                {t("node.uptime")}
              </TableHead>
              <TableHead className="py-3 text-right text-xs font-medium text-muted-foreground hidden sm:table-cell">
                {t("servers.players")}
              </TableHead>
              <TableHead className="py-3 text-right text-xs font-medium text-muted-foreground hidden sm:table-cell">
                {t("nodes.version")}
              </TableHead>
              <TableHead className="py-3 text-xs font-medium text-muted-foreground hidden lg:table-cell">
                {t("nodes.motd")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {detail.nodes.map((n) => {
              const status = n.latest_status
              const latency =
                status?.latency != null ? Math.round(status.latency) : null
              const isHighLatency = latency != null && latency > 500
              const stats = n.latency_stats

              const statusVariant = status?.online
                ? isHighLatency
                  ? "warning"
                  : "success"
                : "destructive"

              const uptimeColor =
                stats && stats.uptime_percentage >= 99
                  ? "text-emerald-600 dark:text-emerald-400"
                  : stats && stats.uptime_percentage >= 95
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-destructive"

              return (
                <TableRow
                  key={n.id}
                  className="cursor-pointer transition-colors duration-150 hover:bg-muted/40 border-b border-border/30 last:border-b-0"
                  onClick={() => navigate(`/nodes/${n.id}`)}
                >
                  <TableCell className="py-4">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0 ring-2 ring-background"
                        style={{ backgroundColor: n.color || "#6b7280" }}
                      />
                      <span className="font-medium text-sm">{n.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-4">
                    <Badge
                      variant={statusVariant}
                      className="text-[11px] px-2 py-0.5 font-medium"
                    >
                      {status?.online
                        ? t("common.online")
                        : t("common.offline")}
                    </Badge>
                  </TableCell>
                  <TableCell
                    className={cn(
                      "py-4 text-right font-mono text-sm tabular-nums",
                      isHighLatency && "text-destructive font-medium"
                    )}
                  >
                    {latency != null ? (
                      `${latency}ms`
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="py-4 text-right text-sm font-mono tabular-nums hidden md:table-cell">
                    {stats ? (
                      <span className={uptimeColor}>
                        {stats.uptime_percentage.toFixed(1)}%
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="py-4 text-right text-sm font-mono tabular-nums hidden sm:table-cell">
                    {status?.players_online != null &&
                    status?.players_max != null ? (
                      `${status.players_online}/${status.players_max}`
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="py-4 text-right text-xs text-muted-foreground hidden sm:table-cell truncate max-w-[100px]">
                    {status?.version || (
                      <span className="text-muted-foreground/70">-</span>
                    )}
                  </TableCell>
                  <TableCell className="py-4 text-xs text-muted-foreground hidden lg:table-cell truncate max-w-[180px]">
                    {status?.motd || (
                      <span className="text-muted-foreground/70">-</span>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
