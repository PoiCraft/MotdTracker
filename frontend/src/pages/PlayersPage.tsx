import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { api } from "@/api/endpoints"
import { useDebounce } from "@/hooks/useDebounce"
import { PageHeader } from "@/components/shared/PageHeader"
import { StatCard, StatGrid } from "@/components/shared/StatCard"
import { PlayerCard } from "@/components/shared/PlayerCard"
import { EmptyState } from "@/components/shared/EmptyState"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Users, Search, Wifi, WifiOff, Filter } from "lucide-react"
import { cn } from "@/lib/utils"

type FilterStatus = "all" | "online" | "offline"

export default function PlayersPage() {
  const { t } = useTranslation()
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<FilterStatus>("all")
  const debouncedSearch = useDebounce(search, 200)

  const { data: players = [], isLoading, error } = useQuery({
    queryKey: ["players"],
    queryFn: () => api.players.list(),
  })

  const filtered = players.filter((p) => {
    const matchesSearch =
      !debouncedSearch ||
      p.player_name.toLowerCase().includes(debouncedSearch.toLowerCase())
    const matchesFilter =
      filter === "all" ||
      (filter === "online" && p.online) ||
      (filter === "offline" && !p.online)
    return matchesSearch && matchesFilter
  })

  const onlineCount = players.filter((p) => p.online).length

  const filters: { key: FilterStatus; label: string }[] = [
    { key: "all", label: t("monitor.filter.all") },
    { key: "online", label: t("common.online") },
    { key: "offline", label: t("common.offline") },
  ]

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
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title={t("players.title")} />
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
        title={t("players.title")}
        description={t("players.description")}
      />

      <StatGrid cols={3}>
        <StatCard
          title={t("players.totalPlayers")}
          value={players.length}
          icon={Users}
        />
        <StatCard
          title={t("players.currentlyOnline")}
          value={onlineCount}
          icon={Wifi}
          variant="success"
        />
        <StatCard
          title={t("common.offline")}
          value={players.length - onlineCount}
          icon={WifiOff}
          variant="danger"
        />
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
            placeholder={t("players.search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-card/60 backdrop-blur-sm border-border/60"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title={t("players.noPlayers")} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((p) => (
            <PlayerCard key={p.player_name} player={p} />
          ))}
        </div>
      )}
    </div>
  )
}
