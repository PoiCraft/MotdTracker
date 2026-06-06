import { useTranslation } from "react-i18next"
import { Users, Zap, AlertTriangle, Server } from "lucide-react"
import { cn } from "@/lib/utils"
import type { MonitorStats } from "@/hooks/useMonitorData"

interface MonitorStatsBarProps {
  stats: MonitorStats
}

export function MonitorStatsBar({ stats }: MonitorStatsBarProps) {
  const { t } = useTranslation()

  const items = [
    {
      icon: <Server className="h-4 w-4" />,
      label: t("monitor.stats.nodes"),
      value: `${stats.onlineNodes}/${stats.totalNodes}`,
      sub: `${stats.onlineRate}%`,
      alert: stats.offlineNodes > 0,
      alertValue: stats.offlineNodes > 0 ? `${stats.offlineNodes} ${t("common.offline")}` : undefined,
    },
    {
      icon: <Users className="h-4 w-4" />,
      label: t("monitor.stats.players"),
      value: `${stats.totalPlayers}`,
      sub: stats.totalCapacity > 0 ? `/${stats.totalCapacity}` : "",
      alert: false,
    },
    {
      icon: <Zap className="h-4 w-4" />,
      label: t("monitor.stats.latency"),
      value: stats.avgLatency != null ? `${stats.avgLatency}ms` : "--",
      sub: "",
      alert: stats.avgLatency != null && stats.avgLatency > 500,
    },
    {
      icon: <AlertTriangle className="h-4 w-4" />,
      label: t("monitor.stats.alerts"),
      value: `${stats.issueCount}`,
      sub: stats.highLatencyCount > 0 ? `↑${stats.highLatencyCount}ms` : "",
      alert: stats.issueCount > 0,
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {items.map((item) => (
        <div
          key={item.label}
          className={cn(
            "rounded-lg border border-border/80 bg-card/60 backdrop-blur-md p-3",
            "flex items-center gap-3 transition-all duration-300",
            item.alert && "border-red-500/30 bg-red-500/5"
          )}
        >
          <div
            className={cn(
              "p-2 rounded-md shrink-0 transition-colors",
              item.alert
                ? "bg-red-500/10 text-red-500"
                : "bg-primary/10 text-primary"
            )}
          >
            {item.icon}
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
              {item.label}
            </p>
            <div className="flex items-baseline gap-1">
              <span
                className={cn(
                  "text-lg font-semibold tabular-nums",
                  item.alert && "text-red-500"
                )}
              >
                {item.value}
              </span>
              {item.sub && (
                <span className="text-xs text-muted-foreground tabular-nums">
                  {item.sub}
                </span>
              )}
            </div>
            {item.alertValue && (
              <p className="text-[10px] text-red-500 font-medium">{item.alertValue}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
