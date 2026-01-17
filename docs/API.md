# MotdTracker API 文档

> **快速访问**: 访问 <http://127.0.0.1:5011/api/docs> 查看交互式 Swagger UI

## 目录

- [服务器 API](#服务器-api)
- [节点 API](#节点-api)
- [玩家 API](#玩家-api)
- [Web 前端 API](#web-前端-api)
- [Badge API](#badge-api)
- [Exporter API](#exporter-api)
- [通用参数](#通用参数)
- [响应格式](#响应格式)

---

## 服务器 API

基础路径: `/api/server`

### GET /nodes

**描述**: 获取所有节点及其 24 小时延迟统计

**参数**: 无

**返回**: 节点列表，每个节点包含：
- `id` - 节点 ID
- `name` - 节点名称
- `host` - 服务器地址
- `port` - 服务器端口
- `color` - 图表颜色（十六进制）
- `enabled` - 是否启用（`true`/`false`）
- `latest_status` - 最新状态对象（**禁用节点为 `null`**）
- `latency_stats` - 24h 延迟统计
  - `uptime_percentage` - 在线率 (%)
  - `avg_latency` - 平均延迟 (ms)
  - `std_dev` - 标准差
  - `min_latency` - 最小延迟
  - `max_latency` - 最大延迟
  - `p95_latency` - P95 延迟
  - `cv` - 变异系数 (%)

**示例**:
```bash
curl http://localhost:5011/api/server/nodes
```

---

### GET /head

**描述**: 获取服务器实时聚合状态，包含所有节点的最新数据

**参数**: 无

**返回**:
```json
{
  "timestamp": "2026-01-17T12:34:56+08:00",
  "online": true,
  "players_online": 42,
  "players_max": 100,
  "version": "1.20.1",
  "motd": "§cWelcome to Server",
  "latencies": {
    "节点1": 15.5,
    "节点2": 22.3
  },
  "nodes": [
    {
      "id": 1,
      "name": "节点1",
      "host": "192.168.1.1",
      "port": 25565,
      "color": "#10b981",
      "latest_status": {...}
    }
  ]
}
```

**示例**:
```bash
curl http://localhost:5011/api/server/head
```

---

### GET /history

**描述**: 获取服务器聚合历史数据（所有节点合并）

**参数**:
- `hours` (可选, 整数, 默认=12, 范围=1-720) - 查询时间范围

**返回**: 历史记录数组，每条包含：
- `timestamp` - 时间戳（UTC+8）
- `online` - 是否在线
- `players_online` - 在线玩家数
- `players_max` - 最大玩家数
- `version` - 服务器版本
- `motd` - 服务器 MOTD
- `latencies` - 各节点延迟 Map

**排序**: 按时间升序（最旧在前，最新在后），适合图表从左到右显示

**示例**:
```bash
# 获取 24 小时历史
curl http://localhost:5011/api/server/history?hours=24

# 获取 72 小时历史
curl http://localhost:5011/api/server/history?hours=72
```

---

### GET /history-compact

**描述**: 获取服务器历史数据（精简版），仅包含图表必需字段

**参数**:
- `hours` (可选, 整数, 默认=12, 范围=1-720)

**返回**:
```json
{
  "timestamps": ["2026-01-17T12:00:00+08:00", ...],
  "online": [true, false, true, ...],
  "players_online": [42, 0, 38, ...],
  "players_max": [100, 100, 100, ...],
  "latencies": {
    "节点1": [15.5, null, 16.2, ...],
    "节点2": [22.3, null, 21.8, ...]
  }
}
```

**用途**: 用于前端图表渲染，减少传输体积

**示例**:
```bash
curl http://localhost:5011/api/server/history-compact?hours=24
```

---

### GET /stats

**描述**: 获取服务器聚合 24 小时统计指标

**参数**: 无

**返回**:
```json
{
  "uptime_percentage": 98.5,
  "avg_latency": 18.7,
  "total_checks": 1440,
  "online_checks": 1418,
  "std_dev": 4.2,
  "min_latency": 10.1,
  "max_latency": 45.3,
  "p95_latency": 28.5,
  "cv": 22.5
}
```

**说明**:
- `uptime_percentage` - 在线率百分比
- `cv` - 变异系数：<10% 稳定，10-30% 中等，>30% 不稳定

**示例**:
```bash
curl http://localhost:5011/api/server/stats
```

---

### GET /uptime

**描述**: 获取服务器 24 小时在线率

**参数**: 无

**返回**:
```json
{
  "uptime_percentage": 98.5,
  "total_checks": 1440,
  "online_checks": 1418
}
```

**示例**:
```bash
curl http://localhost:5011/api/server/uptime
```

---

### GET /status-timeline

**描述**: 获取 24 小时服务器在线状态时间轴（用于热图）

**参数**: 无

**返回**:
```json
{
  "timestamps": ["2026-01-17T00:00:00+08:00", ...],
  "online": [true, true, false, ...]
}
```

**用途**: 用于 24 小时热力图展示

**示例**:
```bash
curl http://localhost:5011/api/server/status-timeline
```

---

### GET /players

**描述**: 获取在线玩家列表（已去重）

**参数**: 无

**返回**: 玩家对象数组：
```json
[
  {
    "server_id": 1,
    "server_name": "主线",
    "player_name": "Steve",
    "online": true,
    "session_start": "2026-01-17T10:30:00+08:00",
    "last_seen": "2026-01-17T12:30:00+08:00",
    "duration_seconds": 7200
  }
]
```

**说明**: 同名玩家仅显示最后看到的节点

**示例**:
```bash
curl http://localhost:5011/api/server/players
```

---

### GET /config

**描述**: 获取服务器配置信息

**参数**: 无

**返回**:
```json
{
  "poll_interval": 60,
  "server_name": "PoiCraft"
}
```

**示例**:
```bash
curl http://localhost:5011/api/server/config
```

---

## 节点 API

基础路径: `/api/node`

> **重要说明**: 当节点在配置文件中被禁用（`enable: false`）时，所有节点 API 返回的 `status` 或 `latest_status` 字段将为 `null`，不会查询数据库。节点对象包含 `enabled` 字段标识是否启用。

### GET /

**描述**: 获取所有节点基础信息

**参数**: 无

**返回**: 节点列表（同 `/api/server/nodes`）

**返回字段**:
- `id` - 节点 ID
- `name` - 节点名称
- `host` - 服务器地址
- `port` - 服务器端口
- `color` - 图表颜色（十六进制）
- `enabled` - 是否启用（`true`/`false`）
- `status` - 最新状态对象（**禁用节点为 `null`**）

**示例**:
```bash
curl http://localhost:5011/api/node
```

---

### GET /<node_id>

**描述**: 获取单个节点的最新状态

**参数**:
- `node_id` (必需, 路径参数, 整数)

**返回**:
```json
{
  "timestamp": "2026-01-17T12:34:56+08:00",
  "server_id": 1,
  "online": true,
  "players_online": 42,
  "players_max": 100,
  "version": "1.20.1",
  "motd": "§cWelcome",
  "latency": 15.5,
  "favicon": "data:image/png;base64,..."
}
```

**错误**:
- `404` - 节点不存在

**示例**:
```bash
curl http://localhost:5011/api/node/1
```

---

### GET /<node_id>/head

**描述**: 获取节点详情及最新状态

**参数**:
- `node_id` (必需, 路径参数, 整数)

**返回**: 节点配置 + 最新状态

**返回字段**:
- `id` - 节点 ID
- `name` - 节点名称
- `host` - 服务器地址
- `port` - 服务器端口
- `color` - 图表颜色
- `enabled` - 是否启用（`true`/`false`）
- `latest_status` - 最新状态对象（**禁用节点为 `null`**）

**示例**:
```bash
curl http://localhost:5011/api/node/1/head
```

---

### GET /<node_id>/history

**描述**: 获取单个节点的历史数据

**参数**:
- `node_id` (必需, 路径参数, 整数)
- `hours` (可选, 整数, 默认=12, 范围=1-720)

**返回**: 历史记录数组

**排序**: 按时间升序（最旧在前）

**示例**:
```bash
curl http://localhost:5011/api/node/1/history?hours=24
```

---

### GET /<node_id>/history-compact

**描述**: 获取节点历史数据（精简版）

**参数**:
- `node_id` (必需, 路径参数, 整数)
- `hours` (可选, 整数, 默认=12, 范围=1-720)

**返回**:
```json
{
  "timestamps": [...],
  "online": [...],
  "latency": [...],
  "players_online": [...],
  "players_max": [...]
}
```

**示例**:
```bash
curl http://localhost:5011/api/node/1/history-compact
```

---

### GET /<node_id>/stats

**描述**: 获取单个节点的统计信息

**参数**:
- `node_id` (必需, 路径参数, 整数)
- `hours` (可选, 整数, 默认=12, 范围=1-720)

**返回**: 统计指标（同 `/api/server/stats`）

**示例**:
```bash
curl http://localhost:5011/api/node/1/stats?hours=24
```

---

### GET /<node_id>/uptime

**描述**: 获取节点 24 小时在线率

**参数**:
- `node_id` (必需, 路径参数, 整数)

**返回**: 在线率信息

**示例**:
```bash
curl http://localhost:5011/api/node/1/uptime
```

---

### GET /<node_id>/status-timeline

**描述**: 获取节点 24 小时在线状态时间轴

**参数**:
- `node_id` (必需, 路径参数, 整数)

**返回**: 时间戳和在线状态数组

**示例**:
```bash
curl http://localhost:5011/api/node/1/status-timeline
```

---

### GET /<node_id>/online_players

**描述**: 获取节点当前在线玩家列表

**参数**:
- `node_id` (必需, 路径参数, 整数)

**返回**: 玩家对象数组

**示例**:
```bash
curl http://localhost:5011/api/node/1/online_players
```

---

## 玩家 API

基础路径: `/api/player`

### GET /

**描述**: 获取所有在线玩家列表

**参数**: 无

**返回**: 玩家对象数组

**示例**:
```bash
curl http://localhost:5011/api/player
```

---

### GET /<player_name>/detail

**描述**: 获取玩家详情与当前会话

**参数**:
- `player_name` (必需, 路径参数, 字符串)

**返回**:
```json
{
  "player_name": "Steve",
  "current_session": {
    "server_id": 1,
    "server_name": "主线",
    "session_start": "2026-01-17T10:30:00+08:00",
    "session_duration_seconds": 7200
  },
  "total_playtime_seconds": 345600
}
```

**示例**:
```bash
curl http://localhost:5011/api/player/Steve/detail
```

---

### GET /<player_name>/sessions

**描述**: 获取玩家历史会话记录

**参数**:
- `player_name` (必需, 路径参数, 字符串)
- `limit` (可选, 整数, 默认=50)

**返回**: 会话对象数组，按时间降序排列

**示例**:
```bash
curl http://localhost:5011/api/player/Steve/sessions?limit=20
```

---

### GET /<player_name>/weekly-stats

**描述**: 获取玩家周统计数据

**参数**:
- `player_name` (必需, 路径参数, 字符串)

**返回**: 按日期分组的游戏时长统计

**示例**:
```bash
curl http://localhost:5011/api/player/Steve/weekly-stats
```

---

## Web 前端 API

基础路径: `/api/web`

> 这些端点专为前端优化，提供完整数据和增量更新

### GET /server

**描述**: 获取服务器的完整数据（用于首次加载）

**参数**:
- `hours` (可选, 整数, 默认=12)

**返回**: 包含聚合数据、各节点数据、统计信息的综合对象

**示例**:
```bash
curl http://localhost:5011/api/web/server?hours=24
```

---

### GET /server/head

**描述**: 获取服务器增量更新数据

**参数**:
- `hours` (可选, 整数, 默认=12)

**返回**: 最新的聚合状态点和统计数据

**用途**: WebSocket 连接后用于实时更新

**示例**:
```bash
curl http://localhost:5011/api/web/server/head
```

---

### GET /node/<node_id>

**描述**: 获取单个节点的完整数据

**参数**:
- `node_id` (必需, 路径参数)
- `hours` (可选, 整数, 默认=12)

**示例**:
```bash
curl http://localhost:5011/api/web/node/1
```

---

### GET /node/<node_id>/head

**描述**: 获取节点增量更新数据

**参数**:
- `node_id` (必需, 路径参数)
- `hours` (可选, 整数, 默认=12)

**示例**:
```bash
curl http://localhost:5011/api/web/node/1/head
```

---

## Badge API

基础路径: `/api/badge`

生成 SVG Badge，无需依赖外部服务。

### GET /server/status/<style>/<color>

**描述**: 生成服务器状态 Badge

**参数**:
- `style` (必需) - Badge 样式：`flat`, `flat-square`, `plastic`, `for-the-badge`, `social`
- `color` (必需) - 颜色名称或十六进制值

**返回**: SVG 图像 (image/svg+xml)

**示例**:
```
http://localhost:5011/api/badge/server/status/flat/brightgreen
http://localhost:5011/api/badge/server/status/flat-square/red
```

---

### GET /server/uptime/<style>/<color>

**描述**: 生成服务器在线率 Badge

**示例**:
```
http://localhost:5011/api/badge/server/uptime/flat/blue
```

---

### GET /server/players/<style>/<color>

**描述**: 生成在线玩家数 Badge

**示例**:
```
http://localhost:5011/api/badge/server/players/for-the-badge/green
```

---

### GET /node/<node_id>/status/<style>/<color>

**描述**: 生成节点状态 Badge

**示例**:
```
http://localhost:5011/api/badge/node/1/status/flat/brightgreen
```

---

### GET /node/<node_id>/uptime/<style>/<color>

**描述**: 生成节点在线率 Badge

**示例**:
```
http://localhost:5011/api/badge/node/1/uptime/flat/blue
```

---

### GET /node/<node_id>/latency/<style>/<color>

**描述**: 生成节点延迟 Badge

**示例**:
```
http://localhost:5011/api/badge/node/1/latency/flat/green
```

---

### GET /player/<player_name>/status/<style>/<color>

**描述**: 生成玩家在线状态 Badge

**示例**:
```
http://localhost:5011/api/badge/player/Steve/status/flat/brightgreen
```

---

## Exporter API

基础路径: `/api/exporter`

### GET /metrics

**描述**: 导出 Prometheus 格式指标

**参数**: 无

**返回**: Prometheus 文本格式

**用法**:
```yaml
# Prometheus scrape_configs
scrape_configs:
  - job_name: 'motdtracker'
    static_configs:
      - targets: ['127.0.0.1:5011']
    metrics_path: '/api/exporter/metrics'
    scrape_interval: 60s
```

**示例**:
```bash
curl http://localhost:5011/api/exporter/metrics
```

---

### GET /health

**描述**: 健康检查端点

**参数**: 无

**返回**:
```json
{
  "status": "healthy",
  "database": "connected",
  "poller": "running"
}
```

**用途**: 用于负载均衡器和监控系统

**示例**:
```bash
curl http://localhost:5011/api/exporter/health
```

---

## 通用参数

### 时间范围 (hours)

- **范围**: 1 - 720 小时
- **默认值**: 12 小时
- **示例**: `?hours=24`

### 时间戳格式

所有时间戳均为 **ISO 8601** 格式，**UTC+8 时区**：
```
2026-01-17T12:34:56+08:00
```

### 颜色值

支持两种格式：
1. **颜色名称**: `brightgreen`, `green`, `yellow`, `orange`, `red`, `blue`, `success`, `warning`, `danger`
2. **十六进制**: `#ff0000`, `#10b981` 等

---

## 响应格式

### 成功响应 (200)

```json
{
  "status": "success",
  "data": {...}
}
```

### 错误响应 (4xx/5xx)

```json
{
  "message": "错误描述",
  "status": 404,
  "errors": [...]
}
```

### 常见错误代码

| 代码 | 说明 |
|------|------|
| 400 | 请求参数无效 |
| 404 | 资源不存在（节点/玩家） |
| 429 | 请求过于频繁（限流） |
| 500 | 服务器内部错误 |
| 503 | 服务不可用 |

---

## WebSocket 连接

### 连接 URL

```
ws://127.0.0.1:5011/api/socket.io
```

### 监听事件

- **connect** - 连接建立
- **poll_complete** - 轮询完成（新数据可用）
- **disconnect** - 连接断开

### 示例 (JavaScript)

```javascript
const socket = io('http://127.0.0.1:5011', {
  transports: ['websocket'],
});

socket.on('poll_complete', (data) => {
  console.log('New polling data available');
  // 刷新前端数据
});
```

---

## 速率限制

当前无全局速率限制。建议调用方自行实现以下最佳实践：

- 前端轮询间隔不低于 60 秒
- WebSocket 实时更新优于 HTTP 轮询
- 按需请求数据（使用 `-compact` 端点减少传输）

---

## 常见用例

### 1. 实时监控仪表板

```javascript
// 获取完整数据
fetch('/api/web/server?hours=24')
  .then(r => r.json())
  .then(data => renderDashboard(data));

// 连接 WebSocket 实时更新
socket.on('poll_complete', () => {
  fetch('/api/web/server/head')
    .then(r => r.json())
    .then(data => updateLatestPoint(data));
});
```

### 2. Markdown README 徽章

```markdown
![Status](http://localhost:5011/api/badge/server/status/flat/brightgreen)
![Uptime](http://localhost:5011/api/badge/server/uptime/flat/blue)
![Players](http://localhost:5011/api/badge/server/players/flat/green)
```

### 3. Prometheus 监控

```yaml
global:
  scrape_interval: 60s
  
scrape_configs:
  - job_name: 'motdtracker'
    static_configs:
      - targets: ['127.0.0.1:5011']
    metrics_path: '/api/exporter/metrics'
```

---

## 支持和反馈

- 📖 [项目文档](https://github.com/PoiCraft/MotdTracker)
- 🐛 [报告问题](https://github.com/PoiCraft/MotdTracker/issues)
- 💬 [讨论](https://github.com/PoiCraft/MotdTracker/discussions)
