import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { api } from "@/api/endpoints"
import { useGroupFilter } from "@/hooks/useGroupFilter"
import { PageHeader } from "@/components/shared/PageHeader"
import { StatCard, StatGrid } from "@/components/shared/StatCard"
import { ServerCard } from "@/components/shared/ServerCard"
import { EmptyState } from "@/components/shared/EmptyState"
import { Skeleton } from "@/components/ui/skeleton"
import { Server, Network, Users, Gauge } from "lucide-react"

export default function ServersPage() {
  const { t } = useTranslation()
  const groupFilter = useGroupFilter()

  const { data: groups = [], error: groupsError } = useQuery({
    queryKey: ["groups"],
    queryFn: api.groups.list,
  })

  const { data: servers = [], isLoading, error: serversError } = useQuery({
    queryKey: ["servers", groupFilter],
    queryFn: () => api.servers.list(groupFilter),
  })

  const onlineN = servers.reduce((s, rv) => s + rv.aggregate.online_node_count, 0)
  const totalN = servers.reduce((s, rv) => s + rv.aggregate.total_node_count, 0)
  const totalP = servers.reduce(
    (s, rv) => s + rv.aggregate.total_players_online,
    0
  )
  const validLat = servers.filter(
    (sv) => sv.aggregate.avg_latency != null && sv.aggregate.avg_latency > 0
  )
  const avgL = validLat.length
    ? Math.round(
        validLat.reduce((a, b) => a + b.aggregate.avg_latency!, 0) /
          validLat.length
      )
    : 0

  const byGroup = new Map<string | null, typeof servers>()
  for (const s of servers) {
    const k = s.group_id
    if (!byGroup.has(k)) byGroup.set(k, [])
    byGroup.get(k)!.push(s)
  }

  const error = groupsError || serversError

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

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title={t("servers.title")} />
        <EmptyState
          title={t("dashboard.loadingFailed")}
          description={error instanceof Error ? error.message : String(error)}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("servers.title")}
        description={t("servers.description")}
      />

      <StatGrid>
        <StatCard title={t("servers.title")} value={servers.length} icon={Server} />
        <StatCard
          title={t("dashboard.onlineNodes")}
          value={`${onlineN}/${totalN}`}
          icon={Network}
          variant={onlineN === totalN && totalN > 0 ? "success" : "warning"}
        />
        <StatCard
          title={t("servers.playersOnline")}
          value={totalP}
          icon={Users}
        />
        <StatCard
          title={t("servers.avgLatency")}
          value={avgL > 0 ? `${avgL}ms` : "--"}
          icon={Gauge}
        />
      </StatGrid>

      {servers.length === 0 && (
        <EmptyState
          title={t("servers.noServers")}
          description={t("servers.noServersHint")}
        />
      )}

      <div className="space-y-4">
        {groups.map((g) => {
          const gs = byGroup.get(g.id) || []
          if (gs.length === 0) return null
          return (
            <div key={g.id} className="space-y-3">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">{g.name}</h2>
                <span className="text-xs text-muted-foreground font-mono tabular-nums">
                  {gs.reduce((a, b) => a + b.aggregate.online_node_count, 0)}/
                  {gs.reduce((a, b) => a + b.aggregate.total_node_count, 0)}{" "}
                  {t("common.online")}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {gs.map((s) => (
                  <ServerCard key={s.id} server={s} />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
