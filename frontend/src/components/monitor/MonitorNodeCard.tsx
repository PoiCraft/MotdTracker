import { memo } from "react"
import { useTranslation } from "react-i18next"
import { Network, Clock, Users, AlertTriangle, Zap } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import type { NodeWithStats } from "@/api/types"

const HIGH_LATENCY_THRESHOLD = 500
const HIGH_LOAD_THRESHOLD = 0.85

function formatRelativeTime(timestamp: string | undefined, t: (key: string) => string): string {
  if (!timestamp) return "--"
  const diff = Date.now() - new Date(timestamp).getTime()
  const seconds = Math.floor(diff / 1000)
  if (seconds < 10) return t("status.justNow")
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

export const MonitorNodeCard = memo(function MonitorNodeCard({
  node,
}: {
  node: NodeWithStats
}) {
  const { t } = useTranslation()
  const status = node.latest_status
  const online = status?.online ?? false
  const latency = status?.latency != null ? Math.round(status.latency) : null
  const isHighLatency = latency != null && latency > HIGH_LATENCY_THRESHOLD
  const playersOnline = status?.players_online ?? 0
  const playersMax = status?.players_max ?? 0
  const load = playersMax > 0 ? playersOnline / playersMax : 0
  const isHighLoad = online && load >= HIGH_LOAD_THRESHOLD
  const isAlert = !online || isHighLatency || isHighLoad
  const uptime = node.latency_stats?.uptime_percentage
  const p95 =
    node.latency_stats?.p95_latency != null
      ? Math.round(node.latency_stats.p95_latency)
      : null

  const percent = playersMax > 0 ? Math.round((playersOnline / playersMax) * 100) : 0

  return (
    <TooltipProvider delayDuration={300}>
      <div
        className={cn(
          "rounded-xl p-3 transition-all duration-300 ease-out relative overflow-hidden",
          "bg-card/60 backdrop-blur-md border border-border/80",
          "dark:bg-card/60",
          !online && "opacity-60 bg-muted/20",
          online &&
            !isAlert &&
            "hover:shadow-md hover:shadow-[0_0_15px_rgba(16,185,129,0.08)]",
          isAlert && "animate-glow-red border-red-500/30"
        )}
        style={
          online && !isAlert
            ? {
                borderLeftWidth: "4px",
                borderLeftColor: node.color || "#10b981",
              }
            : {
                borderLeftWidth: "4px",
                borderLeftColor: isAlert
                  ? "hsl(0 84% 60%)"
                  : "hsl(0 0% 70%)",
              }
        }
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <Network className="h-3 w-3 text-muted-foreground shrink-0" />
              <h3 className="font-semibold text-xs truncate">{node.name}</h3>
              {status?.version && (
                <span className="text-[9px] px-1 py-0 rounded bg-muted text-muted-foreground font-mono shrink-0">
                  {status.version}
                </span>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground truncate font-mono">
              {node.host}:{node.port}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {isAlert && (
              <AlertTriangle className="h-3 w-3 text-red-500 animate-breathe" />
            )}
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                online
                  ? "bg-emerald-500 animate-pulse-dot"
                  : "bg-red-500"
              )}
            />
          </div>
        </div>

        {/* MOTD */}
        {status?.motd && (
          <p className="text-[10px] text-muted-foreground truncate mb-2 italic opacity-80">
            {status.motd}
          </p>
        )}

        {/* Core Metrics */}
        <div className="grid grid-cols-2 gap-2 mb-2">
          {/* Players */}
          <div>
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-0.5">
              <Users className="h-3 w-3" />
              <span>{t("node.playerCount")}</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-base font-bold tabular-nums">
                {playersOnline}
              </span>
              <span className="text-[10px] text-muted-foreground tabular-nums">
                /{playersMax || "--"}
              </span>
            </div>
            {online && playersMax > 0 && (
              <Progress
                value={percent}
                className={cn("h-1 mt-1", isHighLoad && "[&>div]:bg-red-500")}
              />
            )}
          </div>

          {/* Latency */}
          <div className="text-right">
            <div className="flex items-center justify-end gap-1 text-[10px] text-muted-foreground mb-0.5">
              <span>{t("nodes.latency")}</span>
              <Zap className="h-3 w-3" />
            </div>
            <span
              className={cn(
                "text-base font-bold tabular-nums",
                !online && "text-muted-foreground",
                online && !isHighLatency && "text-emerald-500",
                isHighLatency && "text-red-500 animate-breathe"
              )}
            >
              {online && latency != null
                ? `${latency}ms`
                : t("common.offline")}
            </span>
            {p95 != null && online && (
              <p className="text-[9px] text-muted-foreground tabular-nums">
                P95 {p95}ms
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-1.5 border-t border-border/50">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground cursor-help">
                <Clock className="h-3 w-3" />
                <span>{formatRelativeTime(status?.timestamp, t)}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {status?.timestamp
                ? new Date(status.timestamp).toLocaleString()
                : "--"}
            </TooltipContent>
          </Tooltip>

          {uptime != null && (
            <div className="flex items-center gap-1">
              <span
                className={cn(
                  "text-[10px] font-medium tabular-nums",
                  uptime >= 99
                    ? "text-emerald-500"
                    : uptime >= 95
                      ? "text-yellow-500"
                      : "text-red-500"
                )}
              >
                {uptime.toFixed(1)}%
              </span>
              <span className="text-[9px] text-muted-foreground">
                {t("dashboard.uptime")}
              </span>
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  )
})
