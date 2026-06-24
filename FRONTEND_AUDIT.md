# MotdTracker 前端代码审计报告

**审计范围**：`frontend/src/` 全部源码（约 40 个 `.ts/.tsx` 文件）
**审计重点**：逻辑错误、显示问题、文案/i18n、类型一致性、细节缺陷
**审计时间**：2026-06-24
**修复状态**：✅ 全部 25 个问题已修复（tsc + vite build 通过）

---

## 问题汇总

| 严重级别 | 数量 | 修复 |
|---------|------|------|
| 🔴 Critical (P0) | 2 | ✅ 2 |
| 🟠 High (P1) | 6 | ✅ 6 |
| 🟡 Medium (P2) | 9 | ✅ 9 |
| 🟢 Low (P3) | 8 | ✅ 8 |
| **合计** | **25** | **✅ 25** |

---

## 🔴 Critical (P0) — 功能完全失效

### P0-1. Storage key 不一致导致 WebSocket 永远无法携带 token

**文件**：
- `providers/AuthProvider.tsx:16` — `STORAGE_KEY = "motdtracker_auth"`，存储的是 JSON 对象 `{token, expiresAt}`
- `providers/WebSocketProvider.tsx:12` — `AUTH_STORAGE_KEY = "motdtracker_auth_token"`，读取的是裸字符串
- `api/endpoints.ts:22` — `AUTH_STORAGE_KEY = "motdtracker_auth_token"`，同样错误

**问题**：
- AuthProvider 登录时写入 key `"motdtracker_auth"`，值为 `{token, expiresAt}` 的 JSON 字符串
- WebSocketProvider 读取 key `"motdtracker_auth_token"` — **永远拿到 null**
- 结果：WebSocket 连接 URL 永远不带 `?token=xxx`，实时推送的鉴权失败
- 同理，`endpoints.ts` 的 401 拦截器清除的也是错误的 key，无法真正登出

**修复**：统一使用 `"motdtracker_auth"` 作为 key，WebSocketProvider 和 endpoints.ts 读取时需 `JSON.parse(raw).token`

---

### P0-2. NodeDetailPage CV 值二次乘 100 导致显示错误

**文件**：`pages/NodeDetailPage.tsx:296`

```tsx
{stats.cv != null ? `${(stats.cv * 100).toFixed(1)}%` : "--"}
```

**问题**：
- 后端 `src/utils/stats.rs:62`：`cv = (std_dev / avg) * 100.0` — **已返回百分比值**（如 25.5 表示 25.5%）
- 后端 badge.rs:545 也直接用 `format!("{:.1}%", v)`，证明 cv 就是百分比
- 前端又乘 100：实际 CV=25.5% 会显示为 `2550.0%`

**修复**：
```tsx
{stats.cv != null ? `${stats.cv.toFixed(1)}%` : "--"}
```

---

## 🟠 High (P1) — 逻辑错误或显著显示问题

### P1-1. useMonitorData 默认排序：在线节点排到离线节点之后

**文件**：`hooks/useMonitorData.ts:183`

```ts
if (aOnline !== bOnline) return aOnline ? 1 : -1
```

**问题**：`aOnline ? 1 : -1` 表示在线节点返回 1（排后面），离线节点返回 -1（排前面）。
结果：**离线节点显示在在线节点之前**，不符合用户预期。

**修复**：
```ts
if (aOnline !== bOnline) return aOnline ? -1 : 1
```

---

### P1-2. useMonitorData uptime 排序方向错误

**文件**：`hooks/useMonitorData.ts:173`

```ts
case "uptime": {
  const ua = a.latency_stats?.uptime_percentage ?? 0
  const ub = b.latency_stats?.uptime_percentage ?? 0
  return ua - ub  // 升序：低可用率在前
}
```

**问题**：用户选择"可用率排序"时，期望高可用率节点优先显示，但实际是低可用率排前面。
（注：latency 和 players 排序是降序 `lb - la` / `pb - pa`，虽然延迟降序存疑，但 uptime 升序明确错误）

**修复**：
```ts
return ub - ua  // 降序：高可用率在前
```

---

### P1-3. MonitorStatsBar alerts sub 单位错误

**文件**：`components/monitor/MonitorStatsBar.tsx:40`

