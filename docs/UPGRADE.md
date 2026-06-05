# MotdTracker v1 → v2 升级指南

> 适用版本：从旧版"全局单服务器 + 扁平节点列表"升级至"多服务器 + 每服多节点"层级模型。

## 概述

v2 引入了以下核心变更：

- **数据模型**：从单服务器扁平结构改为 `server_groups → servers → nodes` 三级层级
- **主键类型**：所有表主键从 `INTEGER` 改为 `TEXT` UUID
- **配置存储**：移除 TUI，所有配置（包括 `server_name`、`webhook_alert`、`poll_interval`）存入数据库 `app_config` KV 表
- **认证系统**：新增 Argon2 + UUID Token 管理员认证
- **告警系统**：新增 Webhook 告警（支持自定义 URL/Headers/Body + 模板变量）

## 升级步骤

### 1. 备份数据

```bash
cp data/motdtracker.db data/motdtracker.db.v1.backup
```

### 2. 更新代码 / 拉取最新版本

```bash
git pull origin main
# 或重新构建 Docker 镜像
docker build -t motdtracker:v2 .
```

### 3. 数据库迁移

v2 的 `SqliteDatabase::init_database()` 会自动创建新表结构。对于已有数据，需要手动迁移：

#### 3.1 导出旧节点数据

使用任意 SQLite 客户端连接旧数据库，导出旧 `servers` 表：

```sql
-- 旧表结构（v1）
-- servers(id INTEGER PK, name TEXT, host TEXT, port INTEGER, edition TEXT, color TEXT, enabled INTEGER, sort_order INTEGER)

SELECT id, name, host, port, edition, color, enabled, sort_order FROM servers WHERE enabled = 1;
```

#### 3.2 创建默认服务器组与服务器

启动 v2 后，先完成管理员初始化（访问 Web UI 按提示创建管理员）。

然后在 **AdminPage → 服务器组** 中创建至少一个组（如 `Default`）。

在 **AdminPage → 服务器管理** 中创建至少一个服务器（如 `Main Server`），并关联到组。

记下新建服务器的 UUID（在节点管理页面的服务器选择器或浏览器网络请求中可见）。

#### 3.3 重新添加节点

在 **AdminPage → 节点管理** 中，将旧节点逐一添加，选择对应的服务器。

或者通过直接 SQL 插入（适合批量迁移）：

```sql
-- 假设旧数据库已附加为 old_db
-- 新表：nodes(id TEXT PK, server_id TEXT FK, name, host, port, edition, color, enabled, sort_order, created_at, updated_at)

INSERT INTO nodes (id, server_id, name, host, port, edition, color, enabled, sort_order, created_at, updated_at)
SELECT
  lower(hex(randomblob(16))),  -- 生成新 UUID
  'YOUR_SERVER_UUID_HERE',      -- 替换为步骤 3.2 创建的服务器 UUID
  name, host, port, edition, color, enabled, sort_order,
  datetime('now'), datetime('now')
FROM old_db.servers;
```

> ⚠️ **注意**：`status_logs`、`player_sessions`、`player_session_history` 中的旧 `server_id`（INTEGER）无法直接映射到新 UUID，建议：
> - 方案 A（推荐）：接受历史数据清空，v2 重新收集（最简单）。
> - 方案 B：手动编写映射脚本，将旧 `servers.id` → 新 `servers.id` 建立映射，再批量更新历史表中的外键。

#### 3.4 迁移旧的历史状态数据（可选）

如果你选择保留历史数据，可以：

```sql
-- 将旧 status_logs 的 server_id (INTEGER) 映射到新的 node_id (TEXT UUID)
-- 需要先建立旧 servers.id → 新 nodes.id 的映射表
```

由于 v1 的 `status_logs` 按旧 `servers.id`（现在变为 `nodes`）记录，如果你需要保留图表历史，建议编写一次性脚本完成映射。

### 4. 配置迁移

v2 的配置不再通过 `config.toml` 或 TUI 管理，而是通过 **AdminPage → 基本设置** 或 API 管理。

启动后访问 `/admin`，在基本设置中填写：

- **Server Name**：站点标题
- **Poll Interval**：轮询间隔（秒）
- **Port**：服务端口（也可通过环境变量 `MOTDTRACKER_PORT` 覆盖）

点击**保存并应用**即可生效。

环境变量仍可用作覆盖：

```bash
MOTDTRACKER_PORT=8080
MOTDTRACKER_DATABASE_PATH=/data/motdtracker.db
MOTDTRACKER_POLL_INTERVAL=60
```

### 5. Webhook 告警配置

在 **AdminPage → 基本设置 → Webhook 告警** 中配置：

- URL、Method、Headers、Body 模板
- 支持模板变量：`{{server_name}}`、`{{online_count}}`、`{{total_count}}`、`{{timestamp}}`
- `delta_minutes`：同一状态重复通知的最小间隔
- `offline_confirm_frames` / `online_confirm_frames`：状态确认帧数（防止抖动）

### 6. 验证

```bash
# 后端编译检查
cargo check

# 运行集成测试
cargo test

# 前端构建
cd frontend && npm run build

# 启动服务
cargo run
```

访问：
- 公开面板：`http://localhost:8080/dashboard`
- 管理后台：`http://localhost:8080/admin`
- WebSocket 实时更新：`ws://localhost:8080/api/ws`

### 7. 清理旧文件

升级完成后，可以安全删除以下旧文件（如存在）：

- `src/tui/`（TUI 模块，v2 已移除）
- `config.toml` 中的业务配置项（保留 `database` / `poll_interval` / `port` 即可）
- 旧 `servers` 数字 ID 相关脚本

## 常见问题

**Q: 旧的前端书签还能用吗？**
A: 旧路由 `/server/:id` 已移除，请使用新的 `/servers/:serverId` 和 `/nodes/:nodeId`。

**Q: 徽章 URL 有变化吗？**
A: `/api/badges/*` 端点已适配 UUID，旧徽章链接需要更新为新的节点/服务器 ID。

**Q: Prometheus Exporter 有变化吗？**
A: `/api/exporter/*` 已适配新模型，指标标签中 `server_id` 现为 UUID 字符串。

## 回滚

若升级失败，停止服务并恢复备份：

```bash
cp data/motdtracker.db.v1.backup data/motdtracker.db
# 回退到旧版本代码/镜像
git checkout v1.x
```
