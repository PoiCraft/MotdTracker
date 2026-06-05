import { useCallback } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { useTheme } from "next-themes"
import {
  LayoutDashboard,
  Monitor,
  Server,
  Network,
  Users,
  BadgeCheck,
  Settings,
  LogIn,
  Moon,
  Sun,
  Search,
  Globe,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAuth } from "@/providers/AuthProvider"
import { useWebSocket } from "@/providers/WebSocketProvider"

const navItems = [
  { path: "/dashboard", label: "nav.dashboard", icon: LayoutDashboard },
  { path: "/monitor", label: "nav.monitor", icon: Monitor },
  { path: "/servers", label: "nav.servers", icon: Server },
  { path: "/nodes", label: "nav.nodes", icon: Network },
  { path: "/players", label: "nav.players", icon: Users },
  { path: "/badges", label: "nav.badges", icon: BadgeCheck },
]

const languages = [
  { code: "zh-CN", label: "中文" },
  { code: "en", label: "English" },
]

export function TopBar() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { token } = useAuth()
  const { status: wsStatus } = useWebSocket()
  const { theme, setTheme } = useTheme()
  const isDark = theme === "dark"

  const toggleTheme = () => {
    setTheme(isDark ? "light" : "dark")
  }

  const currentTitle =
    navItems.find(
      (n) =>
        location.pathname === n.path ||
        location.pathname.startsWith(n.path + "/")
    )?.label || "nav.dashboard"

  const openCmdPalette = useCallback(() => {
    const event = new KeyboardEvent("keydown", {
      key: "k",
      ctrlKey: true,
      bubbles: true,
    })
    document.dispatchEvent(event)
  }, [])

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/60 backdrop-blur-xl supports-[backdrop-filter]:bg-background/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-12 items-center gap-2 sm:gap-4">
          <button
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-2 font-semibold text-sm shrink-0 hover:opacity-80 transition-opacity duration-300"
          >
            <div className="h-6 w-6 rounded bg-foreground text-background flex items-center justify-center text-xs font-bold">
              M
            </div>
            <span className="hidden sm:inline">{t("common.appName")}</span>
          </button>

          <nav className="hidden md:flex items-center gap-1 ml-2">
            {navItems.map((item) => {
              const active =
                location.pathname === item.path ||
                location.pathname.startsWith(item.path + "/")
              return (
                <Button
                  key={item.path}
                  variant={active ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => navigate(item.path)}
                  className={`h-8 text-xs gap-1.5 transition-all duration-300 ${
                    active
                      ? "border border-input shadow-sm bg-secondary/80"
                      : ""
                  }`}
                >
                  <item.icon className="h-3.5 w-3.5" />
                  {t(item.label)}
                </Button>
              )
            })}
          </nav>

          <div className="md:hidden flex-1 text-sm font-medium text-muted-foreground truncate">
            {t(currentTitle)}
          </div>

          <div className="flex items-center gap-1 ml-auto">
            <div className="hidden sm:flex items-center gap-1 mr-1">
              <div
                role="status"
                aria-label={wsStatus === "connected" ? t("common.online") : wsStatus === "connecting" ? t("common.loading") : t("common.offline")}
                className={`h-2 w-2 rounded-full transition-colors duration-300 ${
                  wsStatus === "connected"
                    ? "bg-emerald-500 animate-pulse-dot"
                    : wsStatus === "connecting"
                    ? "bg-amber-500"
                    : "bg-red-500"
                }`}
              />
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={openCmdPalette}
              className="h-8 px-2 gap-2 text-muted-foreground hidden sm:inline-flex transition-all duration-300 bg-background/50 backdrop-blur-sm"
            >
              <Search className="h-3.5 w-3.5" />
              <span className="text-xs">{t("common.search")}</span>
              <kbd className="pointer-events-none hidden lg:inline-flex h-5 select-none items-center gap-1 rounded border border-border/60 bg-muted/60 px-1.5 font-mono text-[10px] font-medium">
                {navigator.platform.includes("Mac") ? "⌘K" : "Ctrl+K"}
              </kbd>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 transition-all duration-300"
                  aria-label={t("common.appName")}
                >
                  <Globe className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-36">
                {languages.map((lang) => (
                  <DropdownMenuItem
                    key={lang.code}
                    onClick={() => i18n.changeLanguage(lang.code)}
                    className={i18n.language === lang.code ? "font-medium" : ""}
                  >
                    {lang.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 transition-all duration-300"
              onClick={toggleTheme}
              aria-label={isDark ? t("common.enabled") : t("common.disabled")}
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>

            {token ? (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 transition-all duration-300"
                onClick={() => navigate("/admin")}
                aria-label={t("nav.admin")}
              >
                <Settings className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 transition-all duration-300"
                onClick={() => navigate("/login")}
                aria-label={t("nav.login")}
              >
                <LogIn className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
