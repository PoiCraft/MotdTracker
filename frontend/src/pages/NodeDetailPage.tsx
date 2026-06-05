import { useQuery } from "@tanstack/react-query"
import { useParams } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { api } from "@/api/endpoints"
import { PageHeader } from "@/components/shared/PageHeader"
import { StatCard, StatGrid } from "@/components/shared/StatCard"
import { EmptyState } from "@/components/shared/EmptyState"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Gauge, Users, Clock, Activity } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
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
  const isHighLatency = latency != null && latency > 500

  const chartData = history.map((h) => ({
    time: new Date(h.timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
    latency: h.latency,
    players: h.players_online,
  }))

  const glassCard = cn(
    "rounded-xl p-4",
    "bg-card/60 backdrop-blur-md border border-border/80",
    "dark:bg-zinc-900/60"
  )

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
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Line
                type="monotone"
                dataKey="latency"
                stroke={isHighLatency ? "hsl(0 84% 60%)" : "hsl(160 84% 39%)"}
                strokeWidth={2}
                dot={false}
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
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Area
                type="monotone"
                dataKey="players"
                stroke="hsl(200 84% 50%)"
                fill="hsl(200 84% 50%)"
                fillOpacity={0.15}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {detail.latency_stats && (
        <div className="grid grid-cols-3 gap-4">
          {[
            {
              label: t("node.avgLatency"),
              value: detail.latency_stats.avg_latency,
              color: "",
            },
            {
              label: t("node.minLatency"),
              value: detail.latency_stats.min_latency,
              color: "text-emerald-500",
            },
            {
              label: t("node.maxLatency"),
              value: detail.latency_stats.max_latency,
              color: "text-red-500",
            },
          ].map((item) => (
            <div
              key={item.label}
              className={cn(
                "rounded-xl p-4 text-center",
                "bg-card/60 backdrop-blur-md border border-border/80",
                "dark:bg-zinc-900/60"
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
    </div>
  )
}
