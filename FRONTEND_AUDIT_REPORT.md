# MotdTracker 前端代码审计报告

**审计日期**: 2025年6月5日  
**审计范围**: `frontend/src/` 下所有源代码  
**技术栈**: React 19 + TypeScript + Vite + Tailwind CSS v4 + TanStack Query + React Router v7 + i18next

---

## 执行摘要

本次审计共发现 **32 个问题**，按严重程度分类：

| 严重程度 | 数量 | 说明 |
|---------|------|------|
| 🔴 P0 - 严重 | 6 | 业务逻辑缺陷，可能导致数据错误或功能失效 |
| 🟠 P1 - 重要 | 10 | UI/交互问题，影响用户体验 |
| 🟡 P2 - 中等 | 11 | 性能与代码质量问题 |
| 🔵 P3 - 建议 | 5 | 可维护性和最佳实践建议 |

**最高优先级问题**: 虚假数据渲染 —— 监控页面和服务器卡片使用 `Math.random()` 生成完全虚假的历史趋势数据，严重误导用户。

---

## 🔴 P0 - 严重问题（立即修复）

### P0-1: 虚假历史趋势数据渲染

**文件位置**:
- `src/components/shared/ServerCard.tsx:13-39`
- `src/pages/MonitorPage.tsx:17-39`

**问题描述**:
`ServerCard` 和 `MonitorPage` 使用 `Math.random()` 生成虚假的历史趋势数据：

```typescript
// ServerCard.tsx
function generateMockTrend(current: number, points: number = 12): number[] {
  const data: number[] = []
  let v = current * 0.7
  for (let i = 0; i < points - 1; i++) {
    v += (Math.random() - 0.45) * current * 0.15  // ← 完全随机
    v = Math.max(0, v)
    data.push(Math.round(v))
  }
  data.push(current)
  return data
}
```

**影响**:
- 用户看到的 Sparkline 趋势图是**完全虚假的**，不代表真实历史
- 监控系统的核心数据可视化功能失去意义
- 用户基于虚假数据做出运维决策

**修复建议**:
1. 从后端获取真实的历史数据（已有 `/api/servers/:id/history` 和 `/api/nodes/:id/history` 接口）
2. 在 `ServerItem` 类型中添加可选的 `history` 字段，或在组件中单独请求
3. 删除所有 `generateMock*` 函数

```typescript
// 修复后的 ServerCard.tsx（示例）
interface ServerCardProps {
  server: ServerItem
  history?: StatusLog[]  // 真实历史数据
}

// 使用真实数据替代 Math.random()
const playerTrend = history?.map(h => h.players_online) ?? []
```

**优先级**: ⭐⭐⭐⭐⭐ 最高

---

### P0-2: API 错误状态完全缺失

**文件位置**:
- `src/pages/DashboardPage.tsx:59-67` —— 无 error 处理
- `src/pages/ServersPage.tsx:17-25` —— 无 error 处理
- `src/pages/NodesPage.tsx:17-20` —— 无 error 处理
- `src/pages/PlayersPage.tsx:17-20` —— 无 error 处理
- `src/pages/MonitorPage.tsx:45-48` —— 无 error 处理
- `src/pages/BadgesPage.tsx:67-82` —— 无 error 处理

**问题描述**:
所有主要数据页面只解构了 `{ data, isLoading }`，完全忽略了 `error` 状态：

```typescript
// DashboardPage.tsx（问题代码）
const { data: groups = [], isLoading: groupsLoading } = useQuery({
  queryKey: ["groups"],
  queryFn: api.groups.list,
})
// ❌ 没有处理 error
```

**影响**:
- API 请求失败时（网络错误、服务器 500、401 未授权），页面不会显示错误信息
- 用户看到空白页面或永远停留在加载状态
- 无法区分"无数据"和"加载失败"

**修复建议**:
为每个 `useQuery` 添加 error 处理，并在 UI 中显示错误状态：

```typescript
const { data: groups = [], isLoading, error } = useQuery({
  queryKey: ["groups"],
  queryFn: api.groups.list,
})

// 在 JSX 中
if (error) {
  return <ErrorState message={t("dashboard.loadingFailed")} onRetry={() => refetch()} />
}
```

---

### P0-3: Token 过期无检测与自动刷新

