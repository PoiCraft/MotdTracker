import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { Card, CardContent } from "@/components/ui/card"
import { Server } from "lucide-react"
import type { ServerItem } from "@/api/types"

export function ServerCard({ server }: { server: ServerItem }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const agg = server.aggregate
  const allOnline = agg.online_node_count === agg.total_node_count && agg.total_node_count > 0

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow border-l-4"
      style={{ borderLeftColor: allOnline ? "#22c55e" : "#e5e7eb" }}
      onClick={() => navigate(`/servers/${server.id}`)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-medium text-sm">{server.name}</h3>
          </div>
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${
              allOnline
                ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
            }`}
          >
            {allOnline ? t("common.online") : t("common.partial")}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-lg font-semibold tabular-nums">
              {agg.online_node_count}
              <span className="text-xs text-muted-foreground">
                /{agg.total_node_count}
              </span>
            </div>
            <div className="text-[10px] text-muted-foreground uppercase">
              {t("servers.nodes")}
            </div>
          </div>
          <div>
            <div className="text-lg font-semibold tabular-nums">
              {agg.total_players_online}
            </div>
            <div className="text-[10px] text-muted-foreground uppercase">
              {t("servers.players")}
            </div>
          </div>
          <div>
            <div className="text-lg font-semibold tabular-nums">
              {agg.avg_latency != null && agg.avg_latency > 0
                ? `${Math.round(agg.avg_latency)}ms`
                : "--"}
            </div>
            <div className="text-[10px] text-muted-foreground uppercase">
              {t("nodes.latency")}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
