import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { api } from "@/api/endpoints"
import { aggregateHistory } from "@/lib/history"
import { PageHeader } from "@/components/shared/PageHeader"
import { StatCard, StatGrid } from "@/components/shared/StatCard"
import { ServerCard } from "@/components/shared/ServerCard"
import { EmptyState } from "@/components/shared/EmptyState"
import { Skeleton } from "@/components/ui/skeleton"
import { LayoutDashboard, Server, Network, Users } from "lucide-react"

/** 限制并发数为 5，避免请求风暴 */
async function promiseAllLimit<T>(
  tasks: (() => Promise<T>)[],
  limit: number
): Promise<T[]> {
  const results: T[] = []
  const executing: Promise<void>[] = []
  for (const task of tasks) {
    const p = task().then((r) => { results.push(r) })
    executing.push(p)
    if (executing.length >= limit) {
      await Promise.race(executing)
      executing.splice(
        executing.findIndex((x) => x === p),
        1
      )
    }
  }
  await Promise.all(executing)
  return results
}

export default function DashboardPage() {
  const { t } = useTranslation()

  const { data: tree, isLoading: loading, error } = useQuery({
    queryKey: ["tree"],
    queryFn: () => api.tree.get(),
  })
  const groups = tree?.groups ?? []
  const ungrouped = tree?.ungrouped_servers ?? []
  const servers = [...groups.flatMap((g) => g.servers), ...ungrouped]

  const serverIds = servers.map((s) => s.id)

  const { data: trend } = useQuery({
    queryKey: ["trend", serverIds.join(",")],
    queryFn: async () => {
      const tasks = serverIds.map((id) => () => api.servers.history(id, 24))
      const results = await promiseAllLimit(tasks, 5)
      return aggregateHistory(results)
    },
    enabled: serverIds.length > 0,
  })

  const totalNodes = groups.reduce((sum, g) => sum + g.total_node_count, 0)
  const totalOnlineNodes = groups.reduce(
    (sum, g) => sum + g.online_node_count,
    0
  )
  const totalPlayers = groups.reduce((sum, g) => sum + g.total_players_online, 0)

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

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title={t("dashboard.title")} />
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
        title={t("dashboard.title")}
        description={t("dashboard.description")}
      />

      <StatGrid>
        <StatCard
          title={t("dashboard.groups")}
          value={groups.length}
          icon={LayoutDashboard}
        />
        <StatCard
          title={t("dashboard.servers")}
          value={servers.length}
          icon={Server}
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
              ? `${Math.round((totalOnlineNodes / totalNodes) * 100)}% ${t("dashboard.onlineRate")}`
              : undefined
          }
          sparklineData={trend?.onlineNodes}
        />
        <StatCard
          title={t("dashboard.onlinePlayers")}
          value={totalPlayers}
          icon={Users}
          sparklineData={trend?.totalPlayers}
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
          const groupServers = group.servers
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

        {/* 未分组服务器 */}
        {ungrouped.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">{t("admin.ungrouped")}</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {ungrouped.map((s) => (
                <ServerCard key={s.id} server={s} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