**文件位置**:
- `src/providers/AuthProvider.tsx:18-77`
- `src/api/endpoints.ts:22-36`

**问题描述**:
1. `AuthProvider` 只检查 token 是否存在（`!!token`），不检查是否过期
2. `request` 函数没有统一处理 401 响应
3. 没有 token 刷新机制

```typescript
// AuthProvider.tsx（问题代码）
const [token, setToken] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY))
const isAuthenticated = !!token  // ❌ 不检查过期时间
```

**影响**:
- token 过期后用户仍能进入管理页面（因为 `isAuthenticated` 仍为 true）
- 所有受保护的 API 请求都会失败，但用户看到的是空白/错误页面
- 用户体验极差，需要手动登出再登录

**修复建议**:
1. 解析 JWT payload 检查 `exp` 字段
2. 在 `request` 函数中统一捕获 401，触发自动登出：

```typescript
// api/endpoints.ts
async function request<T>(url: string, options?: RequestInit): Promise<T> {
  // ... 现有代码 ...
  if (!res.ok) {
    if (res.status === 401) {
      // 清除 token 并刷新页面
      localStorage.removeItem(STORAGE_KEY)
      window.location.href = "/login"
      throw new Error("Session expired")
    }
    // ...
  }
}
```

---

### P0-4: 热力图 CSS 类名可能不存在

**文件位置**:
- `src/pages/PlayerDetailPage.tsx:215`

**问题描述**:
使用 `grid-cols-24` 类名：

```tsx
<div className="grid grid-cols-24 gap-0.5">
```

**影响**:
- Tailwind CSS 默认不包含 `grid-cols-24`，除非在配置中自定义
- 如果该类名未配置，热力图将显示为一列，严重影响可读性
- 168 个单元格（7天×24小时）堆叠在一起

**修复建议**:
在 `tailwind.config.ts` 中添加自定义 grid 列数，或改用内联样式：

```tsx
<div style={{ display: 'grid', gridTemplateColumns: 'repeat(24, 1fr)', gap: '2px' }}>
```

---

### P0-5: PlayerDetailPage 会话活跃状态判断逻辑错误

**文件位置**:
- `src/pages/PlayerDetailPage.tsx:269-270`

**问题描述**:
```typescript
const isActive = new Date(s.session_end).getTime() > Date.now() - 60000
```

**影响**:
- 如果 `session_end` 是未来的时间戳（数据异常），会错误标记为活跃
- 如果 session 恰好在 60 秒前结束，仍显示为活跃
- 更好的判断应该结合 `detail.online` 状态

**修复建议**:
```typescript
const isActive = detail.online && s.session_end === null  // 或根据后端数据结构调整
```

---

### P0-6: DashboardPage 聚合历史数据逻辑缺陷

**文件位置**:
- `src/pages/DashboardPage.tsx:12-54`

**问题描述**:
`aggregateHistory` 函数在按时间窗口聚合时存在多个问题：

1. **窗口边界问题**: `windowEnd = minTime + step * (i + 1)` 使用 `<` 比较，最后一个窗口的边界数据丢失
2. **离线服务器计数错误**: 只统计 `latest?.online` 的服务器，忽略离线服务器（导致在线率计算不准确）
3. **空窗口处理**: 窗口内没有数据时，`latest` 为 undefined，该服务器被完全忽略

```typescript
// 问题代码（DashboardPage.tsx:38-48）
for (const serverLogs of histories) {
  const inWindow = serverLogs.filter((l) => {
    const t = new Date(l.timestamp).getTime()
    return t >= windowStart && t < windowEnd  // ← 边界问题
  })
  const latest = inWindow[inWindow.length - 1]
  if (latest?.online) {  // ← 离线服务器被完全忽略
    online++
    players += latest.players_online ?? 0
  }
}
```

**影响**:
- 趋势图数据不准确，可能显示比实际更多的在线节点
- 如果某个服务器在窗口内完全离线（无 online 记录），它不会被计入 total，导致分母错误

**修复建议**:
```typescript
function aggregateHistory(histories: StatusLog[][], sampleCount = 12) {
  // ... 计算窗口 ...
  for (const serverLogs of histories) {
    const inWindow = serverLogs.filter(/* ... */)
    const latest = inWindow[inWindow.length - 1]
    totalServers++  // 始终计数
    if (latest?.online) {
      online++
      players += latest.players_online ?? 0
    }
  }
}
```

