# MotdTracker

<div align="center">

**Minecraft 服务器多入口点实时监控系统**

Rust 高性能后端 + React/TypeScript 前端 · 单文件部署 · 前端内嵌

[![CI](https://github.com/PoiCraft/MotdTracker/actions/workflows/ci.yml/badge.svg)](https://github.com/PoiCraft/MotdTracker/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/PoiCraft/MotdTracker?label=Latest)](https://github.com/PoiCraft/MotdTracker/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Rust](https://img.shields.io/badge/Rust-1.75+-orange.svg)](https://www.rust-lang.org/)

</div>

---

## 简介

MotdTracker 是一个专为 Minecraft 服务器设计的多入口点实时监控系统，支持同时监控同一台服务器的多个连接入口（节点）。采用 Rust + React/TypeScript 前后端分离架构，前端资源通过 `rust-embed` 编译期嵌入二进制，**单文件即可运行**，无需额外部署静态文件或 Nginx。

### 核心特性

- **单文件部署** - 前端打包进二进制，零依赖启动
- **三层数据模型** - `服务器组 → 服务器 → 节点`，清晰管理多服多入口场景
- **双版本支持** - 原生实现 Java 版（TCP/Server List Ping）和基岩版（UDP/RakNet）查询协议
- **数据库驱动配置** - 业务配置全部存储在 SQLite 中，通过 Web 管理面板操作
- **管理员系统** - 首次使用时自助创建管理员账号，Argon2 密码哈希 + UUID Token 认证
- **环境变量覆盖** - 支持 `MOTDTRACKER_*` 环境变量覆盖最小启动配置，适配 Docker/K8s
- **实时监控** - 原生 WebSocket 推送，轮询完成后自动增量刷新前端
- **数据可视化** - Recharts 趋势图 + 玩家活跃热力图 + 周统计
- **玩家追踪** - 会话管理、在线时长统计、每日/每周/每小时分析
- **延迟分析** - 统计指标（平均/P95/标准差/CV/在线率）
- **Prometheus 集成** - `/api/exporter/metrics` 节点级指标导出
- **SVG Badge 生成** - 服务器/节点/玩家状态徽章，可直接嵌入外部页面
- **通用 Webhook 告警** - 支持自定义 Headers 和 Body 模板，可对接任意通知渠道
- **SQLite 存储** - 零配置，单文件嵌入式数据库
- **登录限流** - 基于 IP 的 governor 限流，防止暴力破解

---

## 快速开始

### 下载预编译版本

前往 [GitHub Releases](https://github.com/PoiCraft/MotdTracker/releases/latest) 下载对应平台的二进制：

| 平台 | 文件 |
|------|------|
| Linux x86_64 | `motdtracker-x86_64-unknown-linux-gnu.tar.gz` |
| Linux ARM64 | `motdtracker-aarch64-unknown-linux-gnu.tar.gz` |
| Windows x86_64 | `motdtracker-x86_64-pc-windows-msvc.zip` |
| macOS x86_64 | `motdtracker-x86_64-apple-darwin.tar.gz` |
| macOS ARM64 | `motdtracker-aarch64-apple-darwin.tar.gz` |

> 每次 push 到 main 分支会自动构建，可在 [Actions](https://github.com/PoiCraft/MotdTracker/actions/workflows/ci.yml) 下载最新开发版 artifact。

解压后直接运行：

```bash
# Linux / macOS
chmod +x motdtracker
./motdtracker

# Windows
motdtracker.exe
```

首次启动后访问 `http://localhost:5011`，系统将自动跳转到管理员初始化页面。创建账号后即可通过 Web 面板管理所有配置（服务器组、服务器、节点、轮询间隔等）。

> 也可以完全不创建 `config.toml`，直接通过环境变量提供端口和数据库路径，程序将使用默认值启动。

---

## 从源码构建

### 前置依赖

- [Rust 1.75+](https://rustup.rs/)
- [Node.js LTS](https://nodejs.org/)（`build.rs` 会自动调用 `npm run build` 嵌入前端）

### 构建步骤

```bash
# 单命令构建（build.rs 会自动处理前端编译和嵌入）
cargo build --release

# 产物位于 target/release/motdtracker（或 .exe）
```

### 开发模式

```bash
# 终端 1：Rust 后端
cargo run

# 终端 2：Vite 开发服务器（热更新）
cd frontend
npm install
npm run dev
```

Vite 已配置代理 `/api` 到 `http://127.0.0.1:5011`（含 WebSocket），访问 <http://127.0.0.1:5173>。

---

## 使用 Docker

### 直接运行

```bash
# 拉取镜像
docker pull ghcr.io/poicraft/motdtracker:latest

# 运行
docker run -d --name motdtracker \
    -p 5011:5011 \
    -v $(pwd)/data:/app/data \
    -e MOTDTRACKER_DATABASE_PATH=/app/data/motdtracker.db \
    -e MOTDTRACKER_PORT=5011 \
    ghcr.io/poicraft/motdtracker:latest
```

### Docker Compose

```bash
wget https://raw.githubusercontent.com/PoiCraft/MotdTracker/main/docker-compose.yml
docker compose up -d
```

或保存以下内容为 `docker-compose.yml`：

```yaml
version: "3.8"
services:
  motdtracker:
    image: ghcr.io/poicraft/motdtracker:latest
    container_name: motdtracker
    restart: unless-stopped
    ports:
      - "5011:5011"
    volumes:
      - ./data:/app/data
    environment:
      - TZ=Asia/Shanghai
      - MOTDTRACKER_DATABASE_PATH=/app/data/motdtracker.db
      - MOTDTRACKER_PORT=5011
      - MOTDTRACKER_CORS_ORIGIN=""
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:5011/api/exporter/health"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s
```

### 支持的环境变量

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `MOTDTRACKER_PORT` | Web 服务端口 | `5011` |
| `MOTDTRACKER_DATABASE_PATH` | SQLite 数据库路径 | `/app/data/motdtracker.db` |
| `MOTDTRACKER_CORS_ORIGIN` | CORS 允许的源（空=禁止，`*`=允许任意） | `""` |

优先级：**数据库配置（Web 面板）> 环境变量 > 配置文件 > 默认值**

> 注意：首次启动后若通过 Web 面板修改过轮询间隔等设置，这些值会持久化到数据库，此后环境变量和配置文件中的对应项将不再生效。

---

## 项目结构

```
MotdTracker/
├── src/                      # Rust 后端源码 (Axum)
│   ├── main.rs               # 入口 + HTTP 服务启动
│   ├── lib.rs                # 库模块导出
│   ├── embedded.rs           # rust-embed 静态资源内嵌 + SPA fallback
│   ├── api/                  # REST API 路由
│   │   ├── mod.rs            # AppState / WebSocket handler
│   │   ├── admin.rs          # 管理后台 CRUD
│   │   ├── badge.rs          # SVG 徽章生成
│   │   ├── exporter.rs       # Prometheus 指标 + 健康检查
│   │   ├── groups.rs         # 服务器组 API
│   │   ├── node.rs           # 节点 API
│   │   ├── player.rs         # 玩家 API
│   │   ├── servers.rs        # 服务器 API
│   │   └── status.rs         # 服务状态
│   ├── auth/                 # 认证 (Argon2 + UUID Token)
│   ├── config/               # TOML 配置加载 + 环境变量覆盖
│   ├── core/                 # Minecraft 查询 + 轮询调度
│   │   ├── monitor.rs        # Java/Bedrock 协议查询实现
│   │   └── poller.rs         # 定时轮询管理器
│   ├── db/                   # SQLite (sqlx) + Database trait
│   ├── models/               # 数据模型 (serde)
│   ├── utils/                # 统计计算、时间工具
│   ├── ws/                   # WebSocket 广播
│   └── alert/                # 通用 Webhook 告警
│
├── frontend/                 # React 19 SPA (构建后嵌入二进制)
│   ├── src/
│   │   ├── pages/            # Dashboard, Servers, Nodes, Players, Badges, Admin...
│   │   ├── components/       # UI 组件 (Radix UI + Tailwind)
│   │   ├── providers/        # Auth, Query, WebSocket, Theme, AppStatus
│   │   ├── hooks/            # 自定义 React Hooks
│   │   ├── api/              # API 请求封装
│   │   ├── i18n/             # 国际化 (i18next)
│   │   ├── App.tsx           # 路由配置 (React Router 7)
│   │   └── main.tsx          # 入口
│   ├── vite.config.ts        # Vite 配置 (含代理)
│   └── package.json
│
├── tests/                    # 集成测试 (数据库 CRUD + 工具测试)
├── .github/workflows/        # CI (check/test/build) + Release + Docker
├── build.rs                  # 编译期前端构建 + 版本号生成
├── Cargo.toml
├── config.example.toml       # 最小启动配置示例
├── docker-compose.yml
├── Dockerfile                # 多阶段构建 (Alpine)
├── entrypoint.sh             # Docker 入口点 (权限修复 + su-exec)
└── LICENSE
```

---

## 技术栈

| 组件 | 技术 |
|------|------|
| Web 框架 | Axum 0.7 |
| 异步运行时 | Tokio 1 |
| 数据库 | sqlx 0.7 (SQLite) |
| 定时任务 | tokio-cron-scheduler |
| WebSocket | Axum 原生 ws |
| 静态资源 | rust-embed（编译期嵌入） |
| 认证 | Argon2 + UUID Token |
| 限流 | governor |
| 模板引擎 | askama (Badge SVG) |
| 配置格式 | TOML（最小启动）+ SQLite（业务配置） |
| 日志 | tracing |
| 前端框架 | React 19 + TypeScript + Vite 8 |
| UI 组件 | Radix UI + Tailwind CSS 4 + shadcn/ui 风格 |
| 状态管理 | TanStack Query + React Hook Form + Zod |
| 图表 | Recharts |
| 路由 | React Router 7 |
| 主题 | next-themes (dark/light/system) |
| 国际化 | i18next |

---

## API 端点

### 公开端点

| 方法 | 路径 | 描述 |
|------|------|------|
| `GET` | `/api/status` | 服务状态（版本、运行时间、节点/服务器/组数量） |
| `GET` | `/api/groups` | 所有服务器组列表 |
| `GET` | `/api/groups/:id` | 单个组详情（含 servers 摘要） |
| `GET` | `/api/servers` | 所有服务器列表 `?group_id=UUID` |
| `GET` | `/api/servers/:id` | 单个服务器详情（含 nodes 摘要 + aggregate_status） |
| `GET` | `/api/servers/:id/history` | 服务器下所有节点的历史聚合 |
| `GET` | `/api/nodes` | 所有节点列表 `?group_id=UUID` `?server_id=UUID` |
| `GET` | `/api/nodes/:id` | 单个节点详情 + 最新状态 + 延迟统计 |
| `GET` | `/api/nodes/:id/history` | 节点状态历史 `?hours=24` |
| `GET` | `/api/players` | 所有玩家列表 `?group_id=UUID` |
| `GET` | `/api/players/:name` | 玩家详情（含出现记录 + session 历史） |
| `GET` | `/api/players/:name/sessions` | 历史会话 `?days=30` |
| `GET` | `/api/players/:name/heatmap` | 活跃热力图 `?days=30` |

### Badge (SVG)

| 方法 | 路径 | 描述 |
|------|------|------|
| `GET` | `/api/badges/groups/:id/status` | 组状态徽章 |
| `GET` | `/api/badges/servers/:id/status` | 服务器状态徽章 |
| `GET` | `/api/badges/servers/:id/uptime` | 服务器在线率 `?hours=24` |
| `GET` | `/api/badges/servers/:id/players` | 服务器在线玩家数徽章 |
| `GET` | `/api/badges/nodes/:id/status` | 节点状态徽章 |
| `GET` | `/api/badges/nodes/:id/latency` | 节点延迟徽章 |
| `GET` | `/api/badges/nodes/:id/players` | 节点玩家数徽章 |
| `GET` | `/api/badges/players/:name/status` | 玩家在线状态徽章 |

### 管理后台（需 Bearer Token）

| 方法 | 路径 | 描述 |
|------|------|------|
| `POST` | `/api/admin/setup` | 首次初始化管理员 |
| `POST` | `/api/admin/login` | 管理员登录 |
| `POST` | `/api/admin/logout` | 管理员登出 |
| `POST` | `/api/admin/change-password` | 修改密码 |
| `GET` | `/api/admin/status` | 是否已初始化管理员 |
| `GET/PUT` | `/api/admin/settings` | 应用设置读写 |
| `POST` | `/api/admin/apply` | 应用配置（触发轮询器重启） |
| `GET` | `/api/admin/config-status` | 配置同步状态 |
| `GET/POST` | `/api/admin/groups` | 服务器组管理 |
| `GET/PUT/DELETE` | `/api/admin/groups/:id` | 单个组操作 |
| `GET/POST` | `/api/admin/servers` | 服务器管理 |
| `GET/PUT/DELETE` | `/api/admin/servers/:id` | 单个服务器操作 |
| `GET/POST` | `/api/admin/nodes` | 节点管理 |
| `GET/PUT/DELETE` | `/api/admin/nodes/:id` | 单个节点操作 |
| `POST` | `/api/admin/nodes/:id/move-up/down` | 节点排序 |

### 其他

| 方法 | 路径 | 描述 |
|------|------|------|
| `GET` | `/api/exporter/health` | 健康检查 |
| `GET` | `/api/exporter/metrics` | Prometheus 指标 |
| `WS` | `/api/ws` | WebSocket 实时推送（可选 token 认证） |

---

## Git 钩子

仓库包含用于阻止未格式化或存在 Clippy 警告的提交的钩子：

- `.githooks/pre-commit` — Bash（Linux/macOS）
- `.githooks/pre-commit.ps1` — PowerShell（Windows）

启用方式：

```bash
git config core.hooksPath .githooks
```

---

## CI / CD

- **push / PR** → `cargo fmt/check/clippy/test` + 5 平台构建，产物上传到 Actions
- **GitHub Release published** → 自动构建 + 上传预编译二进制 + SHA256 校验和 + 多架构 Docker 镜像推送到 GHCR

---

## 鸣谢

- [Axum](https://github.com/tokio-rs/axum) - Rust Web 框架
- [Recharts](https://recharts.org/) - 图表库
- [Radix UI](https://www.radix-ui.com/) - 无障碍组件原语

---

## 许可证

[MIT License](LICENSE)

---

<div align="center">

Made with ❤️ by PoiCraft Team

</div>
