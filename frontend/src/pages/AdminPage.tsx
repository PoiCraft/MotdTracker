import { useState, useMemo, type ReactNode } from "react"
import { Navigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/api/endpoints"
import type {
  AdminSettings,
  AdminGroup,
  AdminServer,
  AdminNode,
} from "@/api/types"
import { PageHeader } from "@/components/shared/PageHeader"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/providers/AuthProvider"
import { cn } from "@/lib/utils"
import {
  Plus,
  Trash2,
  Save,
  CheckCircle,
  AlertCircle,
  Lock,
  KeyRound,
  ChevronRight,
  Folder,
  Server,
  Network,
  Settings,
  X,
} from "lucide-react"

type EntityType = "group" | "server" | "node"
interface SelectedItem {
  type: EntityType
  id: string
}

export default function AdminPage() {
  const { t } = useTranslation()
  const { token, loading: authLoading, logout } = useAuth()
  const queryClient = useQueryClient()

  const { data: configStatus } = useQuery({
    queryKey: ["admin-config-status"],
    queryFn: () => api.admin.configStatus(token!),
    enabled: !authLoading && !!token,
    refetchInterval: 30000,
  })

  const isSynced = configStatus?.synced ?? true

  const applyMutation = useMutation({
    mutationFn: async () => {
      await api.admin.apply(token!)
      await new Promise((r) => setTimeout(r, 1000))
      queryClient.invalidateQueries({ queryKey: ["admin-config-status"] })
    },
  })

  if (authLoading) return <Skeleton className="h-96 rounded-xl" />
  if (!token) return <Navigate to="/login" replace />

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("admin.title")}
        description={t("admin.description")}
      >
        <Button
          variant="outline"
          size="sm"
          onClick={logout}
          className="transition-all duration-300"
        >
          {t("admin.logout")}
        </Button>
      </PageHeader>

      <Tabs defaultValue="config">
        <div className="flex items-center gap-3">
          <TabsList>
            <TabsTrigger value="config">
              <Settings className="h-3.5 w-3.5 mr-1.5" />
              {t("admin.config")}
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="h-3.5 w-3.5 mr-1.5" />
              {t("admin.settings")}
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2 ml-auto">
            {!isSynced && (
              <span className="text-xs text-amber-500 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {t("admin.configNotSynced")}
              </span>
            )}
            <Button
              size="sm"
              variant={!isSynced ? "default" : "outline"}
              onClick={() => applyMutation.mutate()}
              disabled={applyMutation.isPending}
              className={cn(
                "transition-all duration-300",
                !isSynced && "animate-pulse"
              )}
            >
              {applyMutation.isPending ? (
                <span className="h-3.5 w-3.5 mr-1 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <Save className="h-3.5 w-3.5 mr-1" />
              )}
              {t("admin.applyConfig")}
            </Button>
          </div>
        </div>

        <TabsContent value="config" className="mt-4">
          <ConfigTab token={token} />
        </TabsContent>
        <TabsContent value="settings" className="mt-4">
          <SettingsTab token={token} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

const glassCard = cn(
  "bg-card/60 backdrop-blur-md border border-border/80 shadow-sm",
  "dark:bg-card/60"
)

function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] uppercase tracking-wider text-muted-foreground/80">
        {label}
      </label>
      {children}
    </div>
  )
}

// ─── Config Tab (3-level nested tree) ────────────────────────────────────────