---

## 🟠 P1 - 重要问题（尽快修复）

### P1-1: 主题管理冲突

**文件位置**:
- `src/components/layout/TopBar.tsx:60-67`
- `src/hooks/useTheme.ts:1-19`

**问题描述**:
`TopBar` 直接操作 DOM：

```typescript
const toggleTheme = () => {
  const root = document.documentElement
  root.classList.toggle("dark")
  localStorage.setItem("theme", root.classList.contains("dark") ? "dark" : "light")
}
```

但 `App.tsx` 使用了 `next-themes` 的 `ThemeProvider`：

```tsx
<ThemeProvider attribute="class" defaultTheme="system" enableSystem>
```

**影响**:
- 两个系统同时管理主题状态，可能导致不同步
- 页面刷新后主题可能跳变
- `next-themes` 的 `system` 模式检测失效

**修复建议**:
使用 `next-themes` 提供的 `useTheme` hook：

```typescript
import { useTheme } from "next-themes"

const { theme, setTheme } = useTheme()
const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark")
```

删除 `useTheme.ts` hook（与 next-themes 重复）。

---

### P1-2: CommandPalette 分组标题错误

**文件位置**:
- `src/components/layout/CommandPalette.tsx:74`

**问题描述**:
所有导航项都显示在 "Dashboard" 分组下：

```tsx
<CommandGroup heading={t("nav.dashboard")}>
  {filteredPages.map((page) => (
    <CommandItem key={page.path} ... />
  ))}
</CommandGroup>
```

**影响**:
- 命令面板标题始终显示 "Dashboard"，用户困惑
- 如果未来添加更多分组，结构混乱

**修复建议**:
```tsx
<CommandGroup heading={t("common.navigation")}>  {/* 或 "Pages" */}
```

或在 i18n 文件中添加 `"navigation": "Navigation"` 翻译。

---

### P1-3: WebSocket Token 不同步

**文件位置**:
- `src/providers/WebSocketProvider.tsx:14-68`

**问题描述**:
WebSocket 只在初始化时读取一次 token：

```typescript
const connect = useCallback(() => {
  const token = localStorage.getItem(AUTH_STORAGE_KEY)  // 只读一次
  // ...
}, [queryClient])
```

当用户登出或切换账号时，WebSocket 仍使用旧 token。

**影响**:
- 登出后 WebSocket 仍保持连接（可能仍能接收数据）
- 切换账号后 WebSocket 使用旧 token

**修复建议**:
监听 token 变化并重建连接：

```typescript
useEffect(() => {
  // 监听 storage 事件或从 AuthContext 获取 token
  connect()
  // ...
}, [token])  // 依赖 token
```

---

### P1-4: AdminPage 路由无守卫

**文件位置**:
- `src/App.tsx:58`
- `src/pages/AdminPage.tsx:79-80`

**问题描述**:
路由定义中没有认证守卫，依赖 AdminPage 内部的 `<Navigate>`：

```tsx
// App.tsx
{ path: "admin", element: <AdminPage /> }  // 无守卫

// AdminPage.tsx（内部处理）
if (!token) return <Navigate to="/login" replace />
```

**影响**:
- 未登录用户访问 `/admin` 时，AdminPage 会短暂渲染后跳转
- 可能闪烁管理界面内容
- 不符合安全最佳实践

**修复建议**:
创建 `ProtectedRoute` 组件：

```tsx
function ProtectedRoute({ children }: { children: ReactNode }) {
  const { token, isAuthenticated } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return children
}

// App.tsx
{ path: "admin", element: <ProtectedRoute><AdminPage /></ProtectedRoute> }
```

---

### P1-5: BottomNav 导航高亮逻辑问题

**文件位置**:
- `src/components/layout/BottomNav.tsx:43`

**问题描述**:
```typescript
const active = location.pathname.startsWith(item.path)
```

**影响**:
- 访问 `/nodes/abc` 时，`/nodes` 和 `/nodes/abc` 都会高亮（当前路由结构下 `/nodes/:nodeId` 不存在，但如果未来添加可能出问题）
- `/admin` 访问 `/admin/settings` 时可能不匹配

**修复建议**:
```typescript
const active = location.pathname === item.path || 
               (item.path !== "/" && location.pathname.startsWith(item.path + "/"))
```

