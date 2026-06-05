import { useQuery } from "@tanstack/react-query"
import { useParams } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { api } from "@/api/endpoints"
import { PageHeader } from "@/components/shared/PageHeader"
import { StatCard, StatGrid } from "@/components/shared/StatCard"
import { EmptyState } from "@/components/shared/EmptyState"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Clock, Activity, Users, Calendar } from "lucide-react"
import { formatDuration, formatDateTime } from "@/lib/utils"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"

export default function PlayerDetailPage() {
  const { playerName } = useParams<{ playerName: string }>()
  const { t } = useTranslation()

  const { data: detail, isLoading } = useQuery({
    queryKey: ["player", playerName],
    queryFn: () => api.players.detail(playerName!),
    enabled: !!playerName,
  })

  const { data: heatmap = [] } = useQuery({
    queryKey: ["player-heatmap", playerName],
    queryFn: () => api.players.heatmap(playerName!, 30),
    enabled: !!playerName,
  })

  const { data: weekly } = useQuery({
    queryKey: ["player-weekly", playerName],
    queryFn: () => api.players.weekly(playerName!),
    enabled: !!playerName,
  })

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <StatGrid>
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </StatGrid>
        <Skeleton className="h-64 rounded-lg" />
      </div>
    )
  }

  if (!detail) {
    return (
      <EmptyState
        title={t("dashboard.loadingFailed")}
        description={t("players.noPlayers")}
      />
    )
  }

  const hourly = aggregateHourly(detail.sessions)

  const currentServer = detail.servers.find((s) => s.online)?.server_name

  return (
    <div className="space-y-6">
      <PageHeader
        title={detail.player_name}
        description={currentServer}>
        <span
          className={`inline-flex items-center gap-1.5 text-sm px-3 py-1 rounded-full ${
            detail.online
              ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
              : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full ${
              detail.online ? "bg-green-500" : "bg-gray-500"
            }`}
          />
          {detail.online ? t("common.online") : t("common.offline")}
        </span>
      </PageHeader>

      <StatGrid>
        <StatCard
          title={t("player.totalPlaytime")}
          value={
            detail.duration_seconds != null
              ? formatDuration(detail.duration_seconds)
              : "--"
          }
          icon={Clock}
        />
        <StatCard
          title={t("player.sessionCount")}
          value={detail.sessions.length}
          icon={Activity}
        />
        <StatCard
          title={t("players.lastSeen")}
          value={
            detail.last_seen
              ? new Date(detail.last_seen).toLocaleDateString()
              : t("players.neverSeen")
          }
          icon={Users}
        />
        <StatCard
          title={t("player.sampleDays")}
          value={weekly?.daily_stats?.length || 0}
          icon={Calendar}
        />
      </StatGrid>

      <div className="rounded-lg border bg-card p-4">
        <h3 className="text-sm font-medium mb-4">{t("player.hourlyActivity")}</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={hourly}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="hour" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="minutes" fill="#3b82f6" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {weekly?.daily_stats && weekly.daily_stats.length > 0 && (
        <div className="rounded-lg border bg-card p-4">
          <h3 className="text-sm font-medium mb-4">{t("player.dailyActivity")}</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={weekly.daily_stats}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10 }}
                tickFormatter={(v) => new Date(v).toLocaleDateString()}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="total_minutes" fill="#22c55e" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {heatmap.length > 0 && (
        <div className="rounded-lg border bg-card p-4">
          <h3 className="text-sm font-medium mb-4">{t("player.weeklyHeatmap")}</h3>
          <div className="grid grid-cols-24 gap-0.5">
            {Array.from({ length: 7 }, (_, day) => (
              <div key={day} className="contents">
                {Array.from({ length: 24 }, (_, hour) => {
                  const cell = heatmap.find(
                    (h) => h.weekday === day && h.hour === hour
                  )
                  const intensity = cell ? Math.min(cell.count / 10, 1) : 0
                  return (
                    <div
                      key={`${day}-${hour}`}
                      className="aspect-square rounded-sm"
                      style={{
                        backgroundColor: `rgba(59, 130, 246, ${0.1 + intensity * 0.9})`,
                      }}
                      title={`${day} ${hour}:00 — ${cell?.count || 0} sessions`}
                    />
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {detail.sessions.length > 0 && (
        <div className="rounded-lg border bg-card">
          <div className="px-4 py-3 border-b">
            <h3 className="text-sm font-medium">{t("player.sessions")}</h3>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("nodes.status")}</TableHead>
                <TableHead>{t("player.server")}</TableHead>
                <TableHead className="text-right">
                  {t("player.startTime")}
                </TableHead>
                <TableHead className="text-right">
                  {t("player.duration")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detail.sessions
                .slice(-20)
                .reverse()
                .map((s, i) => {
                  const isActive =
                    new Date(s.session_end).getTime() > Date.now() - 60000
                  const duration =
                    (new Date(s.session_end).getTime() -
                      new Date(s.session_start).getTime()) /
                    1000
                  return (
                    <TableRow key={s.id || i}>
                      <TableCell>
                        <span
                          className={`inline-flex items-center gap-1.5 text-xs ${
                            isActive
                              ? "text-green-600 dark:text-green-400"
                              : "text-muted-foreground"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              isActive ? "bg-green-500" : "bg-gray-400"
                            }`}
                          />
                          {isActive ? t("common.online") : t("common.offline")}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">{s.server_id}</TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {formatDateTime(s.session_start)}
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums">
                        {formatDuration(duration)}
                      </TableCell>
                    </TableRow>
                  )
                })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

function aggregateHourly(
  sessions: Array<{ session_start: string; session_end: string }>
): Array<{ hour: number; minutes: number }> {
  const buckets = new Map<number, number>()
  for (const s of sessions) {
    const h = new Date(s.session_start).getHours()
    const dur =
      (new Date(s.session_end).getTime() -
        new Date(s.session_start).getTime()) /
      1000 /
      60
    buckets.set(h, (buckets.get(h) || 0) + dur)
  }
  return Array.from(buckets, ([hour, minutes]) => ({
    hour,
    minutes: Math.round(minutes),
  })).sort((a, b) => a.hour - b.hour)
}
