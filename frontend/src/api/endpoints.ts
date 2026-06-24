import type {
  AppStatus,
  GroupItem,
  GroupDetail,
  ServerItem,
  ServerDetail,
  NodeWithStats,
  StatusLog,
  PlayerListItem,
  PlayerDetail,
  PlayerSessionHistory,
  PlayerHeatmap,
  PlayerWeeklyStats,
  AdminSettings,
  AdminGroup,
  AdminServer,
  AdminNode,
} from "./types"

const BASE = ""

const AUTH_STORAGE_KEY = "motdtracker_auth"

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const { headers: customHeaders, ...rest } = options ?? {}
  const res = await fetch(`${BASE}${url}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...customHeaders,
    },
  })
  if (res.status === 204) return undefined as T
  if (res.status === 401) {
    localStorage.removeItem(AUTH_STORAGE_KEY)
    window.location.href = "/login"
    throw new Error("Session expired. Please login again.")
  }
  if (!res.ok) {
    const body = await res.text()
    throw new Error(body || `HTTP ${res.status}`)
  }
  return res.json()
}

function auth(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` }
}

export const api = {
  status: () => request<AppStatus>("/api/status"),

  groups: {
    list: () => request<GroupItem[]>("/api/groups"),
    detail: (id: string) => request<GroupDetail>(`/api/groups/${id}`),
  },

  servers: {
    list: (groupId?: string | null) => {
      const p = new URLSearchParams()
      if (groupId) p.set("group_id", groupId)
      const qs = p.toString()
      return request<ServerItem[]>(`/api/servers${qs ? `?${qs}` : ""}`)
    },
    detail: (id: string) => request<ServerDetail>(`/api/servers/${id}`),
    history: (id: string, hours = 24) =>
      request<StatusLog[]>(`/api/servers/${id}/history?hours=${hours}`),
  },

  nodes: {
    list: (groupId?: string, serverId?: string) => {
      const p = new URLSearchParams()
      if (groupId) p.set("group_id", groupId)
      if (serverId) p.set("server_id", serverId)
      const qs = p.toString()
      return request<NodeWithStats[]>(`/api/nodes${qs ? `?${qs}` : ""}`)
    },
    detail: (id: string) => request<NodeWithStats>(`/api/nodes/${id}`),
    history: (id: string, hours = 24) =>
      request<StatusLog[]>(`/api/nodes/${id}/history?hours=${hours}`),
  },

  players: {
    list: (groupId?: string | null, serverId?: string | null) => {
      const p = new URLSearchParams()
      if (groupId) p.set("group_id", groupId)
      if (serverId) p.set("server_id", serverId)
      const qs = p.toString()
      return request<PlayerListItem[]>(`/api/players${qs ? `?${qs}` : ""}`)
    },
    detail: (name: string) =>
      request<PlayerDetail>(`/api/players/${encodeURIComponent(name)}`),
    sessions: (name: string, days = 30) =>
      request<PlayerSessionHistory[]>(
        `/api/players/${encodeURIComponent(name)}/sessions?days=${days}`
      ),
    heatmap: (name: string, days = 30) =>
      request<PlayerHeatmap[]>(
        `/api/players/${encodeURIComponent(name)}/heatmap?days=${days}`
      ),
    weekly: (name: string) =>
      request<PlayerWeeklyStats>(
        `/api/players/${encodeURIComponent(name)}/weekly-stats`
      ),
  },

  admin: {
    status: () => request<{ initialized: boolean }>("/api/admin/status"),
    login: (username: string, password: string) =>
      request<{ token: string; expires_at: string }>("/api/admin/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      }),
    setup: (username: string, password: string) =>
      request<{ token: string; expires_at: string }>("/api/admin/setup", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      }),
    logout: (token: string) =>
      request("/api/admin/logout", { method: "POST", headers: auth(token) }),
    changePassword: (token: string, oldPassword: string, newPassword: string) =>
      request("/api/admin/change-password", {
        method: "POST",
        headers: auth(token),
        body: JSON.stringify({ old_password: oldPassword, new_password: newPassword }),
      }),
    settings: (token: string) =>
      request<AdminSettings>("/api/admin/settings", { headers: auth(token) }),
    updateSettings: (token: string, settings: Partial<AdminSettings>) =>
      request("/api/admin/settings", {
        method: "PUT",
        headers: auth(token),
        body: JSON.stringify(settings),
      }),
    configStatus: (token: string) =>
      request<{ synced: boolean }>("/api/admin/config-status", { headers: auth(token) }),
    apply: (token: string) =>
      request<{ status: string; message: string }>("/api/admin/apply", {
        method: "POST",
        headers: auth(token),
      }),

    // Nodes
    listNodes: (token: string) =>
      request<AdminNode[]>("/api/admin/nodes", { headers: auth(token) }),
    getNode: (token: string, id: string) =>
      request<AdminNode>(`/api/admin/nodes/${id}`, { headers: auth(token) }),
    createNode: (token: string, data: Partial<AdminNode>) =>
      request<AdminNode>("/api/admin/nodes", {
        method: "POST",
        headers: auth(token),
        body: JSON.stringify(data),
      }),
    updateNode: (token: string, id: string, data: Partial<AdminNode>) =>
      request(`/api/admin/nodes/${id}`, {
        method: "PUT",
        headers: auth(token),
        body: JSON.stringify(data),
      }),
    deleteNode: (token: string, id: string) =>
      request(`/api/admin/nodes/${id}`, {
        method: "DELETE",
        headers: auth(token),
      }),
    moveNodeUp: (token: string, id: string) =>
      request(`/api/admin/nodes/${id}/move-up`, {
        method: "POST",
        headers: auth(token),
      }),
    moveNodeDown: (token: string, id: string) =>
      request(`/api/admin/nodes/${id}/move-down`, {
        method: "POST",
        headers: auth(token),
      }),
    moveNodeServer: (token: string, id: string, serverId: string) =>
      request(`/api/admin/nodes/${id}/server`, {
        method: "PUT",
        headers: auth(token),
        body: JSON.stringify({ server_id: serverId }),
      }),

    // Groups
    listGroups: (token: string) =>
      request<AdminGroup[]>("/api/admin/groups", { headers: auth(token) }),
    getGroup: (token: string, id: string) =>
      request<AdminGroup>(`/api/admin/groups/${id}`, { headers: auth(token) }),
    createGroup: (token: string, data: { name: string; sort_order?: number }) =>
      request<AdminGroup>("/api/admin/groups", {
        method: "POST",
        headers: auth(token),
        body: JSON.stringify(data),
      }),
    updateGroup: (token: string, id: string, data: { name?: string; sort_order?: number }) =>
      request(`/api/admin/groups/${id}`, {
        method: "PUT",
        headers: auth(token),
        body: JSON.stringify(data),
      }),
    deleteGroup: (token: string, id: string) =>
      request(`/api/admin/groups/${id}`, {
        method: "DELETE",
        headers: auth(token),
      }),

    // Servers
    listServers: (token: string) =>
      request<AdminServer[]>("/api/admin/servers", { headers: auth(token) }),
    getServer: (token: string, id: string) =>
      request<AdminServer>(`/api/admin/servers/${id}`, { headers: auth(token) }),
    createServer: (token: string, data: { name: string; group_id?: string; sort_order?: number }) =>
      request<AdminServer>("/api/admin/servers", {
        method: "POST",
        headers: auth(token),
        body: JSON.stringify(data),
      }),
    updateServer: (token: string, id: string, data: { name?: string; group_id?: string; sort_order?: number }) =>
      request(`/api/admin/servers/${id}`, {
        method: "PUT",
        headers: auth(token),
        body: JSON.stringify(data),
      }),
    deleteServer: (token: string, id: string) =>
      request(`/api/admin/servers/${id}`, {
        method: "DELETE",
        headers: auth(token),
      }),
  },
}
