import { useState, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { api } from "@/api/endpoints"
import { useDebounce } from "@/hooks/useDebounce"
import { useGroupFilter } from "@/hooks/useGroupFilter"
import { PageHeader } from "@/components/shared/PageHeader"
import { StatCard, StatGrid } from "@/components/shared/StatCard"
import { NodeCard } from "@/components/shared/NodeCard"
import { EmptyState } from "@/components/shared/EmptyState"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Network, Search, Filter } from "lucide-react"
import { cn } from "@/lib/utils"

type FilterStatus = "all" | "online" | "offline"

export default function NodesPage() {
  const { t } = useTranslation()
  const groupFilter = useGroupFilter()
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<FilterStatus>("all")
  const debouncedSearch = useDebounce(search, 200)

  const { data: nodes = [], isLoading, error } = useQuery({
    queryKey: ["nodes", groupFilter],
    queryFn: () => api.nodes.list(groupFilter ?? undefined),
  })

  const filtered = nodes.filter((n) => {
    const matchesSearch =
      !debouncedSearch ||
      n.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      n.host.toLowerCase().includes(debouncedSearch.toLowerCase())
    const matchesFilter =
      filter === "all" ||
      (filter === "online" && n.latest_status?.online) ||
      (filter === "offline" && !n.latest_status?.online)
    return matchesSearch && matchesFilter
  })

  const filters: { key: FilterStatus; label: string }[] = [
    { key: "all", label: t("monitor.filter.all") },
    { key: "online", label: t("common.online") },
    { key: "offline", label: t("common.offline") },
  ]

  const onlineCount = nodes.filter((n) => n.latest_status?.online).length

  const { avgLat, totalP } = useMemo(() => {
    const onlineWithLatency = nodes.filter(
      (n) => n.latest_status?.online && n.latest_status?.latency != null
    )
    const avgLat =
      onlineWithLatency.length > 0
        ? Math.round(
            onlineWithLatency.reduce((a, n) => a + n.latest_status!.latency!, 0) /
              onlineWithLatency.length
          )
        : 0
    const totalP = nodes.reduce(
      (a, n) => a + (n.latest_status?.players_online || 0),
      0
    )
    return { avgLat, totalP }
  }, [nodes])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <StatGrid cols={3}>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </StatGrid>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title={t("nodes.title")} />
        <EmptyState
          title={t("dashboard.loadingFailed")}
          description={error instanceof Error ? error.message : String(error)}
        />
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

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="flex items-center gap-1.5">
          <Filter className="h-4 w-4 text-muted-foreground" />
          {filters.map((f) => (
            <Button
              key={f.key}
              variant="ghost"
              size="sm"
              onClick={() => setFilter(f.key)}
              className={cn(
                "text-xs h-8 px-3 rounded-full transition-all",
                filter === f.key
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {f.label}
            </Button>
          ))}
        </div>
        <div className="relative flex-1 sm:max-w-xs sm:ml-auto">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
          <Input
            placeholder={t("nodes.search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-card/60 backdrop-blur-sm border-border/60"
          />
        </div>
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