function ConfigTab({ token }: { token: string }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const { data: groups = [] } = useQuery({
    queryKey: ["admin-groups"],
    queryFn: () => api.admin.listGroups(token),
  })
  const { data: servers = [] } = useQuery({
    queryKey: ["admin-servers"],
    queryFn: () => api.admin.listServers(token),
  })
  const { data: nodes = [] } = useQuery({
    queryKey: ["admin-nodes"],
    queryFn: () => api.admin.listNodes(token),
  })

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    () => (groups.length === 1 && !selected ? new Set([groups[0].id]) : new Set())
  )
  const [expandedServers, setExpandedServers] = useState<Set<string>>(
    new Set()
  )
  const [selected, setSelected] = useState<SelectedItem | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)

  const serversByGroup = useMemo(() => {
    const map = new Map<string, AdminServer[]>()
    for (const s of servers) {
      const gid = s.group_id || "__ungrouped"
      if (!map.has(gid)) map.set(gid, [])
      map.get(gid)!.push(s)
    }
    return map
  }, [servers])

  const nodesByServer = useMemo(() => {
    const map = new Map<string, AdminNode[]>()
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

  function handleSaved(entityType: EntityType, newId?: string) {
    if (newId) {
      setSelected({ type: entityType, id: newId })
      if (entityType === "server") {
        const srv = servers.find((s) => s.id === newId)
        if (srv?.group_id) setExpandedGroups((p) => new Set(p).add(srv.group_id!))
      }
      if (entityType === "node") {
        const nd = nodes.find((n) => n.id === newId)
        if (nd?.server_id) setExpandedServers((p) => new Set(p).add(nd.server_id))
      }
    }
  }

  const moveServerMut = useMutation({
    mutationFn: ({ serverId, groupId }: { serverId: string; groupId: string }) =>
      api.admin.updateServer(token, serverId, { group_id: groupId || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-servers"] })
      queryClient.invalidateQueries({ queryKey: ["servers"] })
      queryClient.invalidateQueries({ queryKey: ["admin-config-status"] })
    },
  })

  const moveNodeToServerMut = useMutation({
    mutationFn: ({ nodeId, serverId }: { nodeId: string; serverId: string }) =>
      api.admin.moveNodeServer(token, nodeId, serverId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-nodes"] })
      queryClient.invalidateQueries({ queryKey: ["nodes"] })
      queryClient.invalidateQueries({ queryKey: ["admin-config-status"] })
    },
  })

  const deleteGroupMut = useMutation({
    mutationFn: (id: string) => api.admin.deleteGroup(token, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-groups"] })
      queryClient.invalidateQueries({ queryKey: ["groups"] })
      queryClient.invalidateQueries({ queryKey: ["admin-config-status"] })
      if (selected?.type === "group") setSelected(null)
    },
  })

  const deleteServerMut = useMutation({
    mutationFn: (id: string) => api.admin.deleteServer(token, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-servers"] })
      queryClient.invalidateQueries({ queryKey: ["servers"] })
      queryClient.invalidateQueries({ queryKey: ["admin-config-status"] })
      if (selected?.type === "server") setSelected(null)
    },
  })

  const deleteNodeMut = useMutation({
    mutationFn: (id: string) => api.admin.deleteNode(token, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-nodes"] })
      queryClient.invalidateQueries({ queryKey: ["nodes"] })
      queryClient.invalidateQueries({ queryKey: ["admin-config-status"] })
      if (selected?.type === "node") setSelected(null)
    },
  })

  const ungroupedServers = serversByGroup.get("__ungrouped") || []

  function handleDragStart(e: React.DragEvent, type: EntityType, id: string) {
    e.dataTransfer.setData("text/plain", `${type}:${id}`)
    e.dataTransfer.effectAllowed = "move"
  }

  function handleDrop(e: React.DragEvent, targetType: EntityType, targetId: string) {
    e.preventDefault()
    setDragOver(null)
    const raw = e.dataTransfer.getData("text/plain")
    if (!raw) return
    const [srcType, srcId] = raw.split(":")

    if (srcType === "server" && targetType === "group") {
      if (srcId !== targetId) moveServerMut.mutate({ serverId: srcId, groupId: targetId })
    } else if (srcType === "node" && targetType === "server") {
      if (srcId !== targetId) moveNodeToServerMut.mutate({ nodeId: srcId, serverId: targetId })
    }
  }

  function handleDragOver(e: React.DragEvent, id: string) {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    setDragOver(id)
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
      <div
        className={cn(
          "rounded-xl overflow-hidden",
          glassCard,
          "max-h-[calc(100vh-220px)] flex flex-col"
        )}
      >
        <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between">
          <h3 className="text-sm font-semibold">
            {t("admin.structure")}
          </h3>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => {
              setSelected({ type: "group", id: "__new__" })
            }}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {groups.map((g) => {
            const groupServers = serversByGroup.get(g.id) || []
            const isGroupExpanded = expandedGroups.has(g.id)
            const isGroupSelected =
              selected?.type === "group" && selected.id === g.id

            return (
              <div key={g.id}>
                <TreeNode
                  icon={Folder}
                  label={g.name}
                  count={groupServers.length}
                  expanded={isGroupExpanded}
                  selected={isGroupSelected}
                  color="text-amber-500"

                  dragOver={dragOver === g.id}
                  onToggle={() => toggleGroup(g.id)}
                  onSelect={() =>
                    setSelected({ type: "group", id: g.id })
                  }
                  onAdd={() => {
                    setSelected({ type: "server", id: "__new__" })
                    setExpandedGroups((prev) => new Set(prev).add(g.id))
                  }}
                  onDelete={() => {
                    if (confirm(t("admin.deleteGroupConfirm")))
                      deleteGroupMut.mutate(g.id)
                  }}
                  onDragOver={(e) => handleDragOver(e, g.id)}
                  onDragLeave={() => setDragOver(null)}
                  onDrop={(e) => handleDrop(e, "group", g.id)}
                  t={t}
                />
                {isGroupExpanded &&
                  groupServers.map((s) => {
                    const serverNodes = nodesByServer.get(s.id) || []
                    const isServerExpanded = expandedServers.has(s.id)
                    const isServerSelected =
                      selected?.type === "server" && selected.id === s.id

                    return (
                      <div key={s.id} className="ml-4">
                        <TreeNode
                          icon={Server}
                          label={s.name}
                          count={serverNodes.length}
                          expanded={isServerExpanded}
                          selected={isServerSelected}
                          color="text-sky-500"
                          draggable
        
                          dragOver={dragOver === s.id}
                          onDragStart={(e) => handleDragStart(e, "server", s.id)}
                          onToggle={() => toggleServer(s.id)}
                          onSelect={() =>
                            setSelected({ type: "server", id: s.id })
                          }
                          onAdd={() => {
                            setSelected({ type: "node", id: "__new__" })
                            setExpandedServers((prev) =>
                              new Set(prev).add(s.id)
                            )
                          }}
                          onDelete={() => {
                            if (confirm(t("admin.deleteServerConfirm")))
                              deleteServerMut.mutate(s.id)
                          }}
                          onDragOver={(e) => handleDragOver(e, s.id)}
                          onDragLeave={() => setDragOver(null)}
                          onDrop={(e) => handleDrop(e, "server", s.id)}
                          t={t}
                        />
                        {isServerExpanded &&
                          serverNodes.map((n) => {
                            const isNodeSelected =
                              selected?.type === "node" &&
                              selected.id === n.id
                            return (
                              <div key={n.id} className="ml-4">
                                <TreeNode
                                  icon={Network}
                                  label={n.name}
                                  selected={isNodeSelected}
                                  color="text-emerald-500"
                                  draggable
                                  onDragStart={(e) => handleDragStart(e, "node", n.id)}
                                  onSelect={() =>
                                    setSelected({
                                      type: "node",
                                      id: n.id,
                                    })
                                  }
                                  onDelete={() => {
                                    if (
                                      confirm(t("admin.deleteNodeConfirm"))
                                    )
                                      deleteNodeMut.mutate(n.id)
                                  }}
                                  badge={
                                    !n.enabled ? (
                                      <Badge
                                        variant="outline"
                                        className="text-[9px] px-1 py-0 bg-muted/30 text-muted-foreground border-border/40"
                                      >
                                        OFF
                                      </Badge>
                                    ) : undefined
                                  }
                                  t={t}
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
                    <TreeNode
                      icon={Server}
                      label={s.name}
                      count={serverNodes.length}
                      expanded={isServerExpanded}
                      selected={isServerSelected}
                      color="text-sky-500"
                      draggable
    
                      dragOver={dragOver === s.id}
                      onDragStart={(e) => handleDragStart(e, "server", s.id)}
                      onToggle={() => toggleServer(s.id)}
                      onSelect={() =>
                        setSelected({ type: "server", id: s.id })
                      }
                      onAdd={() => {
                        setSelected({ type: "node", id: "__new__" })
                        setExpandedServers((prev) =>
                          new Set(prev).add(s.id)
                        )
                      }}
                      onDelete={() => {
                        if (confirm(t("admin.deleteServerConfirm")))
                          deleteServerMut.mutate(s.id)
                      }}
                      onDragOver={(e) => handleDragOver(e, s.id)}
                      onDragLeave={() => setDragOver(null)}
                      onDrop={(e) => handleDrop(e, "server", s.id)}
                      t={t}
                    />
                    {isServerExpanded &&
                      serverNodes.map((n) => {
                        const isNodeSelected =
                          selected?.type === "node" &&
                          selected.id === n.id
                        return (
                          <div key={n.id} className="ml-4">
                            <TreeNode
                              icon={Network}
                              label={n.name}
                              selected={isNodeSelected}
                              color="text-emerald-500"
                              draggable
                              onDragStart={(e) => handleDragStart(e, "node", n.id)}
                              onSelect={() =>
                                setSelected({
                                  type: "node",
                                  id: n.id,
                                })
                              }
                              onDelete={() => {
                                if (
                                  confirm(t("admin.deleteNodeConfirm"))
                                )
                                  deleteNodeMut.mutate(n.id)
                              }}
                              t={t}
                            />
                          </div>
                        )
                      })}
                  </div>
                )
              })}
            </div>
          )}

          {groups.length === 0 && servers.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <Folder className="h-8 w-8 mb-2 opacity-40" />
              <p className="text-xs">{t("admin.noConfig")}</p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 text-xs"
                onClick={() =>
                  setSelected({ type: "group", id: "__new__" })
                }
              >
                <Plus className="h-3 w-3 mr-1" />
                {t("admin.createGroup")}
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="min-h-[400px]">
        {selected ? (
          <DetailPanel
            token={token}
            selected={selected}
            groups={groups}
            servers={servers}
            onSaved={(newId) => handleSaved(selected.type, newId)}
          />
        ) : (
          <div
            className={cn(
              "rounded-xl h-full flex flex-col items-center justify-center text-center",
              glassCard,
              "min-h-[400px]"
            )}
          >
            <Settings className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">
              {t("admin.selectItem")}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Tree Node ──────────────────────────────────────────────────────────────

function TreeNode({
  icon: Icon,
  label,
  count,
  expanded,
  selected,
  color,
  badge,
  draggable,
  dragOver,
  onToggle,
  onSelect,
  onAdd,
  onDelete,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  t,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  count?: number
  expanded?: boolean
  selected?: boolean
  color: string
  badge?: ReactNode
  draggable?: boolean
  dragOver?: boolean
  onToggle?: () => void
  onSelect: () => void
  onAdd?: () => void
  onDelete: () => void
  onDragStart?: (e: React.DragEvent) => void
  onDragOver?: (e: React.DragEvent) => void
  onDragLeave?: () => void
  onDrop?: (e: React.DragEvent) => void
  t: (key: string) => string
}) {
  return (
    <div
      className={cn(
        "group flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer",
        "transition-all duration-150",
        selected ? "bg-accent/60" : "hover:bg-muted/40",
        dragOver && "ring-1 ring-primary/50 bg-primary/10",
        draggable && "cursor-grab active:cursor-grabbing"
      )}
      onClick={onSelect}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {onToggle ? (
        <button
          type="button"
          title={expanded ? t("common.collapse") : t("common.expand")}
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
      <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center gap-0.5 shrink-0">
        {onAdd && (
          <button
            type="button"
            title={t("common.add")}
            onClick={(e) => {
              e.stopPropagation()
              onAdd()
            }}
            className="h-5 w-5 rounded flex items-center justify-center hover:bg-muted/60"
          >
            <Plus className="h-3 w-3 text-muted-foreground" />
          </button>
        )}
        <button
          type="button"
          title={t("common.delete")}
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          className="h-5 w-5 rounded flex items-center justify-center hover:bg-destructive/10"
        >
          <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
        </button>
      </div>
    </div>
  )
}

// ─── Detail Panel ───────────────────────────────────────────────────────────

function DetailPanel({
  token,
  selected,
  groups,
  servers,
  onSaved,
}: {
  token: string
  selected: SelectedItem
  groups: AdminGroup[]
  servers: AdminServer[]
  onSaved: (newId?: string) => void
}) {
  if (selected.type === "group") {
    return (
      <GroupForm
        token={token}
        groupId={selected.id}
        onSaved={onSaved}
      />
    )
  }
  if (selected.type === "server") {
    return (
      <ServerForm
        token={token}
        serverId={selected.id}
        groups={groups}
        onSaved={onSaved}
      />
    )
  }
  return (
    <NodeForm
      token={token}
      nodeId={selected.id}
      servers={servers}
      onSaved={onSaved}
    />
  )
}

// ─── Group Form ─────────────────────────────────────────────────────────────

function GroupForm({
  token,
  groupId,
  onSaved,
}: {
  token: string
  groupId: string
  onSaved: (newId?: string) => void
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const isNew = groupId === "__new__"

  const { data: existing } = useQuery({
    queryKey: ["admin-group", groupId],
    queryFn: () => api.admin.getGroup(token, groupId),
    enabled: !isNew,
  })

  const [name, setName] = useState(() => existing?.name ?? "")

  const saveMut = useMutation({
    mutationFn: async () => {
      if (isNew) {
        return await api.admin.createGroup(token, { name })
      } else {
        await api.admin.updateGroup(token, groupId, { name })
        return undefined
      }
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["admin-groups"] })
      queryClient.invalidateQueries({ queryKey: ["groups"] })
      queryClient.invalidateQueries({ queryKey: ["admin-config-status"] })
      onSaved(created?.id)
    },
  })

  return (
    <div className={cn("rounded-xl", glassCard)}>
      <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Folder className="h-4 w-4 text-amber-500" />
          <h3 className="text-sm font-semibold">
            {isNew ? t("admin.createGroup") : t("admin.editGroup")}
          </h3>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => onSaved()}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="p-4 space-y-4 max-w-md">
        <Field label={t("admin.groupName")}>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("admin.groupName")}
            autoFocus
          />
        </Field>
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => saveMut.mutate()}
            disabled={saveMut.isPending || !name.trim()}
            className="transition-all duration-300"
          >
            <Save className="h-3.5 w-3.5 mr-1" />
            {t("common.save")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSaved()}
            className="transition-all duration-300"
          >
            {t("common.cancel")}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Server Form ────────────────────────────────────────────────────────────

function ServerForm({
  token,
  serverId,
  groups,
  onSaved,
}: {
  token: string
  serverId: string
  groups: AdminGroup[]
  onSaved: (newId?: string) => void
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const isNew = serverId === "__new__"

  const { data: existing } = useQuery({
    queryKey: ["admin-server", serverId],
    queryFn: () => api.admin.getServer(token, serverId),
    enabled: !isNew,
  })

  const [name, setName] = useState(() => existing?.name ?? "")
  const [groupId, setGroupId] = useState(() => existing?.group_id ?? "")

  const saveMut = useMutation({
    mutationFn: async () => {
      if (isNew) {
        return await api.admin.createServer(token, {
          name,
          group_id: groupId || undefined,
        })
      } else {
        await api.admin.updateServer(token, serverId, {
          name,
          group_id: groupId || undefined,
        })
        return undefined
      }
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["admin-servers"] })
      queryClient.invalidateQueries({ queryKey: ["servers"] })
      queryClient.invalidateQueries({ queryKey: ["admin-config-status"] })
      onSaved(created?.id)
    },
  })

  return (
    <div className={cn("rounded-xl", glassCard)}>
      <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Server className="h-4 w-4 text-sky-500" />
          <h3 className="text-sm font-semibold">
            {isNew ? t("admin.createServer") : t("admin.editServer")}
          </h3>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => onSaved()}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="p-4 space-y-4 max-w-md">
        <Field label={t("admin.serverName")}>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("admin.serverName")}
            autoFocus
          />
        </Field>
        <Field label={t("dashboard.groups")}>
          <Select value={groupId || "__none__"} onValueChange={(v) => setGroupId(v === "__none__" ? "" : v)}>
            <SelectTrigger>
              <SelectValue placeholder={t("common.allGroups")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">{t("admin.ungrouped")}</SelectItem>
              {groups.map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => saveMut.mutate()}
            disabled={saveMut.isPending || !name.trim()}
            className="transition-all duration-300"
          >
            <Save className="h-3.5 w-3.5 mr-1" />
            {t("common.save")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSaved()}
            className="transition-all duration-300"
          >
            {t("common.cancel")}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Node Form ──────────────────────────────────────────────────────────────

function NodeForm({
  token,
  nodeId,
  servers,
  onSaved,
}: {
  token: string
  nodeId: string
  servers: AdminServer[]
  onSaved: (newId?: string) => void
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const isNew = nodeId === "__new__"

  const { data: existing } = useQuery({
    queryKey: ["admin-node", nodeId],
    queryFn: () => api.admin.getNode(token, nodeId),
    enabled: !isNew,
  })

  const [form, setForm] = useState(() =>
    existing
      ? {
          name: existing.name,
          host: existing.host,
          port: existing.port,
          edition: existing.edition,
          color: existing.color,
          enabled: existing.enabled,
          server_id: existing.server_id,
        }
      : {
          name: "",
          host: "",
          port: 25565,
          edition: "java",
          color: "#1A73E8",
          enabled: true,
          server_id: "",
        }
  )

  const saveMut = useMutation({
    mutationFn: async () => {
      if (isNew) {
        return await api.admin.createNode(token, form)
      } else {
        await api.admin.updateNode(token, nodeId, form)
        return undefined
      }
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["admin-nodes"] })
      queryClient.invalidateQueries({ queryKey: ["nodes"] })
      queryClient.invalidateQueries({ queryKey: ["admin-config-status"] })
      onSaved(created?.id)
    },
  })

  const moveMut = useMutation({
    mutationFn: (direction: "up" | "down") =>
      direction === "up"
        ? api.admin.moveNodeUp(token, nodeId)
        : api.admin.moveNodeDown(token, nodeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-nodes"] })
      queryClient.invalidateQueries({ queryKey: ["admin-config-status"] })
    },
  })

  return (
    <div className={cn("rounded-xl", glassCard)}>
      <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Network className="h-4 w-4 text-emerald-500" />
          <h3 className="text-sm font-semibold">
            {isNew ? t("admin.createNode") : t("admin.editNode")}
          </h3>
        </div>
        <div className="flex items-center gap-1">
          {!isNew && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => moveMut.mutate("up")}
              >
                <ChevronRight className="h-3.5 w-3.5 -rotate-90" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => moveMut.mutate("down")}
              >
                <ChevronRight className="h-3.5 w-3.5 rotate-90" />
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onSaved()}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="p-4 space-y-4 max-w-lg">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label={t("admin.nodeName")}>
            <Input
              value={form.name}
              onChange={(e) =>
                setForm({ ...form, name: e.target.value })
              }
              placeholder={t("admin.nodeName")}
              autoFocus
            />
          </Field>
          <Field label={t("admin.nodeHost")}>
            <Input
              value={form.host}
              onChange={(e) =>
                setForm({ ...form, host: e.target.value })
              }
              placeholder="play.example.com"
            />
          </Field>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Field label={t("admin.nodePort")}>
            <Input
              type="number"
              value={form.port}
              onChange={(e) =>
                setForm({ ...form, port: +e.target.value })
              }
            />
          </Field>
          <Field label={t("nodes.edition")}>
            <Select
              value={form.edition}
              onValueChange={(v) =>
                setForm({ ...form, edition: v })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="java">Java</SelectItem>
                <SelectItem value="bedrock">Bedrock</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label={t("admin.nodeColor")}>
            <div className="flex items-center gap-2">
              <Input
                type="color"
                value={form.color}
                onChange={(e) =>
                  setForm({ ...form, color: e.target.value })
                }
                className="w-10 h-9 p-1 cursor-pointer"
              />
              <span className="text-xs text-muted-foreground font-mono">
                {form.color}
              </span>
            </div>
          </Field>
        </div>

        <Field label={t("servers.title")}>
          <Select
            value={form.server_id}
            onValueChange={(v) =>
              setForm({ ...form, server_id: v })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder={t("admin.selectServer")} />
            </SelectTrigger>
            <SelectContent>
              {servers.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <div className="flex items-center gap-3">
          <Switch
            checked={form.enabled}
            onCheckedChange={(v: boolean) =>
              setForm({ ...form, enabled: v })
            }
          />
          <span className="text-sm">{t("admin.nodeEnabled")}</span>
        </div>

        <div className="flex gap-2 pt-2">
          <Button
            size="sm"
            onClick={() => saveMut.mutate()}
            disabled={
              saveMut.isPending || !form.name.trim() || !form.host.trim()
            }
            className="transition-all duration-300"
          >
            <Save className="h-3.5 w-3.5 mr-1" />
            {t("common.save")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSaved()}
            className="transition-all duration-300"
          >
            {t("common.cancel")}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Settings Tab ───────────────────────────────────────────────────────────

function SettingsTab({ token }: { token: string }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const { data: settings, isLoading } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: () => api.admin.settings(token),
  })

  const [form, setForm] = useState<Partial<AdminSettings>>(() => settings ?? {})
  const [saved, setSaved] = useState(false)

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (form.poll_interval != null && form.poll_interval < 1) {
        throw new Error(t("admin.pollIntervalTooSmall"))
      }
      if (form.port != null && (form.port < 1 || form.port > 65535)) {
        throw new Error(t("admin.portOutOfRange"))
      }
      if (form.webhook_alert?.enable && form.webhook_alert.url) {
        try {
          new URL(form.webhook_alert.url)
        } catch {
          throw new Error(t("admin.invalidWebhookUrl"))
        }
      }
      await api.admin.updateSettings(token, form)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-settings"] })
      queryClient.invalidateQueries({ queryKey: ["admin-config-status"] })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    },
  })

  if (isLoading || !settings)
    return <Skeleton className="h-64 rounded-xl" />

  return (
    <div className="space-y-4 max-w-2xl">
      <Card className={glassCard}>
        <CardHeader>
          <CardTitle className="text-sm">{t("admin.settings")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label={t("admin.serverName")}>
            <Input
              value={form.server_name || ""}
              onChange={(e) =>
                setForm({ ...form, server_name: e.target.value })
              }
            />
          </Field>
          <Field label={t("admin.pollInterval")}>
            <Input
              type="number"
              min={1}
              value={form.poll_interval || ""}
              onChange={(e) =>
                setForm({ ...form, poll_interval: +e.target.value })
              }
            />
          </Field>
          <Field label={t("admin.port")}>
            <Input
              type="number"
              min={1}
              max={65535}
              value={form.port || ""}
              onChange={(e) =>
                setForm({ ...form, port: +e.target.value })
              }
            />
          </Field>

          <div className="flex items-center gap-2 pt-2">
            <Button
              size="sm"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="transition-all duration-300"
            >
              {saveMutation.isPending ? (
                <span className="h-3.5 w-3.5 mr-1 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <Save className="h-3.5 w-3.5 mr-1" />
              )}
              {t("common.save")}
            </Button>
            {saved && (
              <span className="text-xs text-emerald-500 flex items-center gap-1">
                <CheckCircle className="h-3 w-3" />
                {t("admin.configApplied")}
              </span>
            )}
            {saveMutation.isError && (
              <span className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {saveMutation.error instanceof Error ? saveMutation.error.message : String(saveMutation.error)}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className={glassCard}>
        <CardHeader>
          <CardTitle className="text-sm">{t("admin.webhook")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm">{t("admin.webhookEnable")}</span>
            <Switch
              checked={form.webhook_alert?.enable}
              onCheckedChange={(v: boolean) =>
                setForm({
                  ...form,
                  webhook_alert: { ...form.webhook_alert!, enable: v },
                })
              }
            />
          </div>
          <Field label={t("admin.webhookUrl")}>
            <Input
              value={form.webhook_alert?.url || ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  webhook_alert: {
                    ...form.webhook_alert!,
                    url: e.target.value,
                  },
                })
              }
            />
          </Field>
          <Field label={t("admin.webhookMethod")}>
            <Select
              value={form.webhook_alert?.method || "POST"}
              onValueChange={(v) =>
                setForm({
                  ...form,
                  webhook_alert: { ...form.webhook_alert!, method: v },
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["GET", "POST", "PUT", "PATCH"].map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t("admin.webhookHeaders")}>
            <Textarea
              value={JSON.stringify(
                form.webhook_alert?.headers || {},
                null,
                2
              )}
              onChange={(e) => {
                try {
                  const headers = JSON.parse(e.target.value)
                  setForm({
                    ...form,
                    webhook_alert: { ...form.webhook_alert!, headers },
                  })
                } catch {
                  // invalid JSON — ignore
                }
              }}
              rows={3}
              className="font-mono text-xs"
            />
          </Field>
          <Field label={t("admin.webhookBody")}>
            <Textarea
              value={form.webhook_alert?.body || ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  webhook_alert: {
                    ...form.webhook_alert!,
                    body: e.target.value,
                  },
                })
              }
              rows={3}
            />
          </Field>
          <div className="grid grid-cols-3 gap-4">
            <Field label={t("admin.webhookDeltaMinutes")}>
              <Input
                type="number"
                value={form.webhook_alert?.delta_minutes || ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    webhook_alert: {
                      ...form.webhook_alert!,
                      delta_minutes: +e.target.value,
                    },
                  })
                }
              />
            </Field>
            <Field label={t("admin.webhookOfflineFrames")}>
              <Input
                type="number"
                value={
                  form.webhook_alert?.offline_confirm_frames || ""
                }
                onChange={(e) =>
                  setForm({
                    ...form,
                    webhook_alert: {
                      ...form.webhook_alert!,
                      offline_confirm_frames: +e.target.value,
                    },
                  })
                }
              />
            </Field>
            <Field label={t("admin.webhookOnlineFrames")}>
              <Input
                type="number"
                value={
                  form.webhook_alert?.online_confirm_frames || ""
                }
                onChange={(e) =>
                  setForm({
                    ...form,
                    webhook_alert: {
                      ...form.webhook_alert!,
                      online_confirm_frames: +e.target.value,
                    },
                  })
                }
              />
            </Field>
          </div>
          <div className="flex items-center gap-2 pt-2">
            <Button
              size="sm"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="transition-all duration-300"
            >
              {saveMutation.isPending ? (
                <span className="h-3.5 w-3.5 mr-1 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <Save className="h-3.5 w-3.5 mr-1" />
              )}
              {t("common.save")}
            </Button>
            {saved && (
              <span className="text-xs text-emerald-500 flex items-center gap-1">
                <CheckCircle className="h-3 w-3" />
                {t("admin.configApplied")}
              </span>
            )}
            {saveMutation.isError && (
              <span className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {saveMutation.error instanceof Error ? saveMutation.error.message : String(saveMutation.error)}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <ChangePasswordCard token={token} />
    </div>
  )
}

function ChangePasswordCard({ token }: { token: string }) {
  const { t } = useTranslation()
  const [oldPassword, setOldPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleChange() {
    setMessage(null)
    setError(null)
    if (!oldPassword || !newPassword || !confirmPassword) {
      setError(t("admin.passwordFieldsRequired"))
      return
    }
    if (newPassword !== confirmPassword) {
      setError(t("admin.passwordsNotMatch"))
      return
    }
    if (newPassword.length < 6) {
      setError(t("admin.passwordTooShort"))
      return
    }
    setSaving(true)
    try {
      await api.admin.changePassword(token, oldPassword, newPassword)
      setMessage(t("admin.passwordChanged"))
      setOldPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : t("admin.passwordChangeFailed")
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className={glassCard}>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <KeyRound className="h-4 w-4" />
          {t("admin.changePassword")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Field label={t("admin.oldPassword")}>
          <Input
            type="password"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
          />
        </Field>
        <Field label={t("admin.newPassword")}>
          <Input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </Field>
        <Field label={t("admin.confirmPassword")}>
          <Input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </Field>
        <Button
          size="sm"
          disabled={saving}
          onClick={handleChange}
          className="transition-all duration-300"
        >
          <Lock className="h-3.5 w-3.5 mr-1" />
          {t("admin.changePassword")}
        </Button>
        {message && (
          <p className="text-xs text-emerald-500 flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />
            {message}
          </p>
        )}
        {error && (
          <p className="text-xs text-destructive flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
