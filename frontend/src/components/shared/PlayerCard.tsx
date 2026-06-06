import { memo, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Clock, Server } from "lucide-react"
import { cn, formatDuration } from "@/lib/utils"
import type { PlayerListItem } from "@/api/types"
import { formatDateTime } from "@/lib/utils"

function avatarColor(name: string): string {
  const colors = [
    "bg-red-500/20 text-red-400",
    "bg-orange-500/20 text-orange-400",
    "bg-amber-500/20 text-amber-400",
    "bg-emerald-500/20 text-emerald-400",
    "bg-cyan-500/20 text-cyan-400",
    "bg-blue-500/20 text-blue-400",
    "bg-violet-500/20 text-violet-400",
    "bg-pink-500/20 text-pink-400",
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

export const PlayerCard = memo(function PlayerCard({ player }: { player: PlayerListItem }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const currentServer = player.servers.find((s) => s.online)?.server_name
  const serverCount = player.servers.length

  const initial = useMemo(() => {
    return player.player_name.charAt(0).toUpperCase()
  }, [player.player_name])

  const avColor = useMemo(() => avatarColor(player.player_name), [player.player_name])

  return (
    <Card
      className={cn(
        "cursor-pointer group",
        "bg-card/60 backdrop-blur-md border border-border/80 shadow-sm",
        "dark:bg-card/60",
        "transition-all duration-300 ease-out",
        "hover:shadow-md hover:-translate-y-0.5",
        player.online
          ? "border-l-[3px] border-l-emerald-500 hover:shadow-[0_0_15px_rgba(16,185,129,0.1)]"
          : "border-l-[3px] border-l-transparent"
      )}
      onClick={() =>
        navigate(`/players/${encodeURIComponent(player.player_name)}`)
      }
    >
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "h-9 w-9 rounded-lg flex items-center justify-center text-sm font-bold shrink-0",
              avColor
            )}
          >
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-sm truncate">
                {player.player_name}
              </h3>
              {player.online ? (
                <Badge
                  variant="outline"
                  className={cn(
                    "shrink-0 text-[10px] px-1.5 py-0",
                    "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
                  )}
                >
                  {t("common.online")}
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className={cn(
                    "shrink-0 text-[10px] px-1.5 py-0",
                    "bg-muted/40 text-muted-foreground border-border/60"
                  )}
                >
                  {t("common.offline")}
                </Badge>
              )}
            </div>
            {currentServer && (
              <p className="text-[11px] text-muted-foreground truncate">
                {currentServer}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          {player.duration_seconds != null && (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDuration(player.duration_seconds)}
            </span>
          )}
          {serverCount > 0 && (
            <span className="inline-flex items-center gap-1">
              <Server className="h-3 w-3" />
              {serverCount}
            </span>
          )}
        </div>

        <p className="text-[10px] text-muted-foreground/70">
          {t("players.lastSeen")}: {formatDateTime(player.last_seen)}
        </p>
      </CardContent>
    </Card>
  )
})
