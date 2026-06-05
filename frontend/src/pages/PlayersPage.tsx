import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { api } from "@/api/endpoints"
import { PageHeader } from "@/components/shared/PageHeader"
import { StatCard, StatGrid } from "@/components/shared/StatCard"
import { PlayerCard } from "@/components/shared/PlayerCard"
import { EmptyState } from "@/components/shared/EmptyState"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Users, Search, Wifi, WifiOff } from "lucide-react"

export default function PlayersPage() {
  const { t } = useTranslation()
  const [search, setSearch] = useState("")

  const { data: players = [], isLoading } = useQuery({
    queryKey: ["players"],
    queryFn: () => api.players.list(),
  })

  const filtered = players.filter(
    (p) =>
      !search ||
      p.player_name.toLowerCase().includes(search.toLowerCase())
  )

  const onlineCount = players.filter((p) => p.online).length

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

      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t("players.search")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-card/60 backdrop-blur-sm border-border/60"
        />
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
