import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { api } from "@/api/endpoints"
import { PageHeader } from "@/components/shared/PageHeader"
import { StatCard, StatGrid } from "@/components/shared/StatCard"
import { NodeCard } from "@/components/shared/NodeCard"
import { EmptyState } from "@/components/shared/EmptyState"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { useServerGroup } from "@/providers/ServerGroupProvider"
import { Network, Search } from "lucide-react"

export default function NodesPage() {
  const { t } = useTranslation()
  const [search, setSearch] = useState("")
  const { selectedGroupId } = useServerGroup()

  const { data: nodes = [], isLoading } = useQuery({
    queryKey: ["nodes", selectedGroupId],
    queryFn: () => api.nodes.list(selectedGroupId ?? undefined),
  })

  const filtered = nodes.filter(
    (n) =>
      !search ||
      n.name.toLowerCase().includes(search.toLowerCase()) ||
      n.host.toLowerCase().includes(search.toLowerCase())
  )

  const onlineCount = nodes.filter((n) => n.latest_status?.online).length
  const avgLat =
    nodes.filter((n) => n.latest_status?.online && n.latest_status?.latency != null)
      .length > 0
      ? Math.round(
          nodes
            .filter(
              (n) => n.latest_status?.online && n.latest_status?.latency != null
            )
            .reduce((a, n) => a + n.latest_status!.latency!, 0) /
            nodes.filter(
              (n) => n.latest_status?.online && n.latest_status?.latency != null
            ).length
        )
      : 0
  const totalP = nodes.reduce(
    (a, n) => a + (n.latest_status?.players_online || 0),
    0
  )

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <StatGrid cols={3}>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </StatGrid>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <Skeleton key={i} className="h-32 rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("nodes.title")} description={t("nodes.description")} />

      <StatGrid cols={3}>
        <StatCard
          title={t("dashboard.onlineNodes")}
          value={`${onlineCount}/${nodes.length}`}
          icon={Network}
          variant={
            onlineCount === nodes.length && nodes.length > 0
              ? "success"
              : "warning"
          }
        />
        <StatCard
          title={t("servers.avgLatency")}
          value={avgLat > 0 ? `${avgLat}ms` : "--"}
        />
        <StatCard title={t("servers.playersOnline")} value={totalP} />
      </StatGrid>

      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t("players.search")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState title={t("nodes.noNodes")} />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((n) => (
            <NodeCard key={n.id} node={n} />
          ))}
        </div>
      )}
    </div>
  )
}
