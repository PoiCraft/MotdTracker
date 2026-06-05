# MotdTracker 数据库架构设计

## 概述

**核心设计原则**：
- 所有实体主键使用 **UUID v4**（`server_groups`, `servers`, `nodes` 均为 TEXT 类型）
- 旧版数字 ID 表在重构后完全移除
- 三层架构：`server_groups` → `servers` → `nodes`
- 玩家数据：每节点独立记录原始在线情况（`player_sessions`），按服务器聚合为历史时段（`player_session_history`）

## 实体关系图

```
server_groups  ──1:N──▶  servers  ──1:N──▶  nodes  ──1:N──▶  status_logs
                                        │              └──▶  player_sessions（每节点独立记录）
                                        │
                                        └──1:N──▶  player_session_history（按 server 聚合）
```

## 表定义

### 1. server_groups（服务器组）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | TEXT | PRIMARY KEY (UUID v4) | 组 ID |
| `name` | TEXT | NOT NULL | 组名称 |
| `sort_order` | INTEGER | NOT NULL DEFAULT 0 | 排序序号 |
| `created_at` | DATETIME | NOT NULL DEFAULT (datetime('now')) | 创建时间 |
| `updated_at` | DATETIME | NOT NULL DEFAULT (datetime('now')) | 更新时间 |

### 2. servers（MC 服务器实例）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | TEXT | PRIMARY KEY (UUID v4) | 服务器 ID |
| `group_id` | TEXT | FOREIGN KEY → server_groups.id, NULLABLE | 所属组 |
| `name` | TEXT | NOT NULL | 服务器名称 |
| `sort_order` | INTEGER | NOT NULL DEFAULT 0 | 排序序号 |
| `created_at` | DATETIME | NOT NULL DEFAULT (datetime('now')) | 创建时间 |
| `updated_at` | DATETIME | NOT NULL DEFAULT (datetime('now')) | 更新时间 |

### 3. nodes（连接入口/节点）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | TEXT | PRIMARY KEY (UUID v4) | 节点 ID |
| `server_id` | TEXT | FOREIGN KEY → servers.id, NOT NULL | 所属服务器 |
| `name` | TEXT | NOT NULL | 节点名称 |
| `host` | TEXT | NOT NULL | 节点地址 |
| `port` | INTEGER | NOT NULL | 节点端口 |
| `edition` | TEXT | NOT NULL DEFAULT 'java' | 版本类型（java/bedrock） |
| `color` | TEXT | NULLABLE | 图表颜色 |
| `enabled` | INTEGER | NOT NULL DEFAULT 1 | 是否启用（0/1） |
| `sort_order` | INTEGER | NOT NULL DEFAULT 0 | 排序序号 |
| `created_at` | DATETIME | NOT NULL DEFAULT (datetime('now')) | 创建时间 |
| `updated_at` | DATETIME | NOT NULL DEFAULT (datetime('now')) | 更新时间 |

### 4. status_logs（状态日志）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | 记录 ID |
| `node_id` | TEXT | FOREIGN KEY → nodes.id, NOT NULL | 节点 ID |
| `timestamp` | DATETIME | NOT NULL | 记录时间 (UTC+8) |
| `online` | INTEGER | NOT NULL | 是否在线（0/1） |
| `latency` | REAL | NULLABLE | 延迟（毫秒） |
| `players_online` | INTEGER | NULLABLE | 在线玩家数 |
| `players_max` | INTEGER | NULLABLE | 最大玩家数 |
| `version` | TEXT | NULLABLE | 服务器版本 |
| `motd` | TEXT | NULLABLE | MOTD 文本 |
| `sample_players` | TEXT | NULLABLE | 玩家样本（JSON） |
| `software` | TEXT | NULLABLE | 服务端软件 |
| `plugins` | TEXT | NULLABLE | 插件列表（JSON） |
| `map` | TEXT | NULLABLE | 地图名称 |
| `edition` | TEXT | NULLABLE | 版本类型 |

索引：`idx_status_logs_timestamp`, `idx_status_logs_node_id`

### 5. player_sessions（玩家会话 - 每节点独立记录）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | 记录 ID |
| `node_id` | TEXT | FOREIGN KEY → nodes.id, NOT NULL | 节点 ID |
| `player_name` | TEXT | NOT NULL | 玩家名称 |
| `first_seen` | DATETIME | NOT NULL | 首次出现时间 |
| `session_start` | DATETIME | NULLABLE | 当前会话开始时间 |
| `last_seen` | DATETIME | NOT NULL | 最后在线时间 |
| `online` | INTEGER | NOT NULL DEFAULT 0 | 是否在线（0/1） |
| `duration_seconds` | INTEGER | NULLABLE | 会话时长（秒） |

约束：`UNIQUE(node_id, player_name)`
索引：`idx_player_sessions_player_name`

### 6. player_session_history（玩家历史会话 - 按 server 聚合时段）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | 记录 ID |
| `server_id` | TEXT | FOREIGN KEY → servers.id, NOT NULL | 服务器 ID |
| `player_name` | TEXT | NOT NULL | 玩家名称 |
| `session_start` | DATETIME | NOT NULL | 会话开始时间 |
| `session_end` | DATETIME | NOT NULL | 会话结束时间 |

索引：`idx_player_session_history_player_name`, `idx_player_session_history_server_id`

### 7. admin_users（管理员）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | 用户 ID |
| `username` | TEXT | NOT NULL UNIQUE | 用户名 |
| `password_hash` | TEXT | NOT NULL | Argon2 密码哈希 |
| `created_at` | DATETIME | NOT NULL DEFAULT (datetime('now')) | 创建时间 |
| `last_login_at` | DATETIME | NULLABLE | 最后登录时间 |

### 8. admin_sessions（管理员会话）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | 会话 ID |
| `user_id` | INTEGER | FOREIGN KEY → admin_users.id ON DELETE CASCADE | 用户 ID |
| `token` | TEXT | NOT NULL UNIQUE | UUID 会话令牌 |
| `expires_at` | DATETIME | NOT NULL | 过期时间 |
| `created_at` | DATETIME | NOT NULL DEFAULT (datetime('now')) | 创建时间 |

索引：`idx_admin_sessions_token`

### 9. app_config（应用配置 KV）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `key` | TEXT | PRIMARY KEY | 配置键 |
| `value` | TEXT | NOT NULL | 配置值 |
| `updated_at` | DATETIME | NOT NULL DEFAULT (datetime('now')) | 更新时间 |

## 数据流

```
poller 启动
  → 读 app_config 获取 poll_interval
  → 读 nodes WHERE enabled=1 获取所有启用节点
  → 对每个 node 执行 MC 查询
     → 写入 status_logs（node_id）
     → 更新 player_sessions（node_id, player_name）— 每节点独立记录
  → 聚合所有 node 的 player_sessions 数据
     → 按 server_id 分组
     → 若某玩家在某个 server 的所有 node 中都不在线 → 写入 player_session_history
  → WebSocket broadcast poll_complete
  → 检查 webhook_alert 配置并发送告警
```

## 关键设计决策

1. **player_sessions 按 node 记录**：保留最细粒度的原始数据，便于排查单节点异常
2. **player_session_history 按 server 聚合**：同一玩家在同一 server 的多个 node 入口出现视为同一会话
3. **server_id 在 player_session_history 中为 TEXT FK**：与 servers.id (UUID) 对齐
4. **旧 servers 表完全移除**：新版 nodes 表使用 UUID 主键，不再保留数字 ID 兼容
