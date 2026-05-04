# MotdTracker

<div align="center">

**Minecraft 服务器多入口点监控面板**

Rust 高性能后端 + React 前端 · 单文件部署 · 前端内嵌

[![CI](https://github.com/PoiCraft/motdtracker-rs/actions/workflows/ci.yml/badge.svg)](https://github.com/PoiCraft/motdtracker-rs/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/PoiCraft/motdtracker-rs?label=Latest)](https://github.com/PoiCraft/motdtracker-rs/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Rust](https://img.shields.io/badge/Rust-1.75+-orange.svg)](https://www.rust-lang.org/)

</div>

---

## 简介

MotdTracker 是一个专为 Minecraft 服务器设计的多入口点实时监控系统，采用 Rust + React 前后端分离架构。前端资源已内嵌至可执行文件，**单文件即可运行**，无需额外部署前端。

### 功能特性

- **单文件部署** - 前端打包进二进制，无需 Nginx / 静态文件目录
- **TUI 配置向导** - 首次启动自动弹出终端交互界面，无需手写配置文件
- **实时监控** - 原生 WebSocket 推送，轮询完成后自动增量刷新
- **数据可视化** - Chart.js 趋势图 + 24h 热力图 + 周活跃热力图
- **玩家追踪** - 会话管理、在线时长统计、每日/每周/每小时分析
- **延迟分析** - 统计指标（平均/标准差/P95/CV）
- **Prometheus 集成** - 节点级指标导出
- **Badge 生成** - SVG 状态徽章（服务器/节点/玩家）
- **SQLite 存储** - 零配置，单文件嵌入式数据库
- **NapCat 告警** - QQ 群机器人实时告警通知

---

## 下载预编译版本

前往 [GitHub Releases](https://github.com/PoiCraft/motdtracker-rs/releases/latest) 下载对应平台的预编译二进制：

| 平台 | 文件 |
|------|------|
| Linux x86_64 | `motdtracker-x86_64-unknown-linux-gnu.tar.gz` |
| Windows x86_64 | `motdtracker-x86_64-pc-windows-msvc.zip` |
| macOS x86_64 | `motdtracker-x86_64-apple-darwin.tar.gz` |
| macOS ARM64 | `motdtracker-aarch64-apple-darwin.tar.gz` |

> 每次 push 到 main 分支会自动构建，可在 [Actions](https://github.com/PoiCraft/motdtracker-rs/actions/workflows/ci.yml) 页面下载最新开发版 artifact。

下载解压后直接运行：

```bash
# Linux / macOS
chmod +x motdtracker
./motdtracker

# Windows
motdtracker.exe
```

**首次运行时如果没有 `config.toml`，会自动进入 TUI 配置向导。**

---

## 配置

### 方式一：TUI 配置向导（推荐）

直接运行程序，若检测不到 `config.toml` 会自动进入交互式配置向导：

```
┌──────────────────────────────────┐
│   MotdTracker 配置向导           │
├──────────────────────────────────┤
│                                  │
│   欢迎使用 MotdTracker!          │
│                                  │
│   此向导将引导你完成首次配置。    │
│   配置完成后将自动生成            │
│   config.toml 文件。             │
│                                  │
│   按 Enter 开始...               │
│                                  │
└──────────────────────────────────┘
```

向导步骤：
1. **服务器名称** - 实例的显示名称
2. **Web 端口** - 监听端口（默认 5011）
3. **轮询间隔** - 状态查询频率（默认 60 秒）
4. **数据库路径** - SQLite 文件路径
5. **节点管理** - 添加/编辑/删除监控节点（可跳过）
6. **确认保存** - 检查配置并写入 `config.toml`

### 方式二：手动编写配置文件

复制示例配置并编辑：

```bash
cp config.example.toml config.toml
```

`config.toml` 示例：

```toml
server_name = "我的服务器"
port = 5011
poll_interval = 60

[database]
path = "data/motdtracker.db"

[[nodes]]
id = 1
name = "主入口"
host = "play.example.com"
port = 25565
edition = "java"
enable = true

[[nodes]]
id = 2
name = "基岩版入口"
host = "play.example.com"
port = 19132
edition = "bedrock"
enable = true
```

> **⚠ 节点 ID 是标识节点的唯一依据。** 不同节点必须使用不同的 `id`，否则会导致历史数据混乱、统计错误，且无法恢复。`id` 一旦分配请勿随意修改。

### 可选配置

<details>
<summary>NapCat QQ 告警</summary>

```toml
[napcat_alert]
enable = true
host = "http://localhost:3001"
groups = ["123456789"]
delta_minutes = 30
offline_confirm_frames = 3
online_confirm_frames = 3
```

</details>

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
│   ├── tui/                  # TUI 配置向导 (ratatui)
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

---

## 技术栈

| 组件 | 技术 |
|------|------|
| Web 框架 | Axum 0.7 |
| 异步运行时 | Tokio 1 |
| 数据库 | sqlx 0.7 (SQLite) |
| WebSocket | 原生 WebSocket |
| 静态资源 | rust-embed（编译期嵌入） |
| 配置向导 | ratatui + crossterm |
| 配置格式 | TOML |
| 日志 | tracing |
| 前端框架 | React 18 + Vite 5 |
| UI 组件库 | MUI 7 |
| 图表 | Chart.js 4 |

---

## CI / CD

- **push / PR** → 自动 check + test + 多平台构建，产物上传到 [Actions](https://github.com/PoiCraft/motdtracker-rs/actions)
- **打 tag（`v*`）** → 自动构建 + 生成 GitHub Release + 上传预编译二进制 + SHA256 校验和

```bash
# 发布新版本
git tag v0.1.0
git push origin v0.1.0
# → 自动触发 Release workflow
```

---

## 使用 Docker

你也可以直接使用由 CI 构建并推送到 GitHub Container Registry (GHCR) 的镜像运行 MotdTracker。下面示例展示如何拉取并运行镜像，以及一个 `docker-compose.yml` 示例：

### 直接运行（Docker）

```bash
# 拉取镜像（替换为实际 owner/repo）
docker pull ghcr.io/poicraft/motdtracker-rs:latest

# 以后台模式运行，映射端口并挂载数据目录
docker run -d --name motdtracker \
	-p 5011:5011 \
	-v $(pwd)/data:/app/data \
	-v $(pwd)/config.toml:/app/config.toml \
	ghcr.io/poicraft/motdtracker-rs:latest

# 查看日志
docker logs -f motdtracker
```

### 使用 docker-compose

将以下内容保存为 `docker-compose.yml`：

```yaml
version: "3.8"
services:
	motdtracker:
		image: ghcr.io/poicraft/motdtracker-rs:latest
		container_name: motdtracker
		restart: unless-stopped
		ports:
			- "5011:5011"
		volumes:
			- ./data:/app/data
			- ./config.toml:/app/config.toml
		environment:
			- TZ=Asia/Shanghai
```

启动服务：

```bash
docker compose up -d
```

如果你希望使用指定的配置，编辑 `config.toml`（参考 `config.example.toml`）并将其挂载到容器中。


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
