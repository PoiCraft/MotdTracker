# MotdTracker RESTful API 设计方案

> 2026-06-05 · 基于新数据模型 `server_groups → servers → nodes` 设计  
> **本文档仅做方案设计，不做任何代码修改。**

---

## 设计原则

1. **URL 层级反映数据模型**：`/api/groups/{gid}/servers/{sid}/nodes/{nid}`
2. **所有实体 ID 为 UUID 字符串**，不再有 i32 ID
3. **全局过滤**：所有列表端点可选 `?group_id=UUID` 过滤到指定服务器组
4. **认证**：`/api/admin/*` 需 Bearer token；其余端点公开
5. **旧接口全部删除**：移除 `/api/server/*`、`/api/node/*`、`/api/web/*`、`/api/query`、`/api/pages`
6. **前端聚合**：前端通过组合多个 RESTful 端点获取数据，不再需要 `/api/web/*` 聚合端点

---

## 删除的旧端点

| 旧端点 | 原因 |
|--------|------|
| `GET /api/server/*` | 扁平节点 API，被 `/api/nodes` 替代 |
| `GET /api/node/*` | 不符合 RESTful 层级 |
| `GET /api/web/*` | 聚合端点，前端自行组合即可 |
| `GET /api/query` | 类 SQL 查询，安全风险大 |
| `GET /api/pages/*` | 未使用的端点 |

---

## 新 API 端点总览

### 1. 公开端点（无需认证）

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/status` | 服务状态（版本、运行时间、节点/服务器/组数量） |
| `GET` | `/api/groups` | 所有服务器组列表 |
| `GET` | `/api/groups/{group_id}` | 单个组详情（含其下 servers 摘要） |
| `GET` | `/api/servers` | 所有服务器列表 `?group_id=UUID` 过滤 |
| `GET` | `/api/servers/{server_id}` | 单个服务器详情（含其下 nodes 摘要） |
| `GET` | `/api/servers/{server_id}/history` | 服务器下所有节点的历史聚合 |
| `GET` | `/api/nodes` | 所有节点列表 `?group_id=UUID` `?server_id=UUID` |
| `GET` | `/api/nodes/{node_id}` | 单个节点详情 + 最新状态 |
| `GET` | `/api/nodes/{node_id}/history` | 单个节点的状态历史 `?hours=24` |
| `GET` | `/api/players` | 所有玩家列表 `?group_id=UUID` |
| `GET` | `/api/players/{name}` | 单个玩家详情（含 server/node 出现记录 + session 历史） |
| `GET` | `/api/players/{name}/sessions` | 玩家历史会话 `?days=30` |
| `GET` | `/api/players/{name}/heatmap` | 玩家活跃热力图 `?days=30` |
| `GET` | `/api/badges/groups/{group_id}/status` | 组状态徽章 SVG |
| `GET` | `/api/badges/servers/{server_id}/status` | 服务器状态徽章 SVG |
| `GET` | `/api/badges/servers/{server_id}/uptime` | 服务器在线率徽章 `?hours=24` |
| `GET` | `/api/badges/servers/{server_id}/players` | 服务器在线玩家数徽章 |
| `GET` | `/api/badges/nodes/{node_id}/status` | 节点状态徽章 |
| `GET` | `/api/badges/nodes/{node_id}/latency` | 节点延迟徽章 |
| `GET` | `/api/badges/nodes/{node_id}/players` | 节点玩家数徽章 |
| `GET` | `/api/badges/nodes/{node_id}/uptime` | 节点在线率徽章 `?hours=24` |
| `GET` | `/api/badges/players/{name}/status` | 玩家在线状态徽章 |
| `GET` | `/api/exporter/health` | 健康检查 |
| `GET` | `/api/exporter/metrics` | Prometheus 指标 |
| `WS` | `/api/ws` | WebSocket 实时推送 |

### 2. 管理端点（需 Bearer token）

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/admin/setup` | 首次初始化管理员 |
| `POST` | `/api/admin/login` | 管理员登录 |
| `POST` | `/api/admin/logout` | 管理员登出 |
| `POST` | `/api/admin/change-password` | 修改密码 |
| `GET` | `/api/admin/status` | 是否已初始化管理员 |
| `GET` | `/api/admin/settings` | 获取应用设置 |
| `PUT` | `/api/admin/settings` | 更新应用设置 |
| `POST` | `/api/admin/apply` | 应用配置（触发轮询器重启） |
| `GET` | `/api/admin/config-status` | 配置同步状态 |
| `GET` | `/api/admin/groups` | 所有组（含其下 servers/nodes 列表） |
| `POST` | `/api/admin/groups` | 创建组 |
| `PUT` | `/api/admin/groups/{group_id}` | 更新组 |
| `DELETE` | `/api/admin/groups/{group_id}` | 删除组 |
| `GET` | `/api/admin/servers` | 所有服务器列表 |
| `POST` | `/api/admin/servers` | 创建服务器 |
| `PUT` | `/api/admin/servers/{server_id}` | 更新服务器（含分组变更） |
| `DELETE` | `/api/admin/servers/{server_id}` | 删除服务器 |
| `GET` | `/api/admin/nodes` | 所有节点列表 |
| `POST` | `/api/admin/nodes` | 创建节点 |
| `PUT` | `/api/admin/nodes/{node_id}` | 更新节点（含 server 变更） |
| `DELETE` | `/api/admin/nodes/{node_id}` | 删除节点 |
| `POST` | `/api/admin/nodes/{node_id}/move-up` | 节点排序上移 |
| `POST` | `/api/admin/nodes/{node_id}/move-down` | 节点排序下移 |

