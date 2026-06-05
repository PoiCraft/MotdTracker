import { useState, useEffect, type ReactNode } from "react"
import { Navigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/api/endpoints"
import type { AdminSettings, AdminGroup, AdminServer, AdminNode } from "@/api/types"
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
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/providers/AuthProvider"
import {
  Plus,
  Pencil,
  Trash2,
  ArrowUp,
  ArrowDown,
  Save,
  CheckCircle,
  AlertCircle,
  Lock,
  KeyRound,
} from "lucide-react"

export default function AdminPage() {
  const { t } = useTranslation()
  const { token, loading: authLoading, logout } = useAuth()
  if (authLoading) return <Skeleton className="h-96 rounded-lg" />
  if (!token) return <Navigate to="/login" replace />

  return (
    <div className="space-y-6">
      <PageHeader title={t("admin.title")} description={t("admin.description")}>
        <Button variant="outline" size="sm" onClick={logout}>
          {t("admin.logout")}
        </Button>
      </PageHeader>

      <Tabs defaultValue="settings">
        <TabsList>
          <TabsTrigger value="settings">{t("admin.settings")}</TabsTrigger>
          <TabsTrigger value="groups">{t("admin.groups")}</TabsTrigger>
          <TabsTrigger value="servers">{t("admin.servers")}</TabsTrigger>
          <TabsTrigger value="nodes">{t("admin.nodes")}</TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="mt-4">
          <SettingsTab token={token} />
        </TabsContent>
        <TabsContent value="groups" className="mt-4">
          <GroupsTab token={token} />
        </TabsContent>
        <TabsContent value="servers" className="mt-4">
          <ServersTab token={token} />
        </TabsContent>
        <TabsContent value="nodes" className="mt-4">
          <NodesTab token={token} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  )
}

function SettingsTab({ token }: { token: string }) {
  const { t } = useTranslation()
  const [syncStatus, setSyncStatus] = useState<boolean | null>(null)

  const { data: settings, isLoading } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: () => api.admin.settings(token),
  })

  const [form, setForm] = useState<Partial<AdminSettings>>({})

  useEffect(() => {
    if (settings) setForm(settings)
  }, [settings])

  const updateMutation = useMutation({
    mutationFn: async () => {
      await api.admin.updateSettings(token, form)
      await api.admin.apply(token)
      setSyncStatus(null)
      setTimeout(async () => {
        const res = await api.admin.configStatus(token)
        setSyncStatus(res.synced)
      }, 1000)
    },
  })

  if (isLoading || !settings) return <Skeleton className="h-64 rounded-lg" />

  return (
    <div className="space-y-4 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t("admin.settings")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label={t("admin.serverName")}>
            <Input
              value={form.server_name || ""}
              onChange={(e) => setForm({ ...form, server_name: e.target.value })}
            />
          </Field>
          <Field label={t("admin.pollInterval")}>
            <Input
              type="number"
              value={form.poll_interval || ""}
              onChange={(e) =>
                setForm({ ...form, poll_interval: +e.target.value })
              }
            />
          </Field>
          <Field label={t("admin.port")}>
            <Input
              type="number"
              value={form.port || ""}
              onChange={(e) => setForm({ ...form, port: +e.target.value })}
            />
          </Field>

          <Button
            size="sm"
            onClick={() => updateMutation.mutate()}
            disabled={updateMutation.isPending}
          >
            <Save className="h-3.5 w-3.5 mr-1" />
            {t("admin.applyConfig")}
          </Button>

          {syncStatus !== null && (
            <p
              className={`text-xs ${
                syncStatus ? "text-green-600" : "text-yellow-600"
              }`}
            >
              {syncStatus ? (
                <>
                  <CheckCircle className="h-3 w-3 inline mr-1" />
                  {t("admin.configSynced")}
                </>
              ) : (
                <>
                  <AlertCircle className="h-3 w-3 inline mr-1" />
                  {t("admin.configNotSynced")}
                </>
              )}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
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
                  webhook_alert: {
                    ...form.webhook_alert!,
                    enable: v,
                  },
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
                  webhook_alert: {
                    ...form.webhook_alert!,
                    method: v,
                  },
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
              value={JSON.stringify(form.webhook_alert?.headers || {}, null, 2)}
              onChange={(e) => {
                try {
                  const headers = JSON.parse(e.target.value)
                  setForm({
                    ...form,
                    webhook_alert: {
                      ...form.webhook_alert!,
                      headers,
                    },
                  })
                } catch {}
              }}
              rows={3}
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
                value={form.webhook_alert?.offline_confirm_frames || ""}
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
                value={form.webhook_alert?.online_confirm_frames || ""}
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
    } catch (e: any) {
      setError(e.message || t("admin.passwordChangeFailed"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
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
        <Button size="sm" disabled={saving} onClick={handleChange}>
          <Lock className="h-3.5 w-3.5 mr-1" />
          {t("admin.changePassword")}
        </Button>
        {message && (
          <p className="text-xs text-green-600 flex items-center gap-1">
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

function GroupsTab({ token }: { token: string }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [dialog, setDialog] = useState<{ open: boolean; edit?: AdminGroup }>({
    open: false,
  })
  const [form, setForm] = useState({ name: "" })

  const { data: groups = [] } = useQuery({
    queryKey: ["admin-groups"],
    queryFn: () => api.admin.listGroups(token),
  })

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (dialog.edit) {
        await api.admin.updateGroup(token, dialog.edit.id, { name: form.name })
      } else {
        await api.admin.createGroup(token, { name: form.name })
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-groups"] })
      queryClient.invalidateQueries({ queryKey: ["groups"] })
      setDialog({ open: false })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.admin.deleteGroup(token, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-groups"] })
      queryClient.invalidateQueries({ queryKey: ["groups"] })
    },
  })

  return (
    <div className="space-y-4 max-w-2xl">
      <Button
        size="sm"
        onClick={() => {
          setForm({ name: "" })
          setDialog({ open: true })
        }}
      >
        <Plus className="h-3.5 w-3.5 mr-1" />
        {t("admin.createGroup")}
      </Button>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("admin.groupName")}</TableHead>
            <TableHead className="text-right">{t("common.actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.map((g) => (
            <TableRow key={g.id}>
              <TableCell className="font-medium">{g.name}</TableCell>
              <TableCell className="text-right space-x-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => {
                    setForm({ name: g.name })
                    setDialog({ open: true, edit: g })
                  }}
                >
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => {
                    if (confirm(t("admin.deleteGroupConfirm"))) {
                      deleteMutation.mutate(g.id)
                    }
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog
        open={dialog.open}
        onOpenChange={(v: boolean) => setDialog({ ...dialog, open: v })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialog.edit ? t("admin.editGroup") : t("admin.createGroup")}
            </DialogTitle>
          </DialogHeader>
          <Input
            placeholder={t("admin.groupName")}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <div className="flex justify-end">
            <Button onClick={() => saveMutation.mutate()}>{t("common.save")}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ServersTab({ token }: { token: string }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [dialog, setDialog] = useState<{ open: boolean; edit?: AdminServer }>({
    open: false,
  })
  const [form, setForm] = useState({ name: "", group_id: "" })

  const { data: servers = [] } = useQuery({
    queryKey: ["admin-servers"],
    queryFn: () => api.admin.listServers(token),
  })

  const { data: groups = [] } = useQuery({
    queryKey: ["admin-groups"],
    queryFn: () => api.admin.listGroups(token),
  })

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (dialog.edit) {
        await api.admin.updateServer(token, dialog.edit.id, {
          name: form.name,
          group_id: form.group_id || undefined,
        })
      } else {
        await api.admin.createServer(token, {
          name: form.name,
          group_id: form.group_id || undefined,
        })
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-servers"] })
      queryClient.invalidateQueries({ queryKey: ["servers"] })
      setDialog({ open: false })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.admin.deleteServer(token, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-servers"] })
      queryClient.invalidateQueries({ queryKey: ["servers"] })
    },
  })

  return (
    <div className="space-y-4 max-w-2xl">
      <Button
        size="sm"
        onClick={() => {
          setForm({ name: "", group_id: "" })
          setDialog({ open: true })
        }}
      >
        <Plus className="h-3.5 w-3.5 mr-1" />
        {t("admin.createServer")}
      </Button>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("admin.serverName")}</TableHead>
            <TableHead>{t("dashboard.groups")}</TableHead>
            <TableHead className="text-right">{t("common.actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {servers.map((s) => (
            <TableRow key={s.id}>
              <TableCell className="font-medium">{s.name}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {groups.find((g) => g.id === s.group_id)?.name || "--"}
              </TableCell>
              <TableCell className="text-right space-x-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => {
                    setForm({ name: s.name, group_id: s.group_id || "" })
                    setDialog({ open: true, edit: s })
                  }}
                >
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => {
                    if (confirm(t("admin.deleteServerConfirm"))) {
                      deleteMutation.mutate(s.id)
                    }
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog
        open={dialog.open}
        onOpenChange={(v: boolean) => setDialog({ ...dialog, open: v })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialog.edit ? t("admin.editServer") : t("admin.createServer")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder={t("admin.serverName")}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <Select
              value={form.group_id}
              onValueChange={(v) => setForm({ ...form, group_id: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("common.allGroups")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">{t("common.allGroups")}</SelectItem>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => saveMutation.mutate()}>
              {t("common.save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function NodesTab({ token }: { token: string }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [dialog, setDialog] = useState<{ open: boolean; edit?: AdminNode }>({
    open: false,
  })
  const [form, setForm] = useState({
    name: "",
    host: "",
    port: 25565,
    edition: "java",
    color: "#1A73E8",
    enabled: true,
    server_id: "",
  })

  const { data: nodes = [] } = useQuery({
    queryKey: ["admin-nodes"],
    queryFn: () => api.admin.listNodes(token),
  })

  const { data: servers = [] } = useQuery({
    queryKey: ["admin-servers"],
    queryFn: () => api.admin.listServers(token),
  })

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (dialog.edit) {
        await api.admin.updateNode(token, dialog.edit.id, form)
      } else {
        await api.admin.createNode(token, form)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-nodes"] })
      queryClient.invalidateQueries({ queryKey: ["nodes"] })
      setDialog({ open: false })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.admin.deleteNode(token, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-nodes"] })
      queryClient.invalidateQueries({ queryKey: ["nodes"] })
    },
  })

  return (
    <div className="space-y-4 max-w-3xl">
      <Button
        size="sm"
        onClick={() => {
          setForm({
            name: "",
            host: "",
            port: 25565,
            edition: "java",
            color: "#1A73E8",
            enabled: true,
            server_id: "",
          })
          setDialog({ open: true })
        }}
      >
        <Plus className="h-3.5 w-3.5 mr-1" />
        {t("admin.createNode")}
      </Button>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("admin.nodeName")}</TableHead>
            <TableHead>{t("nodes.host")}</TableHead>
            <TableHead>{t("nodes.edition")}</TableHead>
            <TableHead>{t("servers.title")}</TableHead>
            <TableHead>{t("common.enabled")}</TableHead>
            <TableHead className="text-right">{t("common.actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {nodes.map((n) => (
            <TableRow key={n.id}>
              <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                  <span
                    className="h-3 w-3 rounded-full shrink-0"
                    style={{ backgroundColor: n.color }}
                  />
                  {n.name}
                </div>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {n.host}:{n.port}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="text-xs">
                  {n.edition}
                </Badge>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {servers.find((s) => s.id === n.server_id)?.name || "--"}
              </TableCell>
              <TableCell>
                <Switch
                  checked={n.enabled}
                  onCheckedChange={async (v: boolean) => {
                    await api.admin.updateNode(token, n.id, { ...n, enabled: v })
                    queryClient.invalidateQueries({ queryKey: ["admin-nodes"] })
                  }}
                />
              </TableCell>
              <TableCell className="text-right space-x-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={async () => {
                    await api.admin.moveNodeUp(token, n.id)
                    queryClient.invalidateQueries({ queryKey: ["admin-nodes"] })
                  }}
                >
                  <ArrowUp className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={async () => {
                    await api.admin.moveNodeDown(token, n.id)
                    queryClient.invalidateQueries({ queryKey: ["admin-nodes"] })
                  }}
                >
                  <ArrowDown className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => {
                    setForm({
                      name: n.name,
                      host: n.host,
                      port: n.port,
                      edition: n.edition,
                      color: n.color,
                      enabled: n.enabled,
                      server_id: n.server_id,
                    })
                    setDialog({ open: true, edit: n })
                  }}
                >
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => {
                    if (confirm(t("admin.deleteNodeConfirm"))) {
                      deleteMutation.mutate(n.id)
                    }
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog
        open={dialog.open}
        onOpenChange={(v: boolean) => setDialog({ ...dialog, open: v })}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {dialog.edit ? t("admin.editNode") : t("admin.createNode")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder={t("admin.nodeName")}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <Input
              placeholder={t("admin.nodeHost")}
              value={form.host}
              onChange={(e) => setForm({ ...form, host: e.target.value })}
            />
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder={t("admin.nodePort")}
                value={form.port}
                onChange={(e) =>
                  setForm({ ...form, port: +e.target.value })
                }
                className="w-24"
              />
              <Select
                value={form.edition}
                onValueChange={(v) => setForm({ ...form, edition: v })}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="java">Java</SelectItem>
                  <SelectItem value="bedrock">Bedrock</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="color"
                value={form.color}
                onChange={(e) =>
                  setForm({ ...form, color: e.target.value })
                }
                className="w-12 p-1"
              />
            </div>
            <Select
              value={form.server_id}
              onValueChange={(v) => setForm({ ...form, server_id: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select Server" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">-- Select Server --</SelectItem>
                {servers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.enabled}
                onCheckedChange={(v: boolean) =>
                  setForm({ ...form, enabled: v })
                }
              />
              <span className="text-sm">{t("admin.nodeEnabled")}</span>
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => saveMutation.mutate()}>
              {t("common.save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