```ts
sub: stats.highLatencyCount > 0 ? `↑${stats.highLatencyCount}ms` : "",
```

**问题**：`highLatencyCount` 是高延迟**节点数量**（见 useMonitorData.ts:88），不是毫秒值。`ms` 单位完全错误。

**修复**：
```ts
sub: stats.highLatencyCount > 0 ? `↑${stats.highLatencyCount}` : "",
```

---

### P1-4. AppStatus 类型仍含 port 字段，后端已移除

**文件**：`api/types.ts:7`

```ts
export interface AppStatus {
  version: string
  server_name: string
  poll_interval: number
  port: number  // ← 后端已移除
  ...
}
```

**问题**：后端 `src/api/status.rs` 在上一阶段审计中已移除 `port` 字段。前端类型未同步，运行时 `port` 为 `undefined`。

**修复**：删除 `port: number` 字段。

---

### P1-5. AdminNode.color 类型应为可空

**文件**：`api/types.ts:211`

```ts
export interface AdminNode {
  ...
  color: string  // ← 非空
  ...
}
```

**问题**：
- `NodeWithStats.color` 是 `string | null`（types.ts:95）
- 后端 `AdminNode` 的 color 字段可返回 null
- 类型不一致导致 AdminPage 的 NodeForm 在 `existing.color` 为 null 时行为异常

**修复**：
```ts
color: string | null
```
NodeForm 初始化时需处理 null：`color: existing.color ?? "#1A73E8"`

---

### P1-6. AdminPage TreeNode 使用未定义的 i18n key

**文件**：`pages/AdminPage.tsx:661, 690`

```tsx
title={expanded ? t("common.collapse") : t("common.expand")}
title={t("common.add")}
```

**问题**：`en.json` 和 `zh-CN.json` 的 `common` 部分均无 `collapse`/`expand`/`add` 三个 key。
结果：tooltip 显示为字面量 `"common.collapse"` 等。

**修复**：在两个 locale 文件的 `common` 下添加：
```json
"collapse": "Collapse" / "折叠",
"expand": "Expand" / "展开",
"add": "Add" / "添加"
```

---

## 🟡 Medium (P2) — 文案/i18n/样式问题

### P2-1. ErrorBoundary 硬编码英文

**文件**：`components/shared/ErrorBoundary.tsx:42, 48`

```tsx
{error?.message || "Something went wrong"}
...
<button>Reload</button>
```

**问题**：未使用 i18n。虽然 ErrorBoundary 是 class component，`useTranslation` 不可直接用，但 ErrorFallback 是函数组件可以调用。

**修复**：在 locale 文件添加 `common.somethingWentWrong` 和 `common.reload`，ErrorFallback 中使用 `t()`。

---

### P2-2. CommandPalette 所有页面归在同一 "Dashboard" heading 下

**文件**：`components/layout/CommandPalette.tsx:74`

```tsx
<CommandGroup heading={t("nav.dashboard")}>
```

**问题**：所有导航项（Monitor/Servers/Nodes/Players/Badges/Admin/Login）都在 "Dashboard"（"仪表盘"）标题下，语义错误。

**修复**：改为通用标题如 `t("common.pages")` 或 `t("common.navigation")`，并在 locale 文件添加对应 key。

---

### P2-3. BadgesPage badge type labels 硬编码英文

**文件**：`pages/BadgesPage.tsx:29-53`

```ts
const NODE_BADGE_TYPES = [
  { value: "status", label: "Status" },
  { value: "uptime", label: "Uptime" },
  ...
]
const FORMATS = [
  { value: "url", label: "URL" },
  { value: "html", label: "HTML" },
  ...
]
```

**问题**：所有 badge type 和 format 的 label 硬编码英文，未走 i18n。

**修复**：将 label 改为 i18n key，如 `t("badges.typeStatus")`，在 locale 文件添加对应翻译。

---

### P2-4. Recharts 使用 `hsl(var(--card))` 但 CSS 变量已是完整 HSL 值

**文件**：`pages/NodeDetailPage.tsx`、`pages/ServerDetailPage.tsx`、`pages/PlayerDetailPage.tsx`

```tsx
backgroundColor: "hsl(var(--card))",
border: "1px solid hsl(var(--border))",
stroke="hsl(var(--muted))"
stroke="hsl(var(--muted-foreground))"
```

