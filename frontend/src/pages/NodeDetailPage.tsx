import { useQuery } from "@tanstack/react-query"
import { useParams } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { api } from "@/api/endpoints"
import { PageHeader } from "@/components/shared/PageHeader"
import { StatCard, StatGrid } from "@/components/shared/StatCard"
import { EmptyState } from "@/components/shared/EmptyState"
import { Skeleton } from "@/components/ui/skeleton"
import { Gauge, Users, Clock, Activity } from "lucide-react"
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
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </StatGrid>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-64 rounded-lg" />
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

  const chartData = history.map((h) => ({
    time: new Date(h.timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
    latency: h.latency,
    players: h.players_online,
  }))

  return (
    <div className="space-y-6">
      <PageHeader
        title={detail.name}
        description={`${detail.host}:${detail.port}`}>
        <span
          className={`inline-flex items-center gap-1.5 text-sm px-3 py-1 rounded-full ${
            status?.online
              ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
              : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full ${
              status?.online ? "bg-green-500" : "bg-red-500"
            }`}
          />
          {status?.online ? t("common.online") : t("common.offline")}
        </span>
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
          value={
            status?.latency != null ? `${Math.round(status.latency)}ms` : "--"
          }
          icon={Gauge}
          variant={
            status?.latency != null && status.latency < 50
              ? "success"
              : status?.latency != null && status.latency < 150
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
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">{t("nodes.motd")}</p>
          <p className="text-sm font-medium mt-1">{status.motd}</p>
        </div>
      )}

      {status?.version && (
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">{t("nodes.version")}</p>
          <p className="text-sm font-medium mt-1">{status.version}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-lg border bg-card p-4">
          <h3 className="text-sm font-medium mb-4">{t("node.latencyTrend")}</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="time" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="latency"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <h3 className="text-sm font-medium mb-4">{t("node.playerTrend")}</h3>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="time" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Area
                type="monotone"
                dataKey="players"
                stroke="#22c55e"
                fill="#22c55e"
                fillOpacity={0.2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {detail.latency_stats && (
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-lg border bg-card p-4 text-center">
            <div className="text-[0.6875rem] uppercase text-muted-foreground mb-1">
              {t("node.avgLatency")}
            </div>
            <div className="text-lg font-semibold tabular-nums">
              {detail.latency_stats.avg_latency != null
                ? `${Math.round(detail.latency_stats.avg_latency)}ms`
                : "--"}
            </div>
          </div>
          <div className="rounded-lg border bg-card p-4 text-center">
            <div className="text-[0.6875rem] uppercase text-muted-foreground mb-1">
              {t("node.minLatency")}
            </div>
            <div className="text-lg font-semibold tabular-nums text-green-600">
              {detail.latency_stats.min_latency != null
                ? `${Math.round(detail.latency_stats.min_latency)}ms`
                : "--"}
            </div>
          </div>
          <div className="rounded-lg border bg-card p-4 text-center">
            <div className="text-[0.6875rem] uppercase text-muted-foreground mb-1">
              {t("node.maxLatency")}
            </div>
            <div className="text-lg font-semibold tabular-nums text-red-600">
              {detail.latency_stats.max_latency != null
                ? `${Math.round(detail.latency_stats.max_latency)}ms`
                : "--"}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
