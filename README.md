# MotdTracker

<div align="center">

**Minecraft 多节点服务器监控面板**

Rust 高性能后端 + React 前端 | 同时保留 Python/Flask 遗留后端

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Rust](https://img.shields.io/badge/Rust-1.75+-orange.svg)](https://www.rust-lang.org/)
[![Python 3.13+](https://img.shields.io/badge/Python-3.13+-blue.svg)](https://www.python.org/)
[![React 18](https://img.shields.io/badge/React-18-61dafb.svg)](https://react.dev/)

</div>

---

## 简介

MotdTracker 是一个专为 Minecraft 服务器设计的多节点实时监控系统。项目提供两套后端实现：

| 后端 | 语言 | 框架 | 说明 |
|------|------|------|------|
| **motdtracker-rs** (推荐) | Rust | Axum + sqlx | 高性能、低内存、原生 WebSocket |
| Python (遗留) | Python | Flask + Flask-SocketIO | 原始实现，含 GraphQL、Swagger UI |

React 前端 (`frontend/`) 使用原生 WebSocket 通信，**仅兼容 Rust 后端**。Python 后端仍保留自带的 Jinja2 HTML 模板页面。

### 功能特性

- 🚀 **实时监控** - 原生 WebSocket 推送，轮询完成后自动增量刷新
- 📊 **数据可视化** - Chart.js 趋势图 + 24h 热力图 + 周活跃热力图
- 👥 **玩家追踪** - 会话管理、在线时长统计、每日/每周/每小时分析
- 📈 **延迟分析** - 统计指标（平均/标准差/P95/CV）
- 🔌 **Prometheus 集成** - 节点级指标导出
- 🏷️ **Badge 生成** - SVG 状态徽章（服务器/节点/玩家）
- 💾 **灵活存储** - SQLite (默认) / PostgreSQL (可选)
- 📱 **NapCat 告警** - QQ 群机器人实时告警通知

---

## 快速开始

### 方式一：Rust 后端 + React 前端（推荐）

#### 1. 构建 Rust 后端

```bash
cd motdtracker-rs

# 开发构建
cargo build

# 或发布构建（启用 LTO 优化）
cargo build --release
```

#### 2. 配置

```bash
cp config.example.toml config.toml
```

编辑 `config.toml`：

```toml
server_name = "我的服务器"
database = "minecraft_stats.db"
poll_interval = 15
port = 5011

[[nodes]]
id = 1
name = "主线入口"
host = "play.example.com"
port = 25565
color = "#10b981"
enable = true

[[nodes]]
id = 2
name = "备用线路"
host = "backup.example.com"
port = 25565
color = "#667eea"
enable = true
```

#### 3. 构建前端

```bash
cd frontend
npm install
npm run build
```

构建产物输出到 `frontend/dist/`，Rust 后端会自动从该目录提供静态文件和 SPA 路由。

#### 4. 启动

```bash
cd motdtracker-rs
cargo run --release
```

访问 <http://127.0.0.1:5011> 查看监控面板。

#### 开发模式

前后端分离开发时，可使用 Vite 开发服务器实现热更新：

```bash
# 终端 1：启动 Rust 后端
cd motdtracker-rs
cargo run

# 终端 2：启动 Vite 开发服务器
cd frontend
npm run dev
```

Vite 会自动将 `/api` 请求代理到 `http://127.0.0.1:5011`（含 WebSocket 支持），访问 <http://127.0.0.1:5173>。

---

### 方式二：Python 后端（遗留）

Python 后端仍可独立运行，自带 Jinja2 HTML 模板页面。

#### 1. 安装依赖

```bash
# 推荐使用 uv
uv sync

# 或使用 pip
pip install -e .
```

#### 2. 配置

同上，编辑 `config.toml`。

#### 3. 启动

```bash
uv run main.py
```

访问 <http://127.0.0.1:5011> 查看监控面板。

> **注意**：React 前端使用原生 WebSocket 通信，**不兼容** Python 后端的 Socket.IO 协议。Python 后端请使用自带的 HTML 模板页面，或在 `config.toml` 中设置 `api_only = true` 并使用独立的 React 前端开发服务器（此时 WebSocket 功能不可用）。

---

## 项目结构

```
MotdTracker/
├── motdtracker-rs/           # Rust 后端（推荐）
│   ├── Cargo.toml
│   └── src/
│       ├── main.rs           # Axum 服务器入口 + SPA fallback
│       ├── api/              # REST API + WebSocket + Badge + Prometheus
│       ├── config/           # TOML 配置加载
│       ├── core/             # Minecraft 查询 + 轮询调度
│       ├── db/               # 数据库抽象 trait + SQLite 实现
│       ├── models/           # 数据模型
│       ├── utils/            # 统计计算、时间工具
│       ├── ws/               # 原生 WebSocket 广播
│       └── alert/            # NapCat QQ 告警
│
├── frontend/                 # React SPA（仅兼容 Rust 后端）
│   ├── src/
│   │   ├── pages/            # ServerPage, NodesPage, PlayersPage, BadgesPage
│   │   ├── components/       # Layout, MetricCard, StatusPill
│   │   ├── utils/            # charts, format, ws（原生 WebSocket hook）
│   │   └── api.js            # Fetch 封装
│   ├── vite.config.js
│   └── package.json
│
├── main.py                   # Python 后端入口（遗留）
├── core/                     # Python 监控核心
├── db/                       # Python 数据库层（SQLite/PostgreSQL）
├── routes/                   # Python Flask 路由
├── utils/                    # Python 工具函数
├── templates/                # Jinja2 HTML 模板（Python 后端用）
├── static/                   # 静态资源（Python 后端用）
├── config.toml               # 共用配置文件
├── config.example.toml       # 配置示例
├── RUST_REFACTOR_PROGRESS.md # Rust 重构进度文档
└── REFACTOR_SUMMARY.md       # 重构总结
```

---

## API 端点

### Web 前端专用接口

| 端点 | 描述 |
|------|------|
| `GET /api/web/server?hours=N` | 服务器页面完整数据 |
| `GET /api/web/server/head?hours=N` | 服务器增量更新（含 `latest_history_point`） |
| `GET /api/web/node/:id?hours=N` | 节点页面完整数据 |
| `GET /api/web/node/:id/head?hours=N` | 节点增量更新 |

### 服务器 / 节点 / 玩家

| 端点 | 描述 |
|------|------|
| `GET /api/server/nodes` | 所有节点及 24h 统计 |
| `GET /api/node/:id` | 单个节点详情 |
| `GET /api/player` | 所有玩家列表（聚合去重） |
| `GET /api/player/:name/detail` | 玩家详情 |
| `GET /api/player/:name/sessions?days=N` | 玩家会话热力图 + 每日统计 + 每小时平均 |
| `GET /api/player/:name/weekly-stats` | 玩家周活跃热力图 + 星期偏好 |

### Badge (SVG)

| 端点 | 描述 |
|------|------|
| `GET /api/badge/server/status` | 服务器状态 |
| `GET /api/badge/server/uptime?hours=N` | 服务器在线率 |
| `GET /api/badge/server/players` | 在线玩家数 |
| `GET /api/badge/node/:id/status` | 节点状态 |
| `GET /api/badge/node/:id/uptime` | 节点在线率 |
| `GET /api/badge/node/:id/latency` | 节点延迟 |
| `GET /api/badge/node/:id/latency-stats?stat=avg` | 延迟统计 (avg/min/max/std/cv/p95) |
| `GET /api/badge/player/:name/status` | 玩家在线状态 |
| `GET /api/badge/player/:name/current-session` | 当前会话时长 |
| `GET /api/badge/player/:name/period-playtime?hours=N` | 时段游戏时长 |
| `GET /api/badge/player/:name/live` | 实时状态 |

### 其他

| 端点 | 描述 |
|------|------|
| `GET /api/exporter/health` | 健康检查 |
| `GET /api/exporter/version` | 版本信息 |
| `GET /api/query` | 类 SQL 查询接口 |
| `WS /api/ws` | 原生 WebSocket，轮询完成时推送 `poll_complete` 事件 |

> **Python 后端独有**：Swagger UI (`/api/docs`)、GraphQL (`/api/graphql`)。

---

## PostgreSQL 配置（可选）

MotdTracker 默认使用 SQLite，如需更好的并发性能可配置 PostgreSQL。

### 1. 创建数据库

```bash
psql -U postgres -c "CREATE DATABASE motdtracker;"
```

### 2. 添加配置

在 `config.toml` 中添加：

```toml
[postgresql]
host = "localhost"
port = 5432
database = "motdtracker"
user = "postgres"
password = "your_password"
```

### 3. 自动迁移

Python 后端：配置 PostgreSQL 后首次启动会自动将 SQLite 数据迁移到 PostgreSQL，原数据库备份为 `*.migrated`。

Rust 后端：当前版本仅支持 SQLite，PostgreSQL 适配器开发中（trait 已设计）。

---

## 技术栈

### Rust 后端 (motdtracker-rs)

| 组件 | 技术 |
|------|------|
| Web 框架 | Axum 0.7 |
| 异步运行时 | Tokio 1 |
| 数据库 | sqlx 0.7 (SQLite) |
| WebSocket | axum 原生 WebSocket |
| 序列化 | serde + serde_json |
| 统计计算 | 手动实现 (P95, CV, 标准差) |
| 配置 | TOML |
| 日志 | tracing + tracing-subscriber |
| 告警 | reqwest (HTTP) |

### React 前端 (frontend/)

| 组件 | 技术 |
|------|------|
| 构建工具 | Vite 5 |
| UI 框架 | MUI 7 (Material Design 3) |
| 路由 | React Router 6 |
| 图表 | Chart.js 4 |
| 实时通信 | 原生 WebSocket API |

### Python 后端（遗留）

| 组件 | 技术 |
|------|------|
| Web 框架 | Flask + Flask-RESTX |
| 实时通信 | Flask-SocketIO |
| 数据库 | sqlite3 / psycopg2 |
| 模板 | Jinja2 |
| GraphQL | Graphene |

---

## 贡献

欢迎提交 Issue 与 Pull Request！

详细贡献指南请参阅 [CONTRIBUTING.md](CONTRIBUTING.md)。

---

## 鸣谢

- [mcstatus](https://github.com/py-mine/mcstatus) - Minecraft 服务器查询库
- [Chart.js](https://www.chartjs.org/) - 图表库
- [Axum](https://github.com/tokio-rs/axum) - Rust Web 框架
- [Flask](https://flask.palletsprojects.com/) - Python Web 框架

---

## 许可证

[MIT License](LICENSE)

---

<div align="center">

Made with ❤️ by PoiCraft Team

</div>
