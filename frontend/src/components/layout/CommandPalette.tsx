import { useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
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

const pages = [
  { path: "/dashboard", key: "nav.dashboard", icon: LayoutDashboard },
  { path: "/monitor", key: "nav.monitor", icon: Monitor },
  { path: "/servers", key: "nav.servers", icon: Server },
  { path: "/nodes", key: "nav.nodes", icon: Network },
  { path: "/players", key: "nav.players", icon: Users },
  { path: "/badges", key: "nav.badges", icon: BadgeCheck },
  { path: "/admin", key: "nav.admin", icon: Settings },
  { path: "/login", key: "nav.login", icon: LogIn },
]

export function CommandPalette() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const { token } = useAuth()

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [])

  const runCommand = useCallback((command: () => void) => {
    setOpen(false)
    setQuery("")
    command()
  }, [])

  const filteredPages = pages.filter((p) => {
    if (p.path === "/admin" && !token) return false
    if (p.path === "/login" && token) return false
    return t(p.key).toLowerCase().includes(query.toLowerCase())
  })

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder={t("common.search")}
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>{t("common.noData")}</CommandEmpty>
        <CommandGroup heading={t("common.navigation")}>
          {filteredPages.map((page) => (
            <CommandItem
              key={page.path}
              onSelect={() => runCommand(() => navigate(page.path))}
              value={t(page.key)}
              className="transition-colors duration-150"
            >
              <page.icon className="mr-2 h-4 w-4 text-muted-foreground" />
              <span>{t(page.key)}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
