import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { api } from "@/api/endpoints"
import { PageHeader } from "@/components/shared/PageHeader"
import { EmptyState } from "@/components/shared/EmptyState"
import { Skeleton } from "@/components/ui/skeleton"
import { Progress } from "@/components/ui/progress"
import { Sparkline } from "@/components/shared/Sparkline"
import { useState } from "react"
import { Maximize, Minimize, Network } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { NodeWithStats } from "@/api/types"

const HIGH_LATENCY_THRESHOLD = 500

function generateMockLatencyHistory(current: number): number[] {
  const data: number[] = []
  let v = Math.max(10, current * 0.3)
  for (let i = 0; i < 11; i++) {
    v += (Math.random() - 0.4) * 40
    v = Math.max(10, Math.min(200, v))
    data.push(Math.round(v))
  }
  data.push(current)
  return data
}

function generateMockPlayerHistory(current: number): number[] {
  const data: number[] = []
  let v = Math.max(0, current * 0.6)
  for (let i = 0; i < 11; i++) {
    v += (Math.random() - 0.42) * current * 0.12
    v = Math.max(0, v)
    data.push(Math.round(v))
  }
  data.push(current)
  return data
}

export default function MonitorPage() {
  const { t } = useTranslation()
  const [fullscreen, setFullscreen] = useState(false)

  const { data: nodes = [], isLoading } = useQuery({
    queryKey: ["nodes"],
    queryFn: () => api.nodes.list(),
  })

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <Skeleton key={i} className="h-44 rounded-xl" />
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
          ? "fixed inset-0 z-50 bg-background/95 backdrop-blur-sm p-6 overflow-auto"
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

  const roundedLatency = latency != null ? Math.round(latency) : null
  const isHighLatency =
    roundedLatency != null && roundedLatency > HIGH_LATENCY_THRESHOLD

  const percent =
    playersMax && playersMax > 0
      ? Math.round(((playersOnline || 0) / playersMax) * 100)
      : 0

  const latencyHistory = roundedLatency != null
    ? generateMockLatencyHistory(roundedLatency)
    : []
  const playerHistory = playersOnline != null
    ? generateMockPlayerHistory(playersOnline)
    : []

  return (
    <div
      className={cn(
        "rounded-xl p-3 transition-all duration-300 ease-out",
        "bg-card/60 backdrop-blur-md border border-border/80",
        "dark:bg-card/60",
        online && !isHighLatency && "hover:shadow-md hover:shadow-[0_0_15px_rgba(16,185,129,0.1)]",
        online && isHighLatency && "border-l-4 border-l-red-500 animate-glow-red",
        !online && "opacity-50 bg-muted/20",
        online && !isHighLatency && "border-l-4"
      )}
      style={
        online && !isHighLatency
          ? { borderLeftColor: node.color || "#10b981" }
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
          className={cn(
            "shrink-0 h-2 w-2 rounded-full",
            online ? "bg-emerald-500 animate-pulse-dot" : "bg-red-500"
          )}
        />
      </div>

      {status?.motd && (
        <p className="text-[10px] text-muted-foreground truncate mb-1.5 italic">
          {status.motd}
        </p>
      )}

      <div className="flex items-center justify-between text-xs mb-1.5">
        <span className="text-muted-foreground tabular-nums font-mono">
          {playersOnline != null && playersMax != null
            ? `${playersOnline}/${playersMax}`
            : "--"}
        </span>
        <span
          className={cn(
            "font-mono tabular-nums text-xs font-medium",
            !roundedLatency && "text-muted-foreground",
            roundedLatency && !isHighLatency && "text-emerald-500",
            isHighLatency && "text-red-500 animate-breathe"
          )}
        >
          {online && roundedLatency != null
            ? `${roundedLatency}${t("status.ms")}`
            : t("common.offline")}
        </span>
      </div>

      <div className="flex items-center gap-2 mb-1.5">
        <Sparkline
          data={latencyHistory}
          width={56}
          height={16}
          color="hsl(160 84% 39%)"
          alertColor="hsl(0 84% 60%)"
          alertThreshold={HIGH_LATENCY_THRESHOLD}
        />
        <Sparkline
          data={playerHistory}
          width={56}
          height={16}
          color="hsl(200 84% 50%)"
        />
      </div>

      {online && playersMax != null && playersMax > 0 && (
        <Progress value={percent} className="h-1" />
      )}
    </div>
  )
}