---

### P1-6: ErrorBoundary 未在顶层使用

**文件位置**:
- `src/App.tsx:70-72`
- `src/components/shared/ErrorBoundary.tsx`

**问题描述**:
`ErrorBoundary` 已定义但**从未在任何地方使用**。

**影响**:
- 组件渲染错误会导致整个应用白屏
- 用户无法恢复，只能刷新页面

**修复建议**:
```tsx
// App.tsx
<ErrorBoundary>
  <Suspense fallback={<Fallback />}>
    <RouterProvider router={router} />
  </Suspense>
</ErrorBoundary>
```

---

### P1-7: AdminPage 自动展开逻辑依赖缺失

**文件位置**:
- `src/pages/AdminPage.tsx:197-201`

**问题描述**:
```typescript
useEffect(() => {
  if (groups.length === 1 && !selected) {
    setExpandedGroups(new Set([groups[0].id]))
  }
}, [groups])
```

**影响**:
- ESLint 会报 `react-hooks/exhaustive-deps` 警告
- `selected` 变化时不会重新评估

**修复建议**:
```typescript
}, [groups, selected])
```

---

### P1-8: TopBar 快捷键显示不匹配

**文件位置**:
- `src/components/layout/TopBar.tsx:148-150`

**问题描述**:
```tsx
<kbd className="...">⌘K</kbd>
```

**影响**:
- Windows/Linux 用户看到 Mac 的 ⌘ 符号，但实际快捷键是 Ctrl+K
- 用户困惑，尝试按 Cmd 键（Windows 没有）

**修复建议**:
```tsx
<kbd className="...">
  {navigator.platform.includes('Mac') ? '⌘' : 'Ctrl+'}K
</kbd>
```

---

### P1-9: 401 错误无统一处理

**文件位置**:
- `src/api/endpoints.ts:22-36`

**问题描述**:
API 请求函数没有统一处理 401 未授权错误。

**影响**:
- token 过期后每个 API 调用都失败，但页面不会自动跳转登录
- 用户在空白页面上困惑

**修复建议**:
在 `request` 函数中添加全局 401 处理（见 P0-3）。

---

### P1-10: PlayersPage 离线人数可能为负数

**文件位置**:
- `src/pages/PlayersPage.tsx:69`

**问题描述**:
```tsx
<StatCard title={t("common.offline")} value={players.length - onlineCount} variant="danger" />
```

**影响**:
- 虽然理论上不会为负，但如果 `onlineCount` 计算有误（如数据不一致），会显示负数
- 缺乏防御性编程

**修复建议**:
```tsx
value={Math.max(0, players.length - onlineCount)}
```

---

## 🟡 P2 - 中等问题（建议修复）

### P2-1: NodesPage 重复过滤计算

**文件位置**:
- `src/pages/NodesPage.tsx:29-48`

**问题描述**:
对 `nodes` 数组过滤了 3 次来计算 `avgLat`。

**修复建议**:
```typescript
const onlineNodesWithLatency = useMemo(() => 
  nodes.filter(n => n.latest_status?.online && n.latest_status?.latency != null),
  [nodes]
)
const avgLat = onlineNodesWithLatency.length > 0
  ? Math.round(onlineNodesWithLatency.reduce((a, n) => a + n.latest_status!.latency!, 0) / onlineNodesWithLatency.length)
  : 0
```

---

### P2-2: DashboardPage 请求风暴

**文件位置**:
- `src/pages/DashboardPage.tsx:71-80`

**问题描述**:
```typescript
const { data: trend } = useQuery({
  queryKey: ["trend", serverIds.join(",")],
  queryFn: async () => {
    const results = await Promise.all(
      serverIds.map((id) => api.servers.history(id, 24))
    )
    return aggregateHistory(results)
  },
  enabled: serverIds.length > 0,
})
```

**影响**:
- 如果有 50 个服务器，会同时发送 50 个历史数据请求
- 可能导致浏览器并发限制或服务器压力过大

**修复建议**:
1. 后端提供批量查询接口 `/api/history?server_ids=...`
2. 或在前端限制并发数（如使用 p-limit）

---

### P2-3: PlayerDetailPage 小时聚合逻辑简化

**文件位置**:
- `src/pages/PlayerDetailPage.tsx:318-335`

