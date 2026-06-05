import { useQuery } from "@tanstack/react-query"
import { useParams, useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { api } from "@/api/endpoints"
import { PageHeader } from "@/components/shared/PageHeader"
import { StatCard, StatGrid } from "@/components/shared/StatCard"
import { EmptyState } from "@/components/shared/EmptyState"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Network, Users, Gauge, Activity } from "lucide-react"
import { cn } from "@/lib/utils"

export default function ServerDetailPage() {
  const { serverId } = useParams<{ serverId: string }>()
  const { t } = useTranslation()
  const navigate = useNavigate()

  const { data: detail, isLoading } = useQuery({
    queryKey: ["server", serverId],
    queryFn: () => api.servers.detail(serverId!),
    enabled: !!serverId,
  })

  useQuery({
    queryKey: ["server-history", serverId],
    queryFn: () => api.servers.history(serverId!, 24),
    enabled: !!serverId,
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

  return (
    <div className="space-y-6">
      <PageHeader
        title={detail.name}
        description={`${onlineN}/${totalN} nodes`}
      />

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
          title={t("server.totalPlayers")}
          value={agg.total_players_online}
          icon={Users}
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
          title={t("server.onlineRate")}
          value={
            totalN > 0 ? `${Math.round((onlineN / totalN) * 100)}%` : "--"
          }
          icon={Activity}
        />
      </StatGrid>

      <div
        className={cn(
          "rounded-xl overflow-hidden",
          "bg-card/60 backdrop-blur-md border border-border/80",
          "dark:bg-zinc-900/60"
        )}
      >
        <div className="px-4 py-3 border-b border-border/60">
          <h3 className="text-sm font-medium">{t("server.nodeList")}</h3>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>{t("nodes.title")}</TableHead>
              <TableHead>{t("nodes.status")}</TableHead>
              <TableHead className="text-right">{t("nodes.latency")}</TableHead>
              <TableHead className="text-right">{t("servers.players")}</TableHead>
              <TableHead className="text-right hidden sm:table-cell">
                {t("nodes.version")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {detail.nodes.map((n) => {
              const status = n.latest_status
              const latency =
                status?.latency != null ? Math.round(status.latency) : null
              const isHighLatency = latency != null && latency > 500
              return (
                <TableRow
                  key={n.id}
                  className="cursor-pointer transition-colors duration-150 hover:bg-muted/30"
                  onClick={() => navigate(`/nodes/${n.id}`)}
                >
                  <TableCell className="font-medium text-sm">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: n.color || "#6b7280" }}
                      />
                      {n.name}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 text-xs",
                        status?.online
                          ? isHighLatency
                            ? "text-red-500"
                            : "text-emerald-500"
                          : "text-red-500"
                      )}
                    >
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          status?.online
                            ? isHighLatency
                              ? "bg-red-500 animate-pulse"
                              : "bg-emerald-500"
                            : "bg-red-500"
                        )}
                      />
                      {status?.online
                        ? t("common.online")
                        : t("common.offline")}
                    </span>
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right font-mono text-sm tabular-nums",
                      isHighLatency && "text-red-500 font-medium"
                    )}
                  >
                    {latency != null ? `${latency}ms` : "--"}
                  </TableCell>
                  <TableCell className="text-right text-sm font-mono tabular-nums">
                    {status?.players_online != null &&
                    status?.players_max != null
                      ? `${status.players_online}/${status.players_max}`
                      : "--"}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground hidden sm:table-cell truncate max-w-[100px]">
                    {status?.version || "--"}
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
