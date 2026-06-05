import { useNavigate, useLocation } from "react-router-dom"
import { useTranslation } from "react-i18next"
import {
  LayoutDashboard,
  Monitor,
  Server,
  Network,
  Users,
  BadgeCheck,
  Settings,
  LogIn,
} from "lucide-react"
import { useAuth } from "@/providers/AuthProvider"
import { cn } from "@/lib/utils"

const navItems = [
  { path: "/dashboard", label: "nav.dashboard", icon: LayoutDashboard },
  { path: "/monitor", label: "nav.monitor", icon: Monitor },
  { path: "/servers", label: "nav.servers", icon: Server },
  { path: "/nodes", label: "nav.nodes", icon: Network },
  { path: "/players", label: "nav.players", icon: Users },
  { path: "/badges", label: "nav.badges", icon: BadgeCheck },
  { path: "/admin", label: "nav.admin", icon: Settings, auth: true },
  { path: "/login", label: "nav.login", icon: LogIn, guest: true },
]

export function BottomNav() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { token } = useAuth()

  const visibleItems = navItems.filter((item) => {
    if (item.auth && !token) return false
    if (item.guest && token) return false
    return true
  })

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-border/60 bg-background/60 backdrop-blur-xl">
      <div className="flex justify-around items-center h-14 px-1">
        {visibleItems.map((item) => {
          const active = location.pathname.startsWith(item.path)
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-lg min-w-0 transition-all duration-300",
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              <span className="text-[10px] truncate max-w-14">
                {t(item.label)}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
