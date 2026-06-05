import { useState, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { useQuery } from "@tanstack/react-query"
import { api } from "@/api/endpoints"
import { PageHeader } from "@/components/shared/PageHeader"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Copy,
  Check,
  ChevronRight,
  Folder,
  Server,
  Network,
  Users,
} from "lucide-react"
import { cn } from "@/lib/utils"

const NODE_BADGE_TYPES = [
  { value: "status", label: "Status" },
  { value: "uptime", label: "Uptime" },
  { value: "latency", label: "Latency" },
  { value: "latency-stats", label: "Latency Stats" },
  { value: "players", label: "Players" },
]

const SERVER_BADGE_TYPES = [
  { value: "status", label: "Server Status" },
  { value: "uptime", label: "Server Uptime" },
  { value: "players", label: "Server Players" },
]

const PLAYER_BADGE_TYPES = [
  { value: "status", label: "Status" },
  { value: "current-session", label: "Current Session" },
  { value: "period-playtime", label: "Period Playtime" },
  { value: "live", label: "Live" },
]

const FORMATS = [
  { value: "url", label: "URL" },
  { value: "html", label: "HTML" },
  { value: "markdown", label: "Markdown" },
]

type SelectionType = "server" | "node" | "player"

interface TreeSelection {
  type: SelectionType
  id: string
  name: string
}

