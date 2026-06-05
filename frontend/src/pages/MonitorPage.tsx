import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { api } from "@/api/endpoints"
import { PageHeader } from "@/components/shared/PageHeader"
import { EmptyState } from "@/components/shared/EmptyState"
import { Skeleton } from "@/components/ui/skeleton"
import { useServerGroup } from "@/providers/ServerGroupProvider"
import { useState } from "react"
import { Maximize, Minimize, Network } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { NodeWithStats } from "@/api/types"

export default function MonitorPage() {
  const { t } = useTranslation()
  const [fullscreen, setFullscreen] = useState(false)
  const { selectedGroupId } = useServerGroup()

  const { data: nodes = [], isLoading } = useQuery({
    queryKey: ["nodes", selectedGroupId],
    queryFn: () => api.nodes.list(selectedGroupId ?? undefined),
  })

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <Skeleton key={i} className="h-40 rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  if (nodes.length === 0) {
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

  const onlineCount = nodes.filter((n) => n.latest_status?.online).length

  return (
    <div
      className={
        fullscreen
          ? "fixed inset-0 z-50 bg-background p-6 overflow-auto"
          : "space-y-4"
      }
    >
      <div className="flex items-center justify-between">
        <PageHeader
          title={t("monitor.title")}
          description={`${onlineCount}/${nodes.length} ${t("common.online")}`}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => setFullscreen(!fullscreen)}
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

      <div
        className={
          fullscreen
            ? "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3"
            : "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
        }
      >
        {nodes.map((node) => (
          <NodeMonitorCard key={node.id} node={node} />
        ))}
      </div>
    </div>
  )
}

function NodeMonitorCard({ node }: { node: NodeWithStats }) {
  const { t } = useTranslation()
  const status = node.latest_status
  const online = status?.online ?? false
  const latency = status?.latency
  const playersOnline = status?.players_online
  const playersMax = status?.players_max

  const latencyColor = !latency
    ? "text-muted-foreground"
    : latency < 50
    ? "text-green-600 dark:text-green-400"
    : latency < 150
    ? "text-yellow-600 dark:text-yellow-400"
    : "text-red-600 dark:text-red-400"

  const percent =
    playersMax && playersMax > 0
      ? Math.round(((playersOnline || 0) / playersMax) * 100)
      : 0

  return (
    <div
      className={`rounded-lg border p-3 ${
        online
          ? "bg-card hover:shadow-md"
          : "bg-muted/30 opacity-60"
      }`}
      style={
        online
          ? { borderLeft: `3px solid ${node.color || "#3b82f6"}` }
          : undefined
      }
    >
      <div className="flex items-start justify-between mb-1.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <Network className="h-3 w-3 text-muted-foreground shrink-0" />
            <h3 className="font-medium text-xs truncate">{node.name}</h3>
          </div>
          <p className="text-[10px] text-muted-foreground truncate">
            {node.host}:{node.port}
          </p>
        </div>
        <span
          className={`shrink-0 h-2 w-2 rounded-full ${
            online ? "bg-green-500" : "bg-red-500"
          }`}
        />
      </div>

      {status?.motd && (
        <p className="text-[10px] text-muted-foreground truncate mb-1.5 italic">
          {status.motd}
        </p>
      )}

      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground tabular-nums">
          {playersOnline != null && playersMax != null
            ? `${playersOnline}/${playersMax}`
            : "--"}
        </span>
        <span className={`font-mono tabular-nums text-xs ${latencyColor}`}>
          {online && latency != null
            ? `${Math.round(latency)}${t("status.ms")}`
            : t("common.offline")}
        </span>
      </div>

      {online && playersMax != null && playersMax > 0 && (
        <div className="mt-1.5 h-1 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
      )}
    </div>
  )
}
