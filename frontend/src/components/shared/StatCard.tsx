import { type LucideIcon } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface StatCardProps {
  title: string
  value: string | number
  icon?: LucideIcon
  subtitle?: string
  variant?: "default" | "success" | "warning" | "danger"
}

export function StatCard({ title, value, icon: Icon, subtitle, variant = "default" }: StatCardProps) {
  const variantStyles = {
    default: "",
    success: "border-l-4 border-l-green-500",
    warning: "border-l-4 border-l-yellow-500",
    danger: "border-l-4 border-l-red-500",
  }

  return (
    <Card className={cn(variantStyles[variant])}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold tabular-nums">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          {Icon && <Icon className="h-5 w-5 text-muted-foreground" />}
        </div>
      </CardContent>
    </Card>
  )
}

export function StatGrid({ children, cols = 4 }: { children: React.ReactNode; cols?: number }) {
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