**问题**：
- `index.css:61`：`--card: hsl(0 0% 99%)` — 变量值已经是完整的 `hsl()` 函数调用
- `hsl(var(--card))` 会展开为 `hsl(hsl(0 0% 99%))` — **无效 CSS**
- Recharts 的 tooltip/grid/axis 样式全部失效（背景透明、边框消失、坐标轴不可见）

**修复**：直接使用 `var(--card)`、`var(--border)`、`var(--muted)`、`var(--muted-foreground)`。

---

### P2-5. PlayerDetailPage recentSessions 取的是最旧的 30 条会话

**文件**：`pages/PlayerDetailPage.tsx:140`

```ts
return detail.sessions.slice(-30).reverse().map(...)
```

**问题**：
- 后端返回 sessions 为 DESC 排序（最新在前）
- `slice(-30)` 取的是数组**最后** 30 条，即最旧的 30 条
- `.reverse()` 后变为升序（最旧在前，最新在后）
- 结果：会话列表显示的是最旧的 30 条记录，而非最近的 30 条

**修复**：
```ts
return detail.sessions.slice(0, 30).map(...)
```
取前 30 条（最新 30 条），保持 DESC 顺序（最新在最上方）。

---

### P2-6. useMonitorData 硬编码中文 "未分组"

**文件**：`hooks/useMonitorData.ts:252`

```ts
groupName: group?.name || (groupId === "__ungrouped" ? "未分组" : groupId),
```

**问题**：英文环境下显示中文"未分组"。

**修复**：因 hook 内无法直接用 `useTranslation`（会导致 hook 顺序问题），建议将未分组名称通过返回值传递，由组件层翻译；或在 hook 中引入 `useTranslation`。

---

### P2-7. PlayerDetailPage heatmap "Less"/"More" 硬编码英文

**文件**：`pages/PlayerDetailPage.tsx:387, 395`

```tsx
<span>Less</span>
...
<span>More</span>
```

**修复**：添加 i18n key `player.less` / `player.more`。

---

### P2-8. PlayerDetailPage avgSession subtitle "closed" 硬编码且语义错误

**文件**：`pages/PlayerDetailPage.tsx:248`

```ts
subtitle={stats && stats.avg > 0 ? `${stats.favCount} closed` : ""}
```

**问题**：
- `favCount` 是最常去服务器的**出现次数**（见 computeSessionStats:91），不是"关闭的会话数"
- "closed" 硬编码英文
- subtitle 显示在"平均会话"卡片下，语义混乱

**修复**：移除或改为有意义的副标题，如显示总会话数 `${sessions.length} sessions` 并 i18n。

---

### P2-9. AdminPage webhook headers 编辑体验差

**文件**：`pages/AdminPage.tsx:1388-1396`

```tsx
onChange={(e) => {
  try {
    const headers = JSON.parse(e.target.value)
    setForm({ ...form, webhook_alert: { ...form.webhook_alert!, headers } })
  } catch {
    // invalid JSON — ignore
  }
}}
```

**问题**：用户输入无效 JSON 时静默忽略，数据不更新且无任何反馈。用户以为改了但实际没生效。

**修复**：添加解析错误状态提示，或在 textarea 下方显示 JSON 有效性指示器。

---

## 🟢 Low (P3) — 细节优化

### P3-1. AppStatusProvider staleTime: Infinity 导致状态数据永不刷新

**文件**：`providers/AppStatusProvider.tsx`

**问题**：`staleTime: Infinity` 使 `server_name`、`poll_interval` 等信息变更后不会自动刷新。

**修复**：改为合理的 `staleTime`（如 60_000）或添加手动 invalidate 逻辑。

---

### P3-2. MonitorStatsBar 高延迟阈值硬编码

**文件**：`components/monitor/MonitorStatsBar.tsx:34`

```ts
alert: stats.avgLatency != null && stats.avgLatency > 500,
```

**问题**：阈值 500 与 useMonitorData 的 `HIGH_LATENCY_THRESHOLD = 500` 重复定义，易不一致。

**修复**：提取为共享常量。

---

### P3-3. PlayerDetailPage currentServer 可能匹配多个

**文件**：`pages/PlayerDetailPage.tsx:162`

