import { memo } from "react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Users } from "lucide-react"
import { cn } from "@/lib/utils"
import type { PlayerListItem } from "@/api/types"
import { formatDateTime } from "@/lib/utils"

export const PlayerCard = memo(function PlayerCard({ player }: { player: PlayerListItem }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const currentServer = player.servers.find((s) => s.online)?.server_name

  return (
    <Card
      className={cn(
        "cursor-pointer",
        "bg-card/60 backdrop-blur-md border border-border/80 shadow-sm",
        "dark:bg-card/60",
        "transition-all duration-300 ease-out",
        "hover:shadow-md",
        player.online && "hover:shadow-[0_0_15px_rgba(16,185,129,0.1)]"
      )}
      onClick={() =>
        navigate(`/players/${encodeURIComponent(player.player_name)}`)
      }
    >
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Users className="h-4 w-4 text-muted-foreground shrink-0" />
            <h3 className="font-medium text-sm truncate">
              {player.player_name}
            </h3>
          </div>
          {player.online ? (
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
                "bg-muted/40 text-muted-foreground border-border/60"
              )}
            >
              {t("common.offline")}
            </Badge>
          )}
        </div>
        {currentServer && (
          <p className="text-[10px] text-muted-foreground truncate">
            {t("player.currentServer")}: {currentServer}
          </p>
        )}
        <p className="text-[10px] text-muted-foreground">
          {t("players.lastSeen")}: {formatDateTime(player.last_seen)}
        </p>
      </CardContent>
    </Card>
  )
})