**问题描述**:
```typescript
function aggregateHourly(sessions) {
  const h = new Date(s.session_start).getHours()
  const dur = (new Date(s.session_end).getTime() - new Date(s.session_start).getTime()) / 1000 / 60
  buckets.set(h, (buckets.get(h) || 0) + dur)
}
```

**影响**:
- 只按 session_start 的小时分类，不考虑会话跨越多小时
- 一个 3 小时的会话会被全部分配到开始的小时，而非分摊
- 数据准确性受影响

**修复建议**:
按实际跨越多小时的区间分摊时长。

---

### P2-4: WebSocket 重连无指数退避

**文件位置**:
- `src/providers/WebSocketProvider.tsx:31`

**问题描述**:
```typescript
reconnectTimer.current = setTimeout(connect, 3000)  // 固定 3 秒
```

**影响**:
- 服务器故障时，客户端每 3 秒重连一次，可能造成 DDoS
- 没有最大重试次数限制

**修复建议**:
```typescript
const backoff = Math.min(3000 * Math.pow(2, retryCount), 30000)  // 指数退避，最大 30 秒
```

---

### P2-5: NodeCard 硬编码英文

**文件位置**:
- `src/components/shared/NodeCard.tsx:74`

**问题描述**:
```tsx
<span className="text-xs text-muted-foreground">Offline</span>
```

**影响**:
- 非英语用户看到英文 "Offline"
- 与 i18n 架构不一致

**修复建议**:
```tsx
<span className="text-xs text-muted-foreground">{t("common.offline")}</span>
```

---

### P2-6: Sparkline 单数据点处理

**文件位置**:
- `src/components/shared/Sparkline.tsx:85-99`

**问题描述**:
```typescript
if (data.length < 2) {
  return (
    <svg ...>
      <line ... strokeDasharray="4 3" />  // 显示虚线
    </svg>
  )
}
```

**影响**:
- `data.length === 1` 时显示虚线，用户不知道有一个数据点

**修复建议**:
```typescript
if (data.length === 0) return <svg ...><line /></svg>
if (data.length === 1) return <svg ...><circle cx={width/2} cy={height/2} r={3} /></svg>
```

---

### P2-7: AdminPage Settings 表单无验证

**文件位置**:
- `src/pages/AdminPage.tsx:1204-1458`

**问题描述**:
设置表单没有输入验证：
- `poll_interval` 可以为负数或 0
- `port` 可以输入非数字或超出范围（1-65535）
- `webhook_alert.url` 没有 URL 格式验证

**修复建议**:
添加 Zod 验证或简单的 HTML5 验证：

```tsx
<Input 
  type="number" 
  min={1} 
  max={65535} 
  value={form.port || ""} 
  onChange={...} 
/>
```

---

### P2-8: 多处 catch (e: any)

**文件位置**:
- `src/providers/AuthProvider.tsx:31, 46`
- `src/pages/LoginPage.tsx:41, 47`
- `src/pages/AdminPage.tsx:1492`

**问题描述**:
TypeScript 中 `any` 类型不安全。

**修复建议**:
```typescript
catch (e: unknown) {
  const message = e instanceof Error ? e.message : "Unknown error"
  setError(message)
}
```

---

### P2-9: ServersPage URL 参数编码问题

**文件位置**:
- `src/pages/ServersPage.tsx:15`
- `src/api/endpoints.ts:53`

**问题描述**:
```typescript
const groupFilter = searchParams.get("group_id")
// endpoints.ts
request<ServerItem[]>(`/api/servers${groupId ? `?group_id=${groupId}` : ""}`)
```

**影响**:
- `groupId` 如果包含特殊字符（如 `&`、`=`），会导致 URL 解析错误
- 应使用 `URLSearchParams`

**修复建议**:
```typescript
const p = new URLSearchParams()
if (groupId) p.set("group_id", groupId)
const qs = p.toString()
return request<ServerItem[]>(`/api/servers${qs ? `?${qs}` : ""}`)
```

---

### P2-10: BadgesPage 玩家树缺少分类

**文件位置**:
- `src/pages/BadgesPage.tsx:348-415`

**问题描述**:
在线玩家和离线玩家混在一起显示，没有视觉分组。

**影响**:
- 玩家多时难以找到特定玩家
- 没有搜索功能

