import { useState, useEffect, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { Maximize, Minimize, RotateCw, Server, Folder } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/shared/PageHeader"
import { EmptyState } from "@/components/shared/EmptyState"
import { useMonitorData } from "@/hooks/useMonitorData"
import { MonitorStatsBar } from "@/components/monitor/MonitorStatsBar"
import { MonitorFilterBar } from "@/components/monitor/MonitorFilterBar"
import { MonitorNodeCard } from "@/components/monitor/MonitorNodeCard"
import { cn } from "@/lib/utils"

function useFullscreen() {
  const [active, setActive] = useState(false)

  useEffect(() => {
    const onChange = () => setActive(Boolean(document.fullscreenElement))
    document.addEventListener("fullscreenchange", onChange)
    return () => document.removeEventListener("fullscreenchange", onChange)
  }, [])

  const toggle = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen()
      } else {
        await document.exitFullscreen()
      }
    } catch {
      // silently ignore unsupported/blocked requests
    }
  }, [])

  return { active, toggle }
}

export default function MonitorPage() {
  const { t } = useTranslation()
  const { active: fullscreen, toggle: toggleFullscreen } = useFullscreen()
  const {
    stats,
    groupedByGroup,
    isLoading,
    error,
    filterStatus,
    setFilterStatus,
    sortMode,
    setSortMode,
    searchQuery,
    setSearchQuery,
  } = useMonitorData()

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-8 w-full max-w-md rounded-lg" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title={t("monitor.title")} />
        <EmptyState
          title={t("dashboard.loadingFailed")}
          description={error instanceof Error ? error.message : String(error)}
        />
      </div>
    )
  }

  if (groupedByGroup.length === 0 && !searchQuery && filterStatus === "all") {
    return (
      <div className="space-y-6">
        <PageHeader title={t("monitor.title")} />
        <EmptyState
          title={t("monitor.noNodes")}
          description={t("monitor.noNodesHint")}
        />
      </div>
    )
  }

  const totalCards = groupedByGroup.reduce(
    (sum, g) => sum + g.servers.reduce((s, srv) => s + srv.nodes.length, 0),
    0
  )

  return (
    <div
      className={cn(
        "space-y-4",
        fullscreen &&
          "fixed inset-0 z-50 bg-background/95 backdrop-blur-sm p-6 overflow-auto"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <PageHeader
          title={t("monitor.title")}
          description={t("monitor.description")}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={toggleFullscreen}
          className="transition-all duration-300"
        >
          {fullscreen ? (
            <>
              <Minimize className="h-4 w-4 mr-1" /> {t("monitor.exitFullscreen")}
            </>
          ) : (
            <>
              <Maximize className="h-4 w-4 mr-1" /> {t("monitor.fullscreen")}
            </>
          )}
        </Button>
      </div>

      {/* Stats Bar */}
      <MonitorStatsBar stats={stats} />

      {/* Filter Bar */}
      <MonitorFilterBar
        filterStatus={filterStatus}
        setFilterStatus={setFilterStatus}
        sortMode={sortMode}
        setSortMode={setSortMode}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
      />

      {/* Results count */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{t("monitor.showingResults", { count: totalCards })}</span>
        {stats.issueCount > 0 && (
          <span className="text-red-500 flex items-center gap-1 font-medium">
            <RotateCw className="h-3 w-3 animate-spin" />
            {t("monitor.alertsActive", { count: stats.issueCount })}
          </span>
        )}
      </div>

      {/* Node Grid grouped by group -> server */}
      {groupedByGroup.length === 0 ? (
        <EmptyState
          title={t("monitor.noNodes")}
          description={t("monitor.noNodesHint")}
        />
      ) : (
        <div className="space-y-8">
          {groupedByGroup.map((group) => (
            <div key={group.groupId ?? "ungrouped"}>
              <div className="flex items-center gap-2 mb-4">
                <Folder className="h-4 w-4 text-amber-500" />
                <h2 className="text-sm font-semibold">{group.groupName}</h2>
                <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                  {group.servers.reduce(
                    (sum, s) => sum + s.nodes.filter((n) => n.latest_status?.online).length,
                    0
                  )}
                  /
                  {group.servers.reduce((sum, s) => sum + s.nodes.length, 0)}
                </span>
              </div>
              <div className="space-y-5">
                {group.servers.map((server) => (
                  <div key={server.serverId}>
                    <div className="flex items-center gap-2 mb-2 ml-1">
                      <Server className="h-3.5 w-3.5 text-muted-foreground" />
                      <h3 className="text-xs font-medium text-muted-foreground">
                        {server.serverName}
                      </h3>
                      <span className="text-[10px] text-muted-foreground/70 bg-muted/60 px-1.5 py-0.5 rounded-full">
                        {server.nodes.filter((n) => n.latest_status?.online).length}/
                        {server.nodes.length}
                      </span>
                    </div>
                    <div
                      className={cn(
                        "grid gap-3",
                        fullscreen
                          ? "grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6"
                          : "grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
                      )}
                    >
                      {server.nodes.map((node) => (
                        <MonitorNodeCard key={node.id} node={node} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
