import { useMemo, useState, useEffect } from "react"
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
import {
  Clock,
  Activity,
  Timer,
  Trophy,
  Heart,
  Server,
  MapPin,
} from "lucide-react"
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
import type { PlayerSessionHistory, PlayerServerEntry } from "@/api/types"

function aggregateHourly(
  sessions: Array<{ session_start: string; session_end: string | null }>
): Array<{ hour: number; minutes: number }> {
  const buckets = new Map<number, number>()
  for (const s of sessions) {
    const start = new Date(s.session_start).getTime()
    const end = s.session_end ? new Date(s.session_end).getTime() : Date.now()
    if (end <= start) continue
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
  // Fill all 24 hours with 0 for missing buckets
  return Array.from({ length: 24 }, (_, hour) => ({
    hour,
    minutes: Math.round(buckets.get(hour) || 0),
  }))
}

function computeSessionStats(sessions: PlayerSessionHistory[]) {
  let total = 0
  let longest = 0
  const serverFreq = new Map<string, number>()

  for (const s of sessions) {
    const start = new Date(s.session_start).getTime()
    const end = s.session_end ? new Date(s.session_end).getTime() : Date.now()
    const dur = Math.max(0, (end - start) / 1000)
    if (s.session_end) {
      total += dur
      longest = Math.max(longest, dur)
    }
    serverFreq.set(s.server_id, (serverFreq.get(s.server_id) || 0) + 1)
  }

  const closed = sessions.filter((s) => s.session_end != null).length
  const avg = closed > 0 ? total / closed : 0

  let favorite = ""
  let favCount = 0
  for (const [sid, count] of serverFreq) {
    if (count > favCount) {
      favCount = count
      favorite = sid
    }
  }

  return { avg, longest, favorite, favCount }
}

function useServerNameMap(servers: PlayerServerEntry[]) {
  return useMemo(() => {
    const map = new Map<string, string>()
    for (const s of servers) {
      if (!map.has(s.server_id)) map.set(s.server_id, s.server_name)
    }
    return map
  }, [servers])
}

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

  const serverNameMap = useServerNameMap(detail?.servers ?? [])

  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5000)
    return () => clearInterval(id)
  }, [])

  const recentSessions = useMemo(() => {
    if (!detail) return []
    return detail.sessions.slice(0, 30).map((s) => ({
      ...s,
      isActive: detail.online && s.session_end === null,
      duration:
        s.session_end != null
          ? (new Date(s.session_end).getTime() -
              new Date(s.session_start).getTime()) /
            1000
          : (now - new Date(s.session_start).getTime()) / 1000,
    }))
  }, [detail, now])

  const stats = useMemo(() => {
    if (!detail) return null
    return computeSessionStats(detail.sessions)
  }, [detail])

  const hourly = useMemo(() => {
    if (!detail) return []
    return aggregateHourly(detail.sessions)
  }, [detail])

  const currentServer = detail?.servers.find((s) => s.online)

  const glassCard = cn(
    "rounded-xl p-4",
    "bg-card/60 backdrop-blur-md border border-border/80",
    "dark:bg-card/60"
  )

  const weekdayLabels = [
    t("player.mon"),
    t("player.tue"),
    t("player.wed"),
    t("player.thu"),
    t("player.fri"),
    t("player.sat"),
    t("player.sun"),
  ]

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <StatGrid cols={3}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
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

  return (
    <div className="space-y-6">
      <PageHeader title={detail.player_name} description={currentServer?.server_name}>
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

      <StatGrid cols={3}>
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
          title={t("player.avgSession")}
          value={stats ? formatDuration(Math.round(stats.avg)) : "--"}
          icon={Timer}
          subtitle={stats && stats.avg > 0 ? `${detail.sessions.length} ${t("common.sessions")}` : ""}
        />
        <StatCard
          title={t("player.longestSession")}
          value={stats ? formatDuration(Math.round(stats.longest)) : "--"}
          icon={Trophy}
          variant={stats && stats.longest > 7200 ? "success" : "default"}
        />
        <StatCard
          title={t("player.favoriteServer")}
          value={
            stats?.favorite
              ? serverNameMap.get(stats.favorite) || stats.favorite
              : "--"
          }
          icon={Heart}
        />
        <StatCard
          title={t("player.totalServers")}
          value={detail.servers.length}
          icon={Server}
          subtitle={t("players.lastSeen") + ": " + (detail.last_seen ? formatDateTime(detail.last_seen).split(" ")[0] : "--")}
        />
      </StatGrid>

      {detail.servers.length > 0 && (
        <div className={glassCard}>
          <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            {t("player.serverFootprint")}
          </h3>
          <div className="flex flex-wrap gap-2">
            {detail.servers.map((s) => (
              <div
                key={s.node_id}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs",
                  "bg-card/40 border-border/60 transition-all",
                  s.online && "border-emerald-500/30 bg-emerald-500/5"
                )}
                title={`${s.node_name} @ ${s.server_name}`}
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full shrink-0",
                    s.online ? "bg-emerald-500" : "bg-muted-foreground/40"
                  )}
                />
                <span className="font-medium">{s.server_name}</span>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground truncate max-w-[120px]">
                  {s.node_name}
                </span>
                <span className="text-muted-foreground/60 hidden sm:inline">
                  {formatDateTime(s.last_seen).split(" ")[0]}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={glassCard}>
        <h3 className="text-sm font-medium mb-4">{t("player.hourlyActivity")}</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={hourly}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--muted)" opacity={0.3} />
            <XAxis
              dataKey="hour"
              tick={{ fontSize: 11 }}
              stroke="var(--muted-foreground)"
            />
            <YAxis
              tick={{ fontSize: 11 }}
              stroke="var(--muted-foreground)"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                fontSize: "12px",
              }}
            />
            <Bar dataKey="minutes" fill="#3B82F6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {weekly?.daily_stats && weekly.daily_stats.length > 0 && (
        <div className={glassCard}>
          <h3 className="text-sm font-medium mb-4">{t("player.dailyActivity")}</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={(() => {
                const stats = weekly.daily_stats
                const map = new Map(stats.map((d) => [d.date.slice(0, 10), d.total_minutes]))
                const min = new Date(stats[0].date)
                const max = new Date(stats[stats.length - 1].date)
                const filled = []
                const cur = new Date(min)
                while (cur <= max) {
                  const key = cur.toISOString().slice(0, 10)
                  filled.push({ date: key, total_minutes: map.get(key) || 0 })
                  cur.setDate(cur.getDate() + 1)
                }
                return filled
              })()}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--muted)" opacity={0.3} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10 }}
                tickFormatter={(v) => new Date(v).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                stroke="var(--muted-foreground)"
              />
              <YAxis
                tick={{ fontSize: 11 }}
                stroke="var(--muted-foreground)"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Bar dataKey="total_minutes" fill="#10B981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {heatmap.length > 0 && (
        <div className={glassCard}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium">{t("player.weeklyHeatmap")}</h3>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground">{t("player.less")}</span>
              {[0.15, 0.35, 0.55, 0.75, 0.95].map((a, i) => (
                <div
                  key={i}
                  className="h-3 w-3 rounded-sm"
                  style={{ backgroundColor: `rgba(59, 130, 246, ${a})` }}
                />
              ))}
              <span className="text-[10px] text-muted-foreground">{t("player.more")}</span>
            </div>
          </div>
          <div className="flex gap-1">
            <div className="flex flex-col gap-[3px]">
              {weekdayLabels.map((label) => (
                <div key={label} className="h-3 text-[10px] text-muted-foreground w-5 flex items-center justify-end pr-1">
                  {label}
                </div>
              ))}
            </div>
            <div className="flex-1">
              <div className="grid gap-[3px]" style={{ gridTemplateColumns: "repeat(24, 1fr)" }}>
                {Array.from({ length: 7 }, (_, day) => (
                  <div key={day} className="contents">
                    {Array.from({ length: 24 }, (_, hour) => {
                      const cell = heatmap.find(
                        (h) => h.weekday === day && h.hour === hour
                      )
                      const intensity = cell ? Math.min(cell.count / 8, 1) : 0
                      return (
                        <div
                          key={`${day}-${hour}`}
                          className="h-3 rounded-sm transition-colors duration-150"
                          style={{
                            backgroundColor: `rgba(59, 130, 246, ${0.06 + intensity * 0.92})`,
                          }}
                          title={`${weekdayLabels[day]} ${hour}:00 — ${cell?.count || 0} sessions`}
                        />
                      )
                    })}
                  </div>
                ))}
              </div>
              <div className="grid mt-[3px]" style={{ gridTemplateColumns: "repeat(24, 1fr)" }}>
                {[0, 6, 12, 18].map((h) => (
                  <div
                    key={h}
                    className="text-[9px] text-muted-foreground/70"
                    style={{ gridColumnStart: h + 1, gridColumnEnd: h + 4 }}
                  >
                    {h}:00
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {detail.sessions.length > 0 ? (
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
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-20">{t("nodes.status")}</TableHead>
                  <TableHead>{t("player.server")}</TableHead>
                  <TableHead className="hidden md:table-cell">{t("player.node")}</TableHead>
                  <TableHead className="text-right">{t("player.startTime")}</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">{t("player.endTime")}</TableHead>
                  <TableHead className="text-right">{t("player.duration")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentSessions.map((s, i) => {
                  const serverName = serverNameMap.get(s.server_id) || s.server_id
                  const nodeEntry = detail.servers.find(
                    (sv) => sv.server_id === s.server_id
                  )
                  return (
                    <TableRow key={s.id || i} className="hover:bg-transparent">
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
                      <TableCell className="text-sm font-medium">{serverName}</TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                        {nodeEntry?.node_name || "—"}
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground tabular-nums">
                        {formatDateTime(s.session_start)}
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground tabular-nums hidden sm:table-cell">
                        {s.session_end ? formatDateTime(s.session_end) : "—"}
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums font-mono">
                        {formatDuration(s.duration)}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : (
        <div className={cn(glassCard, "text-sm text-muted-foreground text-center py-8")}>
          {t("player.noSessions")}
        </div>
      )}
    </div>
  )
}
