import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { api } from "@/api/endpoints"
import { PageHeader } from "@/components/shared/PageHeader"
import { StatCard, StatGrid } from "@/components/shared/StatCard"
import { ServerCard } from "@/components/shared/ServerCard"
import { EmptyState } from "@/components/shared/EmptyState"
import { Skeleton } from "@/components/ui/skeleton"
import { LayoutDashboard, Server, Network, Users } from "lucide-react"

function generateMockData(base: number, points: number = 12): number[] {
  const data: number[] = []
  let v = base * 0.6
  for (let i = 0; i < points - 1; i++) {
    v += (Math.random() - 0.42) * base * 0.12
    v = Math.max(0, v)
    data.push(Math.round(v))
  }
  data.push(base)
  return data
}

export default function DashboardPage() {
  const { t } = useTranslation()

  const { data: groups = [], isLoading: groupsLoading } = useQuery({
    queryKey: ["groups"],
    queryFn: api.groups.list,
  })

  const { data: servers = [], isLoading: serversLoading } = useQuery({
    queryKey: ["servers"],
    queryFn: () => api.servers.list(),
  })

  const loading = groupsLoading || serversLoading

  const totalNodes = groups.reduce((sum, g) => sum + g.total_node_count, 0)
  const totalOnlineNodes = groups.reduce(
    (sum, g) => sum + g.online_node_count,
    0
  )
  const totalPlayers = groups.reduce((sum, g) => sum + g.total_players_online, 0)

  const serversByGroup = new Map<string | null, typeof servers>()
  for (const s of servers) {
    const key = s.group_id
    if (!serversByGroup.has(key)) serversByGroup.set(key, [])
    serversByGroup.get(key)!.push(s)
  }

  if (loading) {
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

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("dashboard.title")}
        description={t("dashboard.description")}
      />

      <StatGrid>
        <StatCard
          title={t("dashboard.groups")}
          value={groups.length}
          icon={LayoutDashboard}
          sparklineData={generateMockData(groups.length)}
        />
        <StatCard
          title={t("dashboard.servers")}
          value={servers.length}
          icon={Server}
          sparklineData={generateMockData(servers.length)}
        />
        <StatCard
          title={t("dashboard.onlineNodes")}
          value={`${totalOnlineNodes}/${totalNodes}`}
          icon={Network}
          variant={
            totalOnlineNodes === totalNodes && totalNodes > 0
              ? "success"
              : "warning"
          }
          subtitle={
            totalNodes > 0
              ? `${Math.round((totalOnlineNodes / totalNodes) * 100)}% ${t("dashboard.uptime")}`
              : undefined
          }
          sparklineData={generateMockData(totalOnlineNodes)}
        />
        <StatCard
          title={t("dashboard.onlinePlayers")}
          value={totalPlayers}
          icon={Users}
          sparklineData={generateMockData(totalPlayers)}
        />
      </StatGrid>

      {groups.length === 0 && (
        <EmptyState
          title={t("dashboard.noServers")}
          description={t("dashboard.noServersHint")}
        />
      )}

      <div className="space-y-4">
        {groups.map((group) => {
          const groupServers = serversByGroup.get(group.id) || []
          return (
            <div key={group.id} className="space-y-3">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">{group.name}</h2>
                <span className="text-xs text-muted-foreground">
                  {group.online_node_count}/{group.total_node_count}{" "}
                  {t("common.online")}
                </span>
              </div>
              {groupServers.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  {t("dashboard.noServersInGroup")}
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {groupServers.map((s) => (
                    <ServerCard key={s.id} server={s} />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
