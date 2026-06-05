import { useNavigate } from "react-router-dom"
import { Card, CardContent } from "@/components/ui/card"
import { Network } from "lucide-react"
import type { NodeWithStats } from "@/api/types"

export function NodeCard({ node }: { node: NodeWithStats }) {
  const navigate = useNavigate()
  const status = node.latest_status
  const online = status?.online ?? false

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow border-l-4 overflow-hidden"
      style={{ borderLeftColor: node.color || "#e5e7eb" }}
      onClick={() => navigate(`/nodes/${node.id}`)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <Network className="h-4 w-4 text-muted-foreground shrink-0" />
            <h3 className="font-medium text-sm truncate">{node.name}</h3>
          </div>
          <span
            className={`shrink-0 h-2 w-2 rounded-full ${
              online ? "bg-green-500" : "bg-red-500"
            }`}
          />
        </div>
        <div className="text-xs text-muted-foreground truncate mb-2">
          {node.host}:{node.port}
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            {status?.players_online != null && status?.players_max != null
              ? `${status.players_online}/${status.players_max}`
              : "--"}
          </span>
          <span className={online ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}>
            {online && status?.latency != null
              ? `${Math.round(status.latency)}ms`
              : "Offline"}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