---

## 响应数据结构

### 服务器组 `GET /api/groups`

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "生产环境",
    "sort_order": 0,
    "server_count": 3,
    "online_node_count": 5,
    "total_node_count": 5,
    "total_players_online": 42
  }
]
```

### 服务器 `GET /api/servers/{server_id}`

```json
{
  "id": "660e8400-e29b-41d4-a716-446655440001",
  "group_id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "主生存服",
  "sort_order": 0,
  "nodes": [
    {
      "id": "770e8400-e29b-41d4-a716-446655440002",
      "name": "主入口",
      "host": "play.example.com",
      "port": 25565,
      "edition": "java",
      "enabled": true,
      "latest_status": { "online": true, "latency": 45.5, "players_online": 12, "players_max": 100, "timestamp": "2026-06-05T15:30:00+08:00" }
    }
  ],
  "aggregate_status": {
    "total_nodes": 2,
    "online_nodes": 2,
    "total_players_online": 20,
    "total_players_max": 200,
    "all_online": true,
    "avg_latency": 42.3
  }
}
```

### 节点 `GET /api/nodes/{node_id}`

```json
{
  "id": "770e8400-e29b-41d4-a716-446655440002",
  "server_id": "660e8400-e29b-41d4-a716-446655440001",
  "name": "主入口",
  "host": "play.example.com",
  "port": 25565,
  "edition": "java",
  "color": "#4caf50",
  "enabled": true,
  "sort_order": 0,
  "latest_status": {
    "timestamp": "2026-06-05T15:30:00+08:00",
    "online": true,
    "latency": 45.5,
    "players_online": 12,
    "players_max": 100,
    "version": "1.21.4",
    "motd": "Welcome to My Server!"
  },
  "latency_stats": {
    "uptime_percentage": 99.8,
    "avg_latency": 42.1,
    "min_latency": 15.0,
    "max_latency": 200.0,
    "p95_latency": 80.0,
    "std_dev": 12.5,
    "cv": 0.3
  }
}
```

### 玩家 `GET /api/players/{name}`

```json
{
  "player_name": "Steve",
  "online": true,
  "session_start": "2026-06-05T14:00:00+08:00",
  "last_seen": "2026-06-05T15:30:00+08:00",
  "duration_seconds": 5400,
  "appearances": [
    {
      "node_id": "770e8400-...",
      "node_name": "主入口",
      "server_id": "660e8400-...",
      "server_name": "主生存服",
      "online": true,
      "first_seen": "2026-01-01T10:00:00+08:00",
      "last_seen": "2026-06-05T15:30:00+08:00"
    }
  ],
  "sessions": [
    {
      "server_id": "660e8400-...",
      "player_name": "Steve",
      "session_start": "2026-06-05T14:00:00+08:00",
      "session_end": null
    }
  ]
}
```

### 节点历史 `GET /api/nodes/{node_id}/history?hours=24`

```json
[
  {
    "id": 12345,
    "node_id": "770e8400-...",
    "timestamp": "2026-06-05T15:00:00+08:00",
    "online": true,
    "latency": 45.5,
    "players_online": 12,
    "players_max": 100,
    "version": "1.21.4",
    "motd": "Welcome!"
  }
]
```

### WebSocket `WS /api/ws`

```json
{
  "event": "poll_complete",
  "data": {
    "timestamp": "2026-06-05T15:30:00+08:00"
  }
}
```

> 前端收到此事件后，根据当前 `selectedGroupId` / `selectedServerId` 重新请求对应端点。

---

## 前端数据流

```
App 启动
  → GET /api/status         了解全局状态（需要登录吗？）
  → GET /api/groups          获取组列表 → 填充 ServerGroupProvider
  → 默认 selectedGroupId == null (全部)
  → ServerPage:
       GET /api/servers?group_id={selectedGroupId}
       对每个 server 取 aggregate_status
       GET /api/nodes?group_id={selectedGroupId}
  → NodesPage:
       GET /api/nodes?group_id={selectedGroupId}
  → PlayersPage:
       GET /api/players?group_id={selectedGroupId}
