import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { Card, CardContent } from "@/components/ui/card"
import { Users } from "lucide-react"
import type { PlayerListItem } from "@/api/types"
import { formatDateTime } from "@/lib/utils"

export function PlayerCard({ player }: { player: PlayerListItem }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const currentServer = player.servers.find((s) => s.online)?.server_name

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => navigate(`/players/${encodeURIComponent(player.player_name)}`)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-medium text-sm">{player.player_name}</h3>
          </div>
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${
              player.online
                ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
            }`}
          >
            {player.online ? t("common.online") : t("common.offline")}
          </span>
        </div>
        {currentServer && (
          <p className="text-xs text-muted-foreground mb-1">
            {t("player.currentServer")}: {currentServer}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          {t("players.lastSeen")}: {formatDateTime(player.last_seen)}
        </p>
      </CardContent>
    </Card>
  )
}
