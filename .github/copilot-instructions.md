# MotdTracker AI Coding Instructions

## 项目概述

MotdTracker 是一个 Minecraft 多服务器多入口点监控系统，支持通过服务器组管理多台 Minecraft 服务器，每组可配置多个连接入口节点。采用 Rust (Axum) 后端 + React (Vite) 前端的纯数据库配置架构。

**技术栈**: Axum + sqlx (SQLite) + Tokio + React + Vite + Chart.js + 原生 WebSocket

## 项目结构

```
MotdTracker/
├── src/                  # Rust 后端 (Axum)
│   ├── main.rs           # 入口 + SPA fallback
│   ├── api/              # REST + WS + Badge + Prometheus + Admin
│   ├── auth/             # 管理员认证 (Argon2 + UUID token)
│   ├── config/           # 最小启动配置 (port + db path)
│   ├── core/             # MC 查询 + 轮询器
│   ├── db/               # SQLite (sqlx)
│   ├── models/           # 数据模型
│   ├── utils/            # 统计、时间工具
│   ├── ws/               # WebSocket 广播
│   └── alert/            # Webhook 告警
├── tests/                # 集成测试 + 工具测试
├── frontend/             # React SPA
│   ├── src/
│   ├── vite.config.js
│   └── package.json
├── Cargo.toml
└── config.example.toml   # 极简启动配置 (仅 port + database)
```

## 核心架构

### 配置模型
- **启动配置**: `config.toml` 只包含 `port` 和 `database.path`，可通过 `MOTDTRACKER_*` 环境变量覆盖
- **业务配置**: 所有服务器/节点/告警配置存储在 SQLite 数据库中，通过 Web 管理面板管理
- **优先级**: 数据库（Web 面板）> 环境变量 > 配置文件 > 默认值
- TUI 配置向导已移除；首次启动访问 `/login` 初始化管理员

### 数据库层
- **Database trait** (`src/db/database_trait.rs`): async trait 定义所有数据库操作
- **SqliteDatabase** (`src/db/sqlite.rs`): sqlx + SQLite 实现，WAL 模式，5 连接池
- **核心表**: `server_groups`, `servers` (nodes), `status_logs`, `player_sessions`, `admin_users`, `admin_sessions`, `app_config`, `node_config`

### 服务器组架构
- `server_groups`: 服务器组 (id, name, sort_order)
- `servers`: 节点 (id, name, host, port, edition, color, enabled, group_id FK)
- 节点可通过管理面板分配到组；侧边栏下拉框切换组过滤
- API 支持 `?group_id=X` 过滤 (web/server/player)

### API 路由
- `src/api/admin.rs` — `/api/admin/*` (认证管理 + 设置 + 节点 + 服务器组 CRUD)
- `src/api/server.rs` — `/api/server/*`
- `src/api/node.rs` — `/api/node/*`
- `src/api/player.rs` — `/api/player/*`
- `src/api/web.rs` — `/api/web/*` (前端一体化接口)
- `src/api/badge.rs` — `/api/badge/*` (SVG)
- `src/api/exporter.rs` — `/api/exporter/*` (Prometheus)
- `src/api/query.rs` — `/api/query` (类 SQL)

### 认证系统
- `src/auth/password.rs` — Argon2 密码哈希/验证
- `src/auth/token.rs` — UUID v4 会话令牌
- 单一管理员角色；`/api/admin/*` 需 Bearer token
- 前端: `AuthProvider` context + localStorage token

### WebSocket
- `src/ws/mod.rs` — `WsBroadcaster` 使用 `broadcast::channel(256)`
- 端点: `GET /api/ws`
- 消息: `{"event": "poll_complete", "data": {"timestamp": "..."}}`

### 轮询器
- `src/core/poller.rs` — `ServerPoller` 每轮从 DB 读取启用节点和 webhook 配置（即刻生效）

## 前端架构
- **状态管理**: AuthProvider (认证), ServerGroupProvider (组选择), WebSocketProvider
- **路由**: `/`, `/server`, `/nodes`, `/nodes/:nodeId`, `/players`, `/players/:playerName`, `/badges`, `/login`, `/admin`
- **组件**: Layout (侧边栏+顶部), MetricCard, MetricGrid, ResponsiveChartCard, HeatStrip, StatusPill

## 关键开发约定

### 时区处理
**全局 UTC+8**: 使用 `src/utils/time.rs` 中的工具函数。

### 配置
配置文件 `config.toml` 极简，仅含启动必需项：
```toml
port = 5011
[database]
path = "data/motdtracker.db"
```

### 环境变量覆盖
- `MOTDTRACKER_PORT` — Web 服务端口
- `MOTDTRACKER_DATABASE_PATH` — SQLite 数据库路径
- `MOTDTRACKER_CORS_ORIGIN` — CORS 允许的源（空=禁止跨域，`*`=允许任意，或指定域名）

### 测试

```bash
cargo test              # 所有测试
cd frontend && npm run build  # 前端构建
```

## 重要文件索引

- **配置**: `config.example.toml`, `src/config/loader.rs`
- **入口**: `src/main.rs`
- **数据库**: `src/db/database_trait.rs` (接口), `src/db/sqlite.rs` (实现)
- **认证**: `src/auth/password.rs`, `src/auth/token.rs`, `src/api/admin.rs`
- **前端入口**: `frontend/src/App.jsx`

