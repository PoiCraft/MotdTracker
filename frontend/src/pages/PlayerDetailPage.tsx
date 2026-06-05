import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { useParams } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { api } from "@/api/endpoints"
import { PageHeader } from "@/components/shared/PageHeader"
import { StatCard, StatGrid } from "@/components/shared/StatCard"
import { EmptyState } from "@/components/shared/EmptyState"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Clock, Activity, Users, Calendar } from "lucide-react"
import { cn, formatDuration, formatDateTime } from "@/lib/utils"
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

  const recentSessions = useMemo(() => {
    if (!detail) return []
    return detail.sessions.slice(-20).reverse().map((s) => ({
      ...s,
      isActive: detail.online && s.session_end === null,
      duration:
        (new Date(s.session_end!).getTime() -
          new Date(s.session_start).getTime()) /
        1000,
    }))
  }, [detail])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <StatGrid>
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </StatGrid>
        <Skeleton className="h-64 rounded-xl" />
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

  const glassCard = cn(
    "rounded-xl p-4",
    "bg-card/60 backdrop-blur-md border border-border/80",
    "dark:bg-card/60"
  )

  return (
    <div className="space-y-6">
      <PageHeader title={detail.player_name} description={currentServer}>
        {detail.online ? (
          <Badge
            variant="outline"
            className={cn(
              "text-sm px-3 py-1",
              "bg-emerald-500/10 text-emerald-500 border-emerald-500/30",
              "animate-pulse"
            )}
          >
            <span className="h-2 w-2 rounded-full mr-1.5 bg-emerald-500" />
            {t("common.online")}
          </Badge>
        ) : (
          <Badge
            variant="outline"
            className="text-sm px-3 py-1 bg-muted/40 text-muted-foreground border-border/60"
          >
            <span className="h-2 w-2 rounded-full mr-1.5 bg-muted-foreground/40" />
            {t("common.offline")}
          </Badge>
        )}
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

      <div className={glassCard}>
        <h3 className="text-sm font-medium mb-4">
          {t("player.hourlyActivity")}
        </h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={hourly}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted/40" />
            <XAxis
              dataKey="hour"
              tick={{ fontSize: 11 }}
              className="text-muted-foreground"
            />
            <YAxis
              tick={{ fontSize: 11 }}
              className="text-muted-foreground"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                fontSize: "12px",
              }}
            />
            <Bar
              dataKey="minutes"
              fill="hsl(200 84% 50%)"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {weekly?.daily_stats && weekly.daily_stats.length > 0 && (
        <div className={glassCard}>
          <h3 className="text-sm font-medium mb-4">
            {t("player.dailyActivity")}
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={weekly.daily_stats}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted/40" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10 }}
                tickFormatter={(v) => new Date(v).toLocaleDateString()}
                className="text-muted-foreground"
              />
              <YAxis
                tick={{ fontSize: 11 }}
                className="text-muted-foreground"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Bar
                dataKey="total_minutes"
                fill="hsl(160 84% 39%)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {heatmap.length > 0 && (
        <div className={glassCard}>
          <h3 className="text-sm font-medium mb-4">
            {t("player.weeklyHeatmap")}
          </h3>
          <div className="grid gap-0.5" style={{ gridTemplateColumns: 'repeat(24, 1fr)' }}>
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
                      className="aspect-square rounded-sm transition-colors duration-150"
                      style={{
                        backgroundColor: `rgba(16, 185, 129, ${0.08 + intensity * 0.85})`,
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
        <div
          className={cn(
            "rounded-xl overflow-hidden",
            "bg-card/60 backdrop-blur-md border border-border/80",
            "dark:bg-card/60"
          )}
        >
          <div className="px-4 py-3 border-b border-border/60">
            <h3 className="text-sm font-medium">{t("player.sessions")}</h3>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
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
              {recentSessions.map((s, i) => (
                    <TableRow
                      key={s.id || i}
                      className="hover:bg-transparent"
                    >
                      <TableCell>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 text-xs",
                            s.isActive
                              ? "text-emerald-500"
                              : "text-muted-foreground"
                          )}
                        >
                          <span
                            className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              s.isActive
                                ? "bg-emerald-500"
                                : "bg-muted-foreground/40"
                            )}
                          />
                          {s.isActive ? t("common.online") : t("common.offline")}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">{s.server_id}</TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {formatDateTime(s.session_start)}
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums font-mono">
                        {formatDuration(s.duration)}
                      </TableCell>
                    </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

function aggregateHourly(
  sessions: Array<{ session_start: string; session_end: string | null }>
): Array<{ hour: number; minutes: number }> {
  const buckets = new Map<number, number>()
  for (const s of sessions) {
    const start = new Date(s.session_start).getTime()
    const end = s.session_end ? new Date(s.session_end).getTime() : Date.now()
    if (end <= start) continue

    // 将会话时长按实际跨越的小时分摊
    let cursor = start
    while (cursor < end) {
      const hourStart = new Date(cursor)
      hourStart.setMinutes(0, 0, 0)
      const nextHour = hourStart.getTime() + 3600_000
      const chunkEnd = Math.min(nextHour, end)
      const minutes = (chunkEnd - cursor) / 1000 / 60
      const h = new Date(cursor).getHours()
      buckets.set(h, (buckets.get(h) || 0) + minutes)
      cursor = chunkEnd
    }
  }
  return Array.from(buckets, ([hour, minutes]) => ({
    hour,
    minutes: Math.round(minutes),
  })).sort((a, b) => a.hour - b.hour)
}