```

**用户切换组后**：`ServerGroupProvider` 触发所有页面用新 `selectedGroupId` 重新 fetch。

---

## 文件映射

| 新文件 | 内容 | 替代的旧文件 |
|--------|------|-------------|
| `src/api/groups.rs` | `/api/groups/*` | `src/api/server.rs` (部分) |
| `src/api/servers.rs` | `/api/servers/*` | 新文件 |
| `src/api/nodes.rs` | `/api/nodes/*` | `src/api/node.rs` + `src/api/web.rs` (部分) |
| `src/api/players.rs` | `/api/players/*` | `src/api/player.rs` |
| `src/api/badges.rs` | `/api/badges/*` | `src/api/badge.rs` (重构) |
| `src/api/exporter.rs` | `/api/exporter/*` (重写) | `src/api/exporter.rs` (重写) |
| `src/api/admin.rs` | `/api/admin/*` | 保留至，补充 server CRUD |
| `src/api/status.rs` | `GET /api/status` | 新文件 |
| `src/api/ws.rs` | `GET /api/ws` (handler 迁移) | `src/api/mod.rs` 中的 ws_handler |

### 删除的文件

- `src/api/server.rs` → 功能分散到 `groups.rs` / `servers.rs` / `nodes.rs`
- `src/api/node.rs` → 合并到 `nodes.rs`
- `src/api/web.rs` → 不再需要聚合，前端自行组合
- `src/api/player.rs` → 重命名为 `players.rs`（RESTful 命名）
- `src/api/query.rs` → 删除
- `src/api/pages.rs` → 删除

---

## 实施顺序

1. **创建新的 API 文件骨架**（status, groups, servers, nodes, players, badges, exporter, ws）
2. **重构 admin.rs** 补充 server CRUD
3. **更新 `src/api/mod.rs`** 注册所有新路由
4. **更新 `src/main.rs`** 挂载新路由
5. **删除旧 API 文件**
6. **更新前端 `api.js`** 对应新端点
7. **更新前端各页面** 的数据获取方式
8. **编译 + 测试**
