import { useNavigate } from "react-router-dom"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Network } from "lucide-react"
import { cn } from "@/lib/utils"
import type { NodeWithStats } from "@/api/types"

const HIGH_LATENCY_THRESHOLD = 500

export function NodeCard({ node }: { node: NodeWithStats }) {
  const navigate = useNavigate()
  const status = node.latest_status
  const online = status?.online ?? false
  const latency = status?.latency != null ? Math.round(status.latency) : null
  const isHighLatency = latency != null && latency > HIGH_LATENCY_THRESHOLD

  return (
    <Card
      className={cn(
        "cursor-pointer overflow-hidden",
        "bg-card/60 backdrop-blur-md border border-border/80 shadow-sm",
        "dark:bg-zinc-900/60",
        "transition-all duration-300 ease-out",
        "hover:shadow-md",
        online && !isHighLatency && "hover:shadow-[0_0_15px_rgba(16,185,129,0.1)]",
        online && isHighLatency && "animate-glow-red",
        !online && "opacity-50"
      )}
      style={{
        borderLeftWidth: "4px",
        borderLeftColor: online
          ? isHighLatency
            ? "hsl(0 84% 60%)"
            : node.color || "#10b981"
          : "hsl(0 0% 70%)",
      }}
      onClick={() => navigate(`/nodes/${node.id}`)}
    >
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Network className="h-4 w-4 text-muted-foreground shrink-0" />
            <h3 className="font-medium text-sm truncate">{node.name}</h3>
          </div>
          <span
            className={cn(
              "shrink-0 h-2 w-2 rounded-full",
              online ? "bg-emerald-500 animate-pulse-dot" : "bg-red-500"
            )}
          />
        </div>
        <div className="text-[10px] text-muted-foreground truncate">
          {node.host}:{node.port}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground font-mono tabular-nums">
            {status?.players_online != null && status?.players_max != null
              ? `${status.players_online}/${status.players_max}`
              : "--"}
          </span>
          {online ? (
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] px-1.5 py-0",
                isHighLatency
                  ? "bg-red-500/10 text-red-500 border-red-500/30"
                  : "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
              )}
            >
              {latency}ms
            </Badge>
          ) : (
            <span className="text-xs text-muted-foreground">Offline</span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
