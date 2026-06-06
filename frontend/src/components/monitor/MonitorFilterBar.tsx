import { useTranslation } from "react-i18next"
import { Search, Filter, ArrowUpDown } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { FilterStatus, SortMode } from "@/hooks/useMonitorData"

interface MonitorFilterBarProps {
  filterStatus: FilterStatus
  setFilterStatus: (v: FilterStatus) => void
  sortMode: SortMode
  setSortMode: (v: SortMode) => void
  searchQuery: string
  setSearchQuery: (v: string) => void
}

export function MonitorFilterBar({
  filterStatus,
  setFilterStatus,
  sortMode,
  setSortMode,
  searchQuery,
  setSearchQuery,
}: MonitorFilterBarProps) {
  const { t } = useTranslation()

  const filters: { key: FilterStatus; label: string }[] = [
    { key: "all", label: t("monitor.filter.all") },
    { key: "online", label: t("monitor.filter.online") },
    { key: "offline", label: t("monitor.filter.offline") },
    { key: "issues", label: t("monitor.filter.alert") },
  ]

  const sorts: { key: SortMode; label: string }[] = [
    { key: "default", label: t("monitor.sort.default") },
    { key: "latency", label: t("monitor.sort.latency") },
    { key: "players", label: t("monitor.sort.players") },
    { key: "uptime", label: t("monitor.sort.uptime") },
  ]

  return (
    <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between">
      <div className="flex items-center gap-1 flex-wrap">
        <Filter className="h-3.5 w-3.5 text-muted-foreground mr-1 shrink-0" />
        {filters.map((f) => (
          <Button
            key={f.key}
            variant={filterStatus === f.key ? "secondary" : "ghost"}
            size="sm"
            className={cn(
              "h-7 text-xs px-2.5",
              filterStatus === f.key &&
                f.key === "issues" &&
                "bg-red-500/10 text-red-500 hover:bg-red-500/15 hover:text-red-500",
              filterStatus === f.key &&
                f.key !== "issues" &&
                "bg-primary/10 text-primary hover:bg-primary/15"
            )}
            onClick={() => setFilterStatus(f.key)}
          >
            {f.label}
          </Button>
        ))}
      </div>
      <div className="flex items-center gap-2 w-full sm:w-auto">
        <div className="relative flex-1 sm:flex-none">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground z-10" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("monitor.searchPlaceholder")}
            className="h-7 pl-7 text-xs w-full sm:w-48"
          />
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
          {sorts.map((s) => (
            <Button
              key={s.key}
              variant={sortMode === s.key ? "secondary" : "ghost"}
              size="sm"
              className={cn(
                "h-7 text-xs px-2.5",
                sortMode === s.key && "bg-primary/10 text-primary hover:bg-primary/15"
              )}
              onClick={() => setSortMode(s.key)}
            >
              {s.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}
