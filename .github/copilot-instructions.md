# MotdTracker AI Coding Instructions

## 项目概述

MotdTracker 是一个 Minecraft 服务器多入口点监控系统，通过多个节点（连接入口）监控同一台服务器，采用 Rust (Axum) 后端 + React (Vite) 前端的前后端分离架构。

**技术栈**: Axum + sqlx (SQLite) + Tokio + React + Vite + Chart.js + 原生 WebSocket

## 项目结构

```
MotdTracker/
├── src/                  # Rust 后端 (Axum)
│   ├── main.rs           # 入口 + SPA fallback
│   ├── api/              # REST + WS + Badge + Prometheus
│   ├── config/           # TOML 配置
│   ├── core/             # MC 查询 + 轮询器
│   ├── db/               # SQLite (sqlx)
│   ├── models/           # 数据模型
│   ├── utils/            # 统计、时间工具
│   ├── ws/               # WebSocket 广播
│   └── alert/            # NapCat 告警
├── tests/                # 集成测试 + 工具测试
├── frontend/             # React SPA
│   ├── src/
│   ├── vite.config.js
│   └── package.json
├── Cargo.toml
└── config.example.toml
```

## 核心架构

### 数据库层
- **Database trait** (`src/db/database_trait.rs`): async trait 定义所有数据库操作
- **SqliteDatabase** (`src/db/sqlite.rs`): sqlx + SQLite 实现，WAL 模式，5 连接池

### API 路由
所有 API 挂载在 `/api/` 前缀下，通过 Axum Router 嵌套：
- `src/api/server.rs` — `/api/server/*`
- `src/api/node.rs` — `/api/node/*`
- `src/api/player.rs` — `/api/player/*`
- `src/api/web.rs` — `/api/web/*` (前端专用一体化接口)
- `src/api/badge.rs` — `/api/badge/*` (SVG)
- `src/api/exporter.rs` — `/api/exporter/*` (Prometheus)
- `src/api/query.rs` — `/api/query` (类 SQL)

### WebSocket
- `src/ws/mod.rs` — `WsBroadcaster` 使用 `broadcast::channel(256)`
- 端点: `GET /api/ws`
- 消息: `{"event": "poll_complete", "data": {"timestamp": "..."}}`
- 前端: `useWebSocket` hook (原生 WebSocket API + 自动重连)

### 轮询器
- `src/core/poller.rs` — `ServerPoller` 使用 `JoinSet` 并行查询所有节点
- 共享时间戳，轮询完成后广播 WS 事件 + 检查 NapCat 告警

## 关键开发约定

### 时区处理
**全局 UTC+8**: 使用 `src/utils/time.rs` 中的工具函数。

### 配置
配置文件 `config.toml`（不提交），格式：
```toml
server_name = "MyServer"

[database]
path = "data/motdtracker.db"

poll_interval = 60
port = 5011

[[nodes]]
id = 1
name = "Node"
host = "play.example.com"
port = 25565
enable = true
```

### 前端静态文件
后端从 `frontend/dist/` 提供静态文件。SPA fallback 返回 `index.html`。

### 前端开发
```bash
# 终端 1
cargo run

# 终端 2
cd frontend && npm run dev
```
Vite 自动代理 `/api` 到 `http://127.0.0.1:5011`。

## 测试

```bash
cargo test              # 27 个测试
cargo clippy            # lint
```

## 重要文件索引

- **配置**: `config.toml` (不提交), `config.example.toml`
- **入口**: `src/main.rs`
- **数据库**: `src/db/database_trait.rs` (接口), `src/db/sqlite.rs` (实现)
- **前端入口**: `frontend/src/App.jsx`
