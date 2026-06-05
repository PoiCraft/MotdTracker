# MotdTracker

<div align="center">

**Minecraft 服务器多入口点监控面板**

Rust 高性能后端 + React 前端 · 单文件部署 · 前端内嵌

[![CI](https://github.com/PoiCraft/MotdTracker/actions/workflows/ci.yml/badge.svg)](https://github.com/PoiCraft/MotdTracker/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/PoiCraft/MotdTracker?label=Latest)](https://github.com/PoiCraft/MotdTracker/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Rust](https://img.shields.io/badge/Rust-1.75+-orange.svg)](https://www.rust-lang.org/)

</div>

---

## 简介

MotdTracker 是一个专为 Minecraft 服务器设计的多入口点实时监控系统，采用 Rust + React 前后端分离架构。前端资源已内嵌至可执行文件，**单文件即可运行**，无需额外部署前端。

### 功能特性

- **单文件部署** - 前端打包进二进制，无需 Nginx / 静态文件目录
- **数据库配置** - 所有配置存储在 SQLite 数据库中，通过 Web 管理面板配置
- **管理员系统** - 首次使用时自助创建管理员账号，支持登录/登出/改密码
- **环境变量覆盖** - 支持 `MOTDTRACKER_*` 环境变量覆盖最小启动配置（适配 Docker）
- **多服务器支持** - 通过服务器组管理多台 Minecraft 服务器，侧边栏一键切换
- **实时监控** - 原生 WebSocket 推送，轮询完成后自动增量刷新
- **数据可视化** - Chart.js 趋势图 + 24h 热力图 + 周活跃热力图
- **玩家追踪** - 会话管理、在线时长统计、每日/每周/每小时分析
- **延迟分析** - 统计指标（平均/标准差/P95/CV）
- **Prometheus 集成** - 节点级指标导出
- **Badge 生成** - SVG 状态徽章（服务器/节点/玩家）
- **SQLite 存储** - 零配置，单文件嵌入式数据库
- **Webhook 告警** - 通用 Webhook 告警通知，支持自定义 Headers 和 Body 模板

---

## 下载预编译版本

前往 [GitHub Releases](https://github.com/PoiCraft/MotdTracker/releases/latest) 下载对应平台的预编译二进制：

| 平台 | 文件 |
|------|------|
| Linux x86_64 | `motdtracker-x86_64-unknown-linux-gnu.tar.gz` |
| Windows x86_64 | `motdtracker-x86_64-pc-windows-msvc.zip` |
| macOS x86_64 | `motdtracker-x86_64-apple-darwin.tar.gz` |
| macOS ARM64 | `motdtracker-aarch64-apple-darwin.tar.gz` |

> 每次 push 到 main 分支会自动构建，可在 [Actions](https://github.com/PoiCraft/MotdTracker/actions/workflows/ci.yml) 页面下载最新开发版 artifact。

下载解压后直接运行：

```bash
# Linux / macOS
chmod +x motdtracker
./motdtracker

# Windows
motdtracker.exe
```

```bash
cp config.example.toml config.toml
# 编辑 config.toml 填入端口和数据库路径，其余配置通过 Web UI 管理
```

> 也可以完全不创建 config.toml，直接通过环境变量提供端口和数据库路径，程序将使用默认值启动。

首次启动后，访问 `http://localhost:5011` 将自动跳转到管理员初始化页面，创建账号后即可通过 Web 面板管理所有配置。

---

## 从源码构建

### 前置依赖

- [Rust 1.75+](https://rustup.rs/)
- [Node.js 18+](https://nodejs.org/)（仅构建前端时需要）

### 构建步骤

```bash
# 1. 构建前端（产物会自动嵌入 Rust 二进制）
cd frontend
npm install
npm run build
cd ..

# 2. 构建 Rust 后端
cargo build --release

# 产物位于 target/release/motdtracker（或 .exe）
```

### 开发模式

```bash
# 终端 1：Rust 后端
cargo run

# 终端 2：Vite 开发服务器（热更新）
cd frontend
npm run dev
```

Vite 自动代理 `/api` 到 `http://127.0.0.1:5011`（含 WebSocket），访问 <http://127.0.0.1:5173>。

---

## 项目结构

```
MotdTracker/
├── src/                      # Rust 后端源码 (Axum)
│   ├── main.rs               # 入口 + 启动逻辑
│   ├── lib.rs
│   ├── embedded.rs           # rust-embed 静态资源内嵌
│   ├── tui/                  # TUI 配置向导 (已移除，改用 Web UI)
│   ├── api/                  # REST API + WebSocket + Badge + Prometheus
│   ├── config/               # TOML 配置加载
│   ├── core/                 # Minecraft 查询 + 轮询调度
│   ├── db/                   # SQLite (sqlx)
│   ├── models/               # 数据模型
│   ├── utils/                # 统计计算、时间工具
│   ├── ws/                   # 原生 WebSocket 广播
│   └── alert/                # NapCat QQ 告警
│
├── frontend/                 # React SPA (构建后嵌入二进制)
│   ├── src/
│   │   ├── pages/            # ServerPage, NodesPage, PlayersPage, BadgesPage
│   │   ├── components/       # Layout, MetricCard, StatusPill
│   │   ├── utils/            # charts, format, ws
│   │   └── api.js            # Fetch 封装
│   ├── vite.config.js
│   └── package.json
│
├── tests/                    # 集成测试 + 工具测试
├── .github/workflows/        # CI + Release 自动化
├── Cargo.toml
├── config.example.toml
├── LICENSE
├── README.md
├── SECURITY.md
└── CONTRIBUTING.md
```

---

## Git 钩子（开发提示）

本仓库包含用于在本地阻止未格式化或存在 Clippy 警告的提交的钩子脚本，位于 `.githooks/`：

- `.githooks/pre-commit` — Bash 脚本（Linux/macOS）
- `.githooks/pre-commit.ps1` — PowerShell 脚本（Windows）

要在本地启用这些钩子（仅需运行一次）：

```bash
git config core.hooksPath .githooks
```

启用后，`git commit` 会先运行 `cargo fmt --all -- --check` 和 `cargo clippy --all-targets -- -D warnings`，若任一失败会阻止提交并打印错误信息。

如果你不想启用仓库级钩子，也可手动在本地 `.git/hooks/pre-commit` 中复制相应脚本。


---

## API 端点

### Web 前端专用

| 端点 | 描述 |
|------|------|
| `GET /api/web/server?hours=N` | 服务器页面完整数据 |
| `GET /api/web/server/head?hours=N` | 服务器增量更新 |
| `GET /api/web/node/:id?hours=N` | 节点页面完整数据 |
| `GET /api/web/node/:id/head?hours=N` | 节点增量更新 |

### 服务器 / 节点 / 玩家

| 端点 | 描述 |
|------|------|
| `GET /api/server/nodes` | 所有节点及 24h 统计 |
| `GET /api/node/:id` | 单个节点详情 |
| `GET /api/player` | 所有玩家列表（聚合去重） |
| `GET /api/player/:name/detail` | 玩家详情 |
| `GET /api/player/:name/sessions?days=N` | 玩家会话热力图 + 每日/每小时统计 |
| `GET /api/player/:name/weekly-stats` | 玩家周活跃热力图 |

### Badge (SVG)

| 端点 | 描述 |
|------|------|
| `GET /api/badge/server/status` | 服务器状态 |
| `GET /api/badge/server/uptime?hours=N` | 服务器在线率 |
| `GET /api/badge/node/:id/status` | 节点状态 |
| `GET /api/badge/node/:id/latency` | 节点延迟 |
| `GET /api/badge/player/:name/status` | 玩家在线状态 |

### 其他

| 端点 | 描述 |
|------|------|
| `GET /api/exporter/health` | 健康检查 |
| `GET /api/exporter/metrics` | Prometheus 指标 |
| `GET /api/query` | 类 SQL 查询 |
| `WS /api/ws` | 原生 WebSocket |

### 管理后台

| 端点 | 描述 |
|------|------|
| `POST /api/admin/setup` | 首次初始化管理员 |
| `POST /api/admin/login` | 管理员登录 |
| `POST /api/admin/logout` | 管理员登出 |
| `GET/PUT /api/admin/settings` | 应用设置读写 |
| `GET/POST /api/admin/groups` | 服务器组管理 |
| `GET/PUT/DELETE /api/admin/groups/:id` | 单个组操作 |
| `GET/POST /api/admin/nodes` | 节点管理 |
| `GET/PUT/DELETE /api/admin/nodes/:id` | 单个节点操作 |
| `PUT /api/admin/nodes/:id/group` | 节点分配组 |

---

## 技术栈

| 组件 | 技术 |
|------|------|
| Web 框架 | Axum 0.7 |
| 异步运行时 | Tokio 1 |
| 数据库 | sqlx 0.7 (SQLite) |
| WebSocket | 原生 WebSocket |
| 静态资源 | rust-embed（编译期嵌入） |
| 认证 | Argon2 + UUID Token |
| 配置格式 | TOML（最小启动配置）+ SQLite（业务配置） |
| 日志 | tracing |
| 前端框架 | React 18 + Vite 5 |
| UI 组件库 | MUI 7 |
| 图表 | Chart.js 4 |

---

## CI / CD

- **push / PR** → 自动 check + test + 多平台构建，产物上传到 [Actions](https://github.com/PoiCraft/MotdTracker/actions)
- **打 tag（`v*`）** → 自动构建 + 生成 GitHub Release + 上传预编译二进制 + SHA256 校验和

```bash
# 发布新版本
git tag v2.0.0
git push origin v2.0.0
# → 自动触发 Release workflow
```

---

## 使用 Docker

你也可以直接使用由 CI 构建并推送到 GitHub Container Registry (GHCR) 的镜像运行 MotdTracker。下面示例展示如何拉取并运行镜像，以及一个 `docker-compose.yml` 示例：

### 直接运行（Docker）

```bash
# 拉取镜像
docker pull ghcr.io/poicraft/motdtracker:latest

# 以后台模式运行，映射端口，并通过环境变量覆盖最小启动配置
docker run -d --name motdtracker \
    -p 5011:5011 \
    -v $(pwd)/data:/app/data \
  -e MOTDTRACKER_DATABASE_PATH=/app/data/motdtracker.db \
  -e MOTDTRACKER_PORT=5011 \
    ghcr.io/poicraft/motdtracker:latest

# 查看日志
docker logs -f motdtracker
```

### 使用 docker-compose

将以下内容保存为 `docker-compose.yml`：

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
```

启动服务：

```bash
docker compose up -d
```

如果你仍然希望使用文件配置，可以继续挂载 `config.toml`；不过对于 Docker 用户，更推荐直接使用环境变量覆盖最小启动项，避免手写完整配置文件。

### 支持的环境变量

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `MOTDTRACKER_PORT` | Web 服务端口 | `5011` |
| `MOTDTRACKER_DATABASE_PATH` | SQLite 数据库路径 | `/app/data/motdtracker.db` |
| `MOTDTRACKER_POLL_INTERVAL` | 轮询间隔（秒） | `60` |

优先级：**环境变量 > 配置文件 > 默认值**

注意：TUI 配置向导已移除。首次启动后请访问 Web 管理面板（`/admin`）创建管理员账号并配置节点。

## 快速开始

1. 启动服务：`cargo run` 或使用 Docker
2. 浏览器访问 `http://localhost:5011`
3. 首次使用会自动跳转到管理员初始化页面
4. 创建管理员账号后即可进入管理面板配置节点

## 贡献

欢迎提交 Issue 与 Pull Request！详见 [CONTRIBUTING.md](CONTRIBUTING.md)。

---

## 鸣谢

- [mcstatus](https://github.com/py-mine/mcstatus) - Minecraft 服务器查询库
- [Chart.js](https://www.chartjs.org/) - 图表库
- [Axum](https://github.com/tokio-rs/axum) - Rust Web 框架

---

## 许可证

[MIT License](LICENSE)

---

<div align="center">

Made with ❤️ by PoiCraft Team

</div>
