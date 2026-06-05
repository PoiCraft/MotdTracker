import { type LucideIcon } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { Sparkline } from "@/components/shared/Sparkline"

interface StatCardProps {
  title: string
  value: string | number
  icon?: LucideIcon
  subtitle?: string
  variant?: "default" | "success" | "warning" | "danger"
  sparklineData?: number[]
  sparklineThreshold?: number
}

export function StatCard({
  title,
  value,
  icon: Icon,
  subtitle,
  variant = "default",
  sparklineData,
  sparklineThreshold,
}: StatCardProps) {
  const variantStyles = {
    default: "",
    success: "border-l-4 border-l-emerald-500",
    warning: "border-l-4 border-l-amber-500",
    danger: "border-l-4 border-l-red-500",
  }

  const glowStyles = {
    default: "",
    success: "hover:shadow-[0_0_15px_rgba(16,185,129,0.1)]",
    warning: "hover:shadow-[0_0_15px_rgba(245,158,11,0.1)]",
    danger: "animate-glow-red",
  }

  return (
    <Card
      className={cn(
        "bg-card/60 backdrop-blur-md border border-border/80 shadow-sm",
        "dark:bg-card/60",
        "transition-all duration-300 ease-out",
        variantStyles[variant],
        glowStyles[variant]
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1 min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground/80">
              {title}
            </p>
            <p className="text-2xl font-bold font-mono tracking-tight tabular-nums">
              {value}
            </p>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            {Icon && (
              <Icon className="h-5 w-5 text-muted-foreground/60" />
            )}
            {sparklineData && sparklineData.length > 1 && (
              <Sparkline
                data={sparklineData}
                width={64}
                height={24}
                alertThreshold={sparklineThreshold}
              />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function StatGrid({
  children,
  cols = 4,
}: {
  children: React.ReactNode
  cols?: number
}) {
  return (
    <div
      className={cn("grid gap-4", {
        "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4": cols === 4,
        "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3": cols === 3,
        "grid-cols-1 sm:grid-cols-2": cols === 2,
      })}
    >
      {children}
    </div>
  )
}