**修复建议**:
1. 添加搜索框过滤玩家
2. 或按字母顺序分组显示

---

### P2-11: DashboardPage serversByGroup 未处理 null

**文件位置**:
- `src/pages/DashboardPage.tsx:91-96`

**问题描述**:
```typescript
const serversByGroup = new Map<string | null, typeof servers>()
for (const s of servers) {
  const key = s.group_id
  if (!serversByGroup.has(key)) serversByGroup.set(key, [])
  serversByGroup.get(key)!.push(s)
}
```

**影响**:
- `group_id` 为 `null` 的服务器被放入 `null` 键，但渲染时 `groups.map` 不会包含 null 组
- 未分组服务器在 Dashboard 不显示

**修复建议**:
在渲染时添加未分组服务器区域，类似 ServersPage 的处理方式。

---

## 🔵 P3 - 建议（可选优化）

### P3-1: 缺少 React.memo 优化

**文件位置**:
- `src/components/shared/ServerCard.tsx`
- `src/components/shared/NodeCard.tsx`
- `src/components/shared/PlayerCard.tsx`

**建议**:
这些卡片组件接收简单 props，适合用 `React.memo` 避免不必要的重渲染。

---

### P3-2: QueryClient 配置可优化

**文件位置**:
- `src/providers/QueryProvider.tsx:7-15`

**建议**:
```typescript
new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      retry: 1,
      refetchOnWindowFocus: false,
      // 建议添加：
      gcTime: 5 * 60 * 1000,  // 缓存 5 分钟
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
  },
})
```

---

### P3-3: 缺少 Loading Skeleton 统一组件

**建议**:
各页面的 Skeleton 代码高度重复，可提取 `PageSkeleton` 组件。

---

### P3-4: 缺少 useDebounce

**文件位置**:
- `src/pages/PlayersPage.tsx:75-83`
- `src/pages/NodesPage.tsx:90-98`

**建议**:
搜索输入应使用 debounce，避免每次按键都触发 filter（虽然当前是前端过滤，但如果改为后端搜索就需要）。

---

### P3-5: 无障碍性缺失

**问题**:
- 多个按钮没有 `aria-label`（如 TopBar 的图标按钮）
- 状态指示器没有 `role="status"` 和 `aria-live`
- 表格缺少 `scope` 属性

---

## 修复优先级路线图

### 第一阶段（本周内）
1. **P0-1**: 删除虚假数据，接入真实历史数据 API
2. **P0-2**: 为所有页面添加 error 处理
3. **P0-3**: 添加 Token 过期检测和 401 统一处理

### 第二阶段（两周内）
4. **P1-1**: 修复主题管理冲突
5. **P1-3**: 修复 WebSocket Token 同步
6. **P1-4**: 添加路由守卫
7. **P1-6**: 启用 ErrorBoundary

### 第三阶段（一个月内）
8. **P0-4**: 修复热力图 CSS
9. **P0-5**: 修复会话活跃判断
10. **P0-6**: 修复聚合逻辑
11. **P2-1~P2-11**: 性能优化和代码质量改进
12. **P3-1~P3-5**: 可访问性和可维护性优化

---

## 附录：文件完整性检查

| 文件 | 状态 | 备注 |
|------|------|------|
| App.tsx | ✅ 已审计 | 路由配置完整 |
| api/endpoints.ts | ✅ 已审计 | 缺少错误处理 |
| api/types.ts | ✅ 已审计 | 类型定义完整 |
| providers/* | ✅ 已审计 | Auth/WebSocket/Query |
| components/layout/* | ✅ 已审计 | TopBar/BottomNav/AppShell/CommandPalette |
| components/shared/* | ✅ 已审计 | ServerCard/NodeCard/PlayerCard/StatCard/Sparkline/PageHeader/EmptyState/ErrorBoundary |
| pages/* | ✅ 已审计 | 所有 12 个页面 |
| hooks/useTheme.ts | ✅ 已审计 | 与 next-themes 重复 |
| i18n/* | ✅ 已审计 | 中英文翻译完整 |
| lib/utils.ts | ✅ 已审计 | 工具函数 |

**总审计文件数**: 28 个  
**发现问题总数**: 32 个  
**建议修复数**: 32 个

---

*报告生成时间: 2025-06-05*  
*审计工具: 人工代码审查 + 静态分析*