```ts
const currentServer = detail?.servers.find((s) => s.online)
```

**问题**：若玩家同时在多个服务器在线，只显示第一个。PageHeader 的 description 只显示一个服务器名。

**修复**：使用 `filter` 并显示数量，或文档化此行为。

---

### P3-4. AdminPage moveNodeUp/Down 按钮使用 ChevronRight 旋转模拟

**文件**：`pages/AdminPage.tsx:1063, 1071`

```tsx
<ChevronRight className="h-3.5 w-3.5 -rotate-90" />  // up
<ChevronRight className="h-3.5 w-3.5 rotate-90" />    // down
```

**问题**：可读性差，lucide-react 有专门的 `ChevronUp` / `ChevronDown`。

**修复**：替换为 `ChevronUp` / `ChevronDown`。

---

### P3-5. AdminPage expandedGroups 初始化逻辑失效

**文件**：`pages/AdminPage.tsx:194-196`

```ts
const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
  () => (groups.length === 1 && !selected ? new Set([groups[0].id]) : new Set())
)
```

**问题**：组件首次渲染时 `groups` 来自 useQuery，初始为空数组。`useState` 初始化器只在首次渲染执行，此时 `groups.length === 0`，条件永远为 false。期望的"单分组自动展开"逻辑失效。

**修复**：改用 `useEffect` 在 groups 加载后检查并设置。

---

### P3-6. AdminPage NodeForm port 输入无范围验证

**文件**：`pages/AdminPage.tsx:1114`

```tsx
onChange={(e) => setForm({ ...form, port: +e.target.value })}
```

**问题**：可输入 0、负数、超过 65535 的值。虽然后端会校验，但前端无即时反馈。

**修复**：添加 `min={1} max={65535}` 属性，或在 onChange 中 clamp。

---

### P3-7. BadgesPage TreeRow tooltip 硬编码英文

**文件**：`pages/BadgesPage.tsx:624`

```tsx
title={expanded ? "Collapse" : "Expand"}
```

**修复**：使用 i18n key。

---

### P3-8. PlayerDetailPage 每秒 setInterval 更新 now 导致全表重渲染

**文件**：`pages/PlayerDetailPage.tsx:133-136`

```tsx
const [now, setNow] = useState(() => Date.now())
useEffect(() => {
  const id = setInterval(() => setNow(Date.now()), 1000)
  return () => clearInterval(id)
}, [])
```

**问题**：每秒触发 `recentSessions` 的 useMemo 重算（因 `now` 是依赖），导致整个会话表格每秒重渲染。会话数量多时有性能影响。

**修复**：仅对 active session 的 duration 用独立组件做每秒更新，避免全表重算。

---

## 附录：i18n 缺失 key 清单

以下 key 在代码中被调用但 locale 文件中不存在：

| Key | 调用位置 |
|-----|---------|
| `common.collapse` | AdminPage.tsx:661 |
| `common.expand` | AdminPage.tsx:661 |
| `common.add` | AdminPage.tsx:690 |

以下文案在代码中硬编码未走 i18n：

| 文案 | 位置 |
|------|------|
| "Something went wrong" | ErrorBoundary.tsx:42 |
| "Reload" | ErrorBoundary.tsx:48 |
| "未分组" | useMonitorData.ts:252 |
| "Less" / "More" | PlayerDetailPage.tsx:387, 395 |
| "closed" | PlayerDetailPage.tsx:248 |
| "Collapse" / "Expand" | BadgesPage.tsx:624 |
| Badge type labels (Status/Uptime/Latency/...) | BadgesPage.tsx:29-53 |
| Format labels (URL/HTML/Markdown) | BadgesPage.tsx:50-54 |

---

## 建议修复优先级

1. **立即修复（P0）**：Storage key 不一致（P0-1）和 CV 二次乘 100（P0-2）—— 前者导致 WS 实时推送失效，后者导致数据显示错误
2. **尽快修复（P1）**：排序逻辑、单位错误、类型不一致、缺失 i18n key
3. **计划修复（P2）**：Recharts 样式失效（P2-4）影响所有图表显示，sessions 顺序（P2-5）影响用户查看历史，其余为文案完善
4. **择机优化（P3）**：性能优化和细节打磨
