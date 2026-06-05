import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Sparkline } from "@/components/shared/Sparkline"
import { Server } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ServerItem } from "@/api/types"

const HIGH_LATENCY_THRESHOLD = 500

function generateMockTrend(current: number, points: number = 12): number[] {
  const data: number[] = []
  let v = current * 0.7
  for (let i = 0; i < points - 1; i++) {
    v += (Math.random() - 0.45) * current * 0.15
    v = Math.max(0, v)
    data.push(Math.round(v))
  }
  data.push(current)
  return data
}

function generateMockLatencyTrend(
  current: number,
  points: number = 12
): number[] {
  const data: number[] = []
  let v = current * 0.3
  for (let i = 0; i < points - 2; i++) {
    v += (Math.random() - 0.4) * 30
    v = Math.max(10, Math.min(200, v))
    data.push(Math.round(v))
  }
  data.push(Math.round(current * 0.6))
  data.push(current)
  return data
}

export function ServerCard({ server }: { server: ServerItem }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const agg = server.aggregate
  const allOnline =
    agg.online_node_count === agg.total_node_count &&
    agg.total_node_count > 0
  const avgLatency = agg.avg_latency ?? 0
  const isHighLatency = avgLatency > HIGH_LATENCY_THRESHOLD

  const playerTrend = generateMockTrend(agg.total_players_online)
  const latencyTrend = generateMockLatencyTrend(avgLatency)

  const playerPercent =
    agg.total_players_max > 0
      ? Math.round((agg.total_players_online / agg.total_players_max) * 100)
      : 0

  return (
    <Card
      className={cn(
        "cursor-pointer bg-card/60 backdrop-blur-md border border-border/80 shadow-sm",
        "dark:bg-zinc-900/60",
        "transition-all duration-300 ease-out",
        "hover:shadow-md",
        allOnline &&
          !isHighLatency &&
          "hover:shadow-[0_0_15px_rgba(16,185,129,0.1)]",
        allOnline && !isHighLatency && "border-l-4 border-l-emerald-500",
        isHighLatency &&
          "border-l-4 border-l-red-500 animate-glow-red",
        !allOnline && !isHighLatency && "border-l-4 border-l-amber-400"
      )}
      onClick={() => navigate(`/servers/${server.id}`)}
    >
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Server className="h-4 w-4 text-muted-foreground shrink-0" />
            <h3 className="font-medium text-sm truncate">{server.name}</h3>
          </div>
          {allOnline ? (
            <Badge
              variant="outline"
              className={cn(
                "shrink-0 text-[10px] px-2 py-0.5",
                "bg-emerald-500/10 text-emerald-500 border-emerald-500/30",
                "animate-pulse"
              )}
            >
              {t("common.online")}
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className={cn(
                "shrink-0 text-[10px] px-2 py-0.5",
                "bg-amber-500/10 text-amber-500 border-amber-500/30"
              )}
            >
              {t("common.partial")}
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-0.5">
            <div className="text-2xl font-bold font-mono tracking-tight tabular-nums">
              {agg.online_node_count}
              <span className="text-xs font-normal text-muted-foreground">
                /{agg.total_node_count}
              </span>
            </div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground/80">
              {t("servers.nodes")}
            </div>
          </div>
          <div className="space-y-0.5">
            <div className="text-2xl font-bold font-mono tracking-tight tabular-nums">
              {agg.total_players_online}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground/80">
              {t("servers.players")}
            </div>
          </div>
          <div className="space-y-0.5">
            <div
              className={cn(
                "text-2xl font-bold font-mono tracking-tight tabular-nums",
                isHighLatency && "text-red-500 animate-breathe"
              )}
            >
              {avgLatency > 0 ? `${Math.round(avgLatency)}` : "--"}
              {avgLatency > 0 && (
                <span className="text-xs font-normal text-muted-foreground">
                  ms
                </span>
              )}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground/80">
              {t("nodes.latency")}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Sparkline
            data={playerTrend}
            width={80}
            height={20}
            color="hsl(160 84% 39%)"
          />
          <Sparkline
            data={latencyTrend}
            width={80}
            height={20}
            color="hsl(160 84% 39%)"
            alertColor="hsl(0 84% 60%)"
            alertThreshold={HIGH_LATENCY_THRESHOLD}
          />
        </div>

        {agg.total_players_max > 0 && (
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-muted-foreground/80">
              <span>
                {agg.total_players_online}/{agg.total_players_max}
              </span>
              <span>{playerPercent}%</span>
            </div>
            <Progress value={playerPercent} className="h-1" />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