export default function BadgesPage() {
  const { t } = useTranslation()

  const { data: groups = [], isLoading: groupsLoading } = useQuery({
    queryKey: ["groups"],
    queryFn: api.groups.list,
  })
  const { data: servers = [], isLoading: serversLoading } = useQuery({
    queryKey: ["servers"],
    queryFn: () => api.servers.list(),
  })
  const { data: nodes = [], isLoading: nodesLoading } = useQuery({
    queryKey: ["nodes"],
    queryFn: () => api.nodes.list(),
  })
  const { data: players = [], isLoading: playersLoading } = useQuery({
    queryKey: ["players"],
    queryFn: () => api.players.list(),
  })

  const loading =
    groupsLoading || serversLoading || nodesLoading || playersLoading

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [expandedServers, setExpandedServers] = useState<Set<string>>(
    new Set()
  )
  const [expandedPlayers, setExpandedPlayers] = useState(false)
  const [playerSearch, setPlayerSearch] = useState("")
  const [selected, setSelected] = useState<TreeSelection | null>(null)
  const [selectedType, setSelectedType] = useState("status")
  const [selectedFormat, setSelectedFormat] = useState("url")
  const [copied, setCopied] = useState(false)

  const serversByGroup = useMemo(() => {
    const map = new Map<string, typeof servers>()
    for (const s of servers) {
      const gid = s.group_id || "__ungrouped"
      if (!map.has(gid)) map.set(gid, [])
      map.get(gid)!.push(s)
    }
    return map
  }, [servers])

  const nodesByServer = useMemo(() => {
    const map = new Map<string, typeof nodes>()
    for (const n of nodes) {
      if (!map.has(n.server_id)) map.set(n.server_id, [])
      map.get(n.server_id)!.push(n)
    }
    return map
  }, [nodes])

  function toggleGroup(id: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })
  }

  function toggleServer(id: string) {
    setExpandedServers((prev) => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })
  }

  const baseUrl = window.location.origin

  const badgeTypes =
    selected?.type === "server"
      ? SERVER_BADGE_TYPES
      : selected?.type === "player"
      ? PLAYER_BADGE_TYPES
      : NODE_BADGE_TYPES

  function buildUrl(): string {
    if (!selected) return ""
    if (selected.type === "server")
      return `${baseUrl}/api/badges/server/${selectedType}`
    if (selected.type === "player")
      return `${baseUrl}/api/badges/player/${encodeURIComponent(selected.name)}/${selectedType}`
    return `${baseUrl}/api/badges/node/${selected.id}/${selectedType}`
  }

  const finalUrl = buildUrl()

  function getFormatted(): string {
    if (!finalUrl) return ""
    const alt = selected ? `${selected.name} ${selectedType}` : selectedType
    switch (selectedFormat) {
      case "html":
        return `<img src="${finalUrl}" alt="${alt}" />`
      case "markdown":
        return `![${alt}](${finalUrl})`
      default:
        return finalUrl
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(getFormatted())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading)
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
          <Skeleton className="h-96 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </div>
    )

  const ungroupedServers = serversByGroup.get("__ungrouped") || []
  const onlinePlayers = players.filter((p) => p.online)
  const offlinePlayers = players.filter((p) => !p.online)

  const filteredOnline = playerSearch
    ? onlinePlayers.filter((p) => p.player_name.toLowerCase().includes(playerSearch.toLowerCase()))
    : onlinePlayers
  const filteredOffline = playerSearch
    ? offlinePlayers.filter((p) => p.player_name.toLowerCase().includes(playerSearch.toLowerCase()))
    : offlinePlayers

  const glassCard = cn(
    "bg-card/60 backdrop-blur-md border border-border/80 shadow-sm",
    "dark:bg-card/60"
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("badges.title")}
        description={t("badges.description")}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
        <div
          className={cn(
            "rounded-xl overflow-hidden",
            glassCard,
            "max-h-[calc(100vh-220px)] flex flex-col"
          )}
        >
          <div className="px-4 py-3 border-b border-border/60">
            <h3 className="text-sm font-semibold">{t("admin.structure")}</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {groups.map((g) => {
              const groupServers = serversByGroup.get(g.id) || []
              const isExpanded = expandedGroups.has(g.id)

              return (
                <div key={g.id}>
                  <TreeRow
                    icon={Folder}
                    label={g.name}
                    count={groupServers.length}
                    expanded={isExpanded}
                    color="text-amber-500"
                    onToggle={() => toggleGroup(g.id)}
                  />
                  {isExpanded &&
                    groupServers.map((s) => {
                      const serverNodes = nodesByServer.get(s.id) || []
                      const isServerExpanded = expandedServers.has(s.id)
                      const isServerSelected =
                        selected?.type === "server" && selected.id === s.id

                      return (
                        <div key={s.id} className="ml-4">
                          <TreeRow
                            icon={Server}
                            label={s.name}
                            count={serverNodes.length}
                            expanded={isServerExpanded}
                            selected={isServerSelected}
                            color="text-sky-500"
                            onToggle={() => toggleServer(s.id)}
                            onSelect={() => {
                              setSelected({
                                type: "server",
                                id: s.id,
                                name: s.name,
                              })
                              setSelectedType("status")
                            }}
                          />
                          {isServerExpanded &&
                            serverNodes.map((n) => {
                              const isNodeSelected =
                                selected?.type === "node" &&
                                selected.id === n.id
                              return (
                                <div key={n.id} className="ml-4">
                                  <TreeRow
                                    icon={Network}
                                    label={n.name}
                                    selected={isNodeSelected}
                                    color="text-emerald-500"
                                    onSelect={() => {
                                      setSelected({
                                        type: "node",
                                        id: n.id,
                                        name: n.name,
                                      })
                                      setSelectedType("status")
                                    }}
                                    badge={
                                      n.latest_status?.online === false ? (
                                        <Badge
                                          variant="outline"
                                          className="text-[9px] px-1 py-0 bg-red-500/10 text-red-500 border-red-500/30"
                                        >
                                          OFF
                                        </Badge>
                                      ) : undefined
                                    }
                                  />
                                </div>
                              )
                            })}
                        </div>
                      )
                    })}
                </div>
              )
            })}

            {ungroupedServers.length > 0 && (
              <div className="pt-2 mt-2 border-t border-border/40">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 px-2 mb-1">
                  {t("admin.ungrouped")}
                </p>
                {ungroupedServers.map((s) => {
                  const serverNodes = nodesByServer.get(s.id) || []
                  const isServerExpanded = expandedServers.has(s.id)
                  const isServerSelected =
                    selected?.type === "server" && selected.id === s.id
                  return (
                    <div key={s.id} className="ml-2">
                      <TreeRow
                        icon={Server}
                        label={s.name}
                        count={serverNodes.length}
                        expanded={isServerExpanded}
                        selected={isServerSelected}
                        color="text-sky-500"
                        onToggle={() => toggleServer(s.id)}
                        onSelect={() => {
                          setSelected({
                            type: "server",
                            id: s.id,
                            name: s.name,
                          })
                          setSelectedType("status")
                        }}
                      />
                      {isServerExpanded &&
                        serverNodes.map((n) => (
                          <div key={n.id} className="ml-4">
                            <TreeRow
                              icon={Network}
                              label={n.name}
                              selected={
                                selected?.type === "node" &&
                                selected.id === n.id
                              }
                              color="text-emerald-500"
                              onSelect={() => {
                                setSelected({
                                  type: "node",
                                  id: n.id,
                                  name: n.name,
                                })
                                setSelectedType("status")
                              }}
                            />
                          </div>
                        ))}
                    </div>
                  )
                })}
              </div>
            )}

            {players.length > 0 && (
              <div className="pt-2 mt-2 border-t border-border/40">
                <TreeRow
                  icon={Users}
                  label={t("players.title")}
                  count={players.length}
                  expanded={expandedPlayers}
                  color="text-violet-500"
                  onToggle={() =>
                    setExpandedPlayers((v) => !v)
                  }
                />
                {expandedPlayers && (
                  <>
                    <div className="ml-4 my-1">
                      <input
                        type="text"
                        placeholder={t("players.search")}
                        value={playerSearch}
                        onChange={(e) => setPlayerSearch(e.target.value)}
                        className="w-full text-xs px-2 py-1 rounded-md bg-muted/40 border border-border/40 focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground/50"
                      />
                    </div>
                    {filteredOnline.map((p) => (
                      <div key={p.player_name} className="ml-4">
                        <TreeRow
                          icon={Users}
                          label={p.player_name}
                          selected={
                            selected?.type === "player" &&
                            selected.id === p.player_name
                          }
                          color="text-emerald-500"
                          onSelect={() => {
                            setSelected({
                              type: "player",
                              id: p.player_name,
                              name: p.player_name,
                            })
                            setSelectedType("status")
                          }}
                          badge={
                            <Badge
                              variant="outline"
                              className="text-[9px] px-1 py-0 bg-emerald-500/10 text-emerald-500 border-emerald-500/30 animate-pulse"
                            >
                              ON
                            </Badge>
                          }
                        />
                      </div>
                    ))}
                    {filteredOffline.map((p) => (
                      <div key={p.player_name} className="ml-4">
                        <TreeRow
                          icon={Users}
                          label={p.player_name}
                          selected={
                            selected?.type === "player" &&
                            selected.id === p.player_name
                          }
                          color="text-muted-foreground"
                          onSelect={() => {
                            setSelected({
                              type: "player",
                              id: p.player_name,
                              name: p.player_name,
                            })
                            setSelectedType("status")
                          }}
                        />
                      </div>
                    ))}
                    {playerSearch && filteredOnline.length === 0 && filteredOffline.length === 0 && (
                      <p className="ml-4 text-[10px] text-muted-foreground/60 py-1">
                        {t("players.noPlayers")}
                      </p>
                    )}
                  </>
                )}
              </div>
            )}

            {groups.length === 0 &&
              servers.length === 0 &&
              players.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                  <Folder className="h-8 w-8 mb-2 opacity-40" />
                  <p className="text-xs">{t("admin.noConfig")}</p>
                </div>
              )}
          </div>
        </div>

        <div className="space-y-4">
          {!selected ? (
            <div
              className={cn(
                "rounded-xl h-full flex flex-col items-center justify-center text-center min-h-[300px]",
                glassCard
              )}
            >
              <Network className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">
                {t("badges.selectNode")}
              </p>
            </div>
          ) : (
            <>
              <div className={cn("rounded-xl", glassCard)}>
                <div className="px-4 py-3 border-b border-border/60">
                  <div className="flex items-center gap-2">
                    {selected.type === "server" ? (
                      <Server className="h-4 w-4 text-sky-500" />
                    ) : selected.type === "player" ? (
                      <Users className="h-4 w-4 text-violet-500" />
                    ) : (
                      <Network className="h-4 w-4 text-emerald-500" />
                    )}
                    <h3 className="text-sm font-semibold">
                      {selected.name}
                    </h3>
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1.5 py-0 bg-muted/30 border-border/40"
                    >
                      {selected.type === "server"
                        ? t("badges.serverLevel")
                        : selected.type === "player"
                        ? t("badges.playerLevel")
                        : t("badges.nodeLevel")}
                    </Badge>
                  </div>
                </div>
                <div className="p-4 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase tracking-wider text-muted-foreground/80">
                        {t("badges.type")}
                      </label>
                      <Select
                        value={selectedType}
                        onValueChange={setSelectedType}
                      >
                        <SelectTrigger className="bg-card/40 backdrop-blur-sm border-border/60">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {badgeTypes.map((bt) => (
                            <SelectItem key={bt.value} value={bt.value}>
                              {bt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase tracking-wider text-muted-foreground/80">
                        {t("badges.format")}
                      </label>
                      <Select
                        value={selectedFormat}
                        onValueChange={setSelectedFormat}
                      >
                        <SelectTrigger className="bg-card/40 backdrop-blur-sm border-border/60">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FORMATS.map((f) => (
                            <SelectItem key={f.value} value={f.value}>
                              {f.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>

              {finalUrl && (
                <Card className={glassCard}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium">
                        {t("badges.preview")}
                      </h3>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCopy}
                        className="transition-all duration-300"
                      >
                        {copied ? (
                          <>
                            <Check className="h-3.5 w-3.5 mr-1" />
                            {t("badges.copied")}
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5 mr-1" />
                            {t("common.copy")}
                          </>
                        )}
                      </Button>
                    </div>
                    <Input
                      value={getFormatted()}
                      readOnly
                      className="font-mono text-xs bg-background/50"
                    />
                    <div className="border border-border/60 rounded-lg p-4 flex items-center justify-center bg-muted/20 backdrop-blur-sm">
                      <img
                        src={finalUrl}
                        alt="Badge"
                        className="max-h-16"
                        onError={(e) => {
                          ;(e.target as HTMLImageElement).style.display =
                            "none"
                        }}
                      />
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function TreeRow({
  icon: Icon,
  label,
  count,
  expanded,
  selected,
  color,
  badge,
  onToggle,
  onSelect,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  count?: number
  expanded?: boolean
  selected?: boolean
  color: string
  badge?: React.ReactNode
  onToggle?: () => void
  onSelect?: () => void
}) {
  return (
    <div
      className={cn(
        "group flex items-center gap-1.5 px-2 py-1.5 rounded-lg",
        "transition-all duration-150",
        onSelect ? "cursor-pointer hover:bg-muted/40" : "cursor-default",
        selected && "bg-accent/60"
      )}
      onClick={onSelect}
    >
      {onToggle ? (
        <button
          type="button"
          title={expanded ? "Collapse" : "Expand"}
          onClick={(e) => {
            e.stopPropagation()
            onToggle()
          }}
          className="shrink-0 h-4 w-4 flex items-center justify-center"
        >
          <ChevronRight
            className={cn(
              "h-3 w-3 text-muted-foreground transition-transform duration-200",
              expanded && "rotate-90"
            )}
          />
        </button>
      ) : (
        <span className="shrink-0 h-4 w-4" />
      )}
      <Icon className={cn("h-3.5 w-3.5 shrink-0", color)} />
      <span className="text-sm truncate flex-1">{label}</span>
      {badge}
      {count != null && count > 0 && (
        <span className="text-[10px] text-muted-foreground font-mono tabular-nums">
          {count}
        </span>
      )}
    </div>
  )
}
