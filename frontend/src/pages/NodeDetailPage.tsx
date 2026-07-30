import { useQuery } from "@tanstack/react-query"
import { useParams } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { api } from "@/api/endpoints"
import { PageHeader } from "@/components/shared/PageHeader"
import { StatCard, StatGrid } from "@/components/shared/StatCard"
import { EmptyState } from "@/components/shared/EmptyState"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Gauge,
  Users,
  Clock,
  Activity,
  Shield,
  Gamepad2,
  Server,
  Map,
  Puzzle,
  UserCheck,
  Percent,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { parseSamplePlayers } from "@/lib/history"
import { HIGH_LATENCY_THRESHOLD } from "@/lib/thresholds"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ReTooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts"

export default function NodeDetailPage() {
  const { nodeId } = useParams<{ nodeId: string }>()
  const { t } = useTranslation()

  const { data: detail, isLoading } = useQuery({
    queryKey: ["node", nodeId],
    queryFn: () => api.nodes.detail(nodeId!),
    enabled: !!nodeId,
  })

  const { data: history = [] } = useQuery({
    queryKey: ["node-history", nodeId],
    queryFn: () => api.nodes.history(nodeId!, 24),
    enabled: !!nodeId,
  })

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
      </div>
    )
  }

  if (!detail) {
    return (
      <EmptyState
        title={t("dashboard.loadingFailed")}
        description={t("nodes.noNodes")}
      />
    )
  }

  const status = detail.latest_status
  const latency =
    status?.latency != null ? Math.round(status.latency) : null
  const isHighLatency = latency != null && latency > HIGH_LATENCY_THRESHOLD

  const chartData = history.map((h) => ({
    time: new Date(h.timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
    latency: h.latency,
    players: h.players_online,
    online: h.online,
  }))

  // Parse sample_players JSON string from the latest history entry
  const latestHistory = history[0]
  const samplePlayers = parseSamplePlayers(latestHistory?.sample_players)

  const glassCard = cn(
    "rounded-xl p-4",
    "bg-card/60 backdrop-blur-md border border-border/80",
    "dark:bg-card/60"
  )

  const stats = detail.latency_stats

  return (
    <div className="space-y-6">
      <PageHeader
        title={detail.name}
        description={`${detail.host}:${detail.port}`}
      >
        {status?.online ? (
          <Badge
            variant="outline"
            className={cn(
              "text-sm px-3 py-1",
              isHighLatency
                ? "bg-red-500/10 text-red-500 border-red-500/30 animate-pulse"
                : "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
            )}
          >
            <span
              className={cn(
                "h-2 w-2 rounded-full mr-1.5",
                isHighLatency ? "bg-red-500" : "bg-emerald-500"
              )}
            />
            {t("common.online")}
          </Badge>
        ) : (
          <Badge
            variant="outline"
            className="text-sm px-3 py-1 bg-red-500/10 text-red-500 border-red-500/30"
          >
            <span className="h-2 w-2 rounded-full mr-1.5 bg-red-500" />
            {t("common.offline")}
          </Badge>
        )}
      </PageHeader>

      {/* Basic Info */}
      <div className={cn(glassCard, "flex flex-wrap gap-4 items-center")}>
        {detail.edition && (
          <div className="flex items-center gap-1.5 text-sm">
            <Gamepad2 className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">{t("node.edition")}:</span>
            <span className="font-medium">{detail.edition}</span>
          </div>
        )}
        <div className="flex items-center gap-1.5 text-sm">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">{t("node.enabled")}:</span>
          <Badge
            variant="outline"
            className={cn(
              "text-xs",
              detail.enabled
                ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
                : "bg-muted text-muted-foreground"
            )}
          >
            {detail.enabled ? t("node.enabled") : t("node.disabled")}
          </Badge>
        </div>
        {detail.color && (
          <div className="flex items-center gap-1.5 text-sm">
            <span
              className="h-3 w-3 rounded-full border border-border"
              style={{ backgroundColor: detail.color }}
            />
            <span className="text-muted-foreground text-xs">{detail.color}</span>
          </div>
        )}
        {detail.created_at && (
          <div className="flex items-center gap-1.5 text-sm">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground text-xs">
              {new Date(detail.created_at).toLocaleDateString()}
            </span>
          </div>
        )}
      </div>

      {/* Core Stats */}
      <StatGrid>
        <StatCard
          title={t("node.status")}
          value={status?.online ? t("common.online") : t("common.offline")}
          icon={Activity}
          variant={status?.online ? "success" : "danger"}
        />
        <StatCard
          title={t("nodes.latency")}
          value={latency != null ? `${latency}ms` : "--"}
          icon={Gauge}
          variant={
            latency != null && latency < 50
              ? "success"
              : latency != null && latency < 150
                ? "warning"
                : "danger"
          }
        />
        <StatCard
          title={t("node.playerCount")}
          value={
            status?.players_online != null && status?.players_max != null
              ? `${status.players_online}/${status.players_max}`
              : "--"
          }
          icon={Users}
        />
        <StatCard
          title={t("node.lastChecked")}
          value={
            status?.timestamp
              ? new Date(status.timestamp).toLocaleString()
              : "--"
          }
          icon={Clock}
        />
      </StatGrid>

      {/* Uptime & Advanced Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Uptime */}
          <div className={cn(glassCard, "text-center")}>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground/80 mb-1 flex items-center justify-center gap-1">
              <Percent className="h-3 w-3" />
              {t("node.uptime")}
            </div>
            <div
              className={cn(
                "text-2xl font-bold font-mono tracking-tight tabular-nums",
                stats.uptime_percentage >= 99
                  ? "text-emerald-500"
                  : stats.uptime_percentage >= 95
                    ? "text-yellow-500"
                    : "text-red-500"
              )}
            >
              {stats.uptime_percentage.toFixed(2)}%
            </div>
            <Progress
              value={stats.uptime_percentage}
              className={cn(
                "h-1 mt-2",
                stats.uptime_percentage < 95 && "[&>div]:bg-red-500",
                stats.uptime_percentage >= 95 &&
                  stats.uptime_percentage < 99 &&
                  "[&>div]:bg-yellow-500",
                stats.uptime_percentage >= 99 && "[&>div]:bg-emerald-500"
              )}
            />
          </div>

          {/* P95 */}
          <div className={cn(glassCard, "text-center")}>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground/80 mb-1">
              {t("node.p95Latency")}
            </div>
            <div className="text-2xl font-bold font-mono tracking-tight tabular-nums">
              {stats.p95_latency != null
                ? `${Math.round(stats.p95_latency)}ms`
                : "--"}
            </div>
          </div>

          {/* Std Dev */}
          <div className={cn(glassCard, "text-center")}>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground/80 mb-1">
              {t("node.stdDev")}
            </div>
            <div className="text-2xl font-bold font-mono tracking-tight tabular-nums">
              {stats.std_dev != null
                ? `${Math.round(stats.std_dev)}ms`
                : "--"}
            </div>
          </div>

          {/* CV */}
          <div className={cn(glassCard, "text-center")}>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground/80 mb-1">
              {t("node.cv")}
            </div>
            <div className="text-2xl font-bold font-mono tracking-tight tabular-nums">
              {stats.cv != null ? `${stats.cv.toFixed(1)}%` : "--"}
            </div>
          </div>
        </div>
      )}

      {/* Latency min/max/avg */}
      {stats && (
        <div className="grid grid-cols-3 gap-4">
          {[
            {
              label: t("node.avgLatency"),
              value: stats.avg_latency,
              color: "",
            },
            {
              label: t("node.minLatency"),
              value: stats.min_latency,
              color: "text-emerald-500",
            },
            {
              label: t("node.maxLatency"),
              value: stats.max_latency,
              color: "text-red-500",
            },
          ].map((item) => (
            <div
              key={item.label}
              className={cn(
                "rounded-xl p-4 text-center",
                "bg-card/60 backdrop-blur-md border border-border/80",
                "dark:bg-card/60"
              )}
            >
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground/80 mb-1">
                {item.label}
              </div>
              <div
                className={cn(
                  "text-lg font-bold font-mono tracking-tight tabular-nums",
                  item.color
                )}
              >
                {item.value != null ? `${Math.round(item.value)}ms` : "--"}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Check counts */}
      {stats && (
        <div className={cn(glassCard, "flex flex-wrap gap-6 text-sm")}>
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">{t("node.totalChecks")}:</span>
            <span className="font-mono font-semibold">{stats.total_checks}</span>
          </div>
          <div className="flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">{t("node.onlineChecks")}:</span>
            <span className="font-mono font-semibold">{stats.online_checks}</span>
          </div>
        </div>
      )}

      {/* MOTD & Version */}
      {(status?.motd || status?.version) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {status?.motd && (
            <div className={glassCard}>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground/80 mb-1">
                {t("nodes.motd")}
              </p>
              <p className="text-sm font-medium">{status.motd}</p>
            </div>
          )}
          {status?.version && (
            <div className={glassCard}>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground/80 mb-1">
                {t("nodes.version")}
              </p>
              <p className="text-sm font-medium">{status.version}</p>
            </div>
          )}
        </div>
      )}

      {/* Server details from latest history */}
      {latestHistory && (latestHistory.software || latestHistory.map || latestHistory.plugins) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {latestHistory.software && (
            <div className={glassCard}>
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground/80 mb-1">
                <Server className="h-3 w-3" />
                {t("node.software")}
              </div>
              <p className="text-sm font-medium">{latestHistory.software}</p>
            </div>
          )}
          {latestHistory.map && (
            <div className={glassCard}>
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground/80 mb-1">
                <Map className="h-3 w-3" />
                {t("node.map")}
              </div>
              <p className="text-sm font-medium">{latestHistory.map}</p>
            </div>
          )}
          {latestHistory.plugins && (
            <div className={glassCard}>
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground/80 mb-1">
                <Puzzle className="h-3 w-3" />
                {t("node.plugins")}
              </div>
              <p className="text-sm font-medium">{latestHistory.plugins}</p>
            </div>
          )}
        </div>
      )}

      {/* Sample Players */}
      {samplePlayers.length > 0 && (
        <div className={glassCard}>
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground/80 mb-2">
            <UserCheck className="h-3 w-3" />
            {t("node.samplePlayers")} ({samplePlayers.length})
          </div>
          <div className="flex flex-wrap gap-2">
            {samplePlayers.map((name) => (
              <Badge key={name} variant="secondary" className="text-xs">
                {name}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className={glassCard}>
          <h3 className="text-sm font-medium mb-4">
            {t("node.latencyTrend")}
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted/40" />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 11 }}
                className="text-muted-foreground"
              />
              <YAxis
                tick={{ fontSize: 11 }}
                className="text-muted-foreground"
              />
              <ReTooltip
                contentStyle={{
                  backgroundColor: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                formatter={(value, _name, props) => {
                  const online = props?.payload?.online
                  const onlineLabel = online === false ? " (Offline)" : ""
                  return [`${value != null ? `${Math.round(Number(value))}ms` : "--"}${onlineLabel}`, "Latency"]
                }}
              />
              <Line
                type="monotone"
                dataKey="latency"
                stroke={isHighLatency ? "hsl(0 84% 60%)" : "hsl(160 84% 39%)"}
                strokeWidth={2}
                dot={false}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className={glassCard}>
          <h3 className="text-sm font-medium mb-4">
            {t("node.playerTrend")}
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted/40" />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 11 }}
                className="text-muted-foreground"
              />
              <YAxis
                tick={{ fontSize: 11 }}
                className="text-muted-foreground"
              />
              <ReTooltip
                contentStyle={{
                  backgroundColor: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                formatter={(value, _name, props) => {
                  const online = props?.payload?.online
                  const onlineLabel = online === false ? " (Offline)" : ""
                  return [`${value ?? "--"}${onlineLabel}`, "Players"]
                }}
              />
              <Area
                type="monotone"
                dataKey="players"
                stroke="hsl(200 84% 50%)"
                fill="hsl(200 84% 50%)"
                fillOpacity={0.15}
                connectNulls
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
