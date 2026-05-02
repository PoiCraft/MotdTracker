# MotdTracker

<div align="center">

**Minecraft 服务器多入口点监控面板**

Rust 高性能后端 + React 前端

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Rust](https://img.shields.io/badge/Rust-1.75+-orange.svg)](https://www.rust-lang.org/)
[![React 18](https://img.shields.io/badge/React-18-61dafb.svg)](https://react.dev/)

</div>

---

## 简介

MotdTracker 是一个专为 Minecraft 服务器设计的多入口点实时监控系统，采用 Rust + React 前后端分离架构。通过多个节点（连接入口）监控同一台服务器，提供状态追踪、延迟分析、玩家会话管理等功能。

### 功能特性

- 🚀 **实时监控** - 原生 WebSocket 推送，轮询完成后自动增量刷新
- 📊 **数据可视化** - Chart.js 趋势图 + 24h 热力图 + 周活跃热力图
- 👥 **玩家追踪** - 会话管理、在线时长统计、每日/每周/每小时分析
- 📈 **延迟分析** - 统计指标（平均/标准差/P95/CV）
- 🔌 **Prometheus 集成** - 节点级指标导出
- 🏷️ **Badge 生成** - SVG 状态徽章（服务器/节点/玩家）
- 💾 **SQLite 存储** - 零配置，单文件嵌入式数据库
- 📱 **NapCat 告警** - QQ 群机器人实时告警通知

---

## 项目结构

```
MotdTracker/
├── src/                      # Rust 后端源码 (Axum)
│   ├── main.rs               # 入口 + SPA fallback
│   ├── lib.rs
│   ├── api/                  # REST API + WebSocket + Badge + Prometheus
│   ├── config/               # TOML 配置加载
│   ├── core/                 # Minecraft 查询 + 轮询调度
│   ├── db/                   # SQLite (sqlx)
│   ├── models/               # 数据模型
│   ├── utils/                # 统计计算、时间工具
│   ├── ws/                   # 原生 WebSocket 广播
│   └── alert/                # NapCat QQ 告警
│
├── tests/                    # 集成测试 + 工具测试
│
├── frontend/                 # React SPA
│   ├── src/
│   │   ├── pages/            # ServerPage, NodesPage, PlayersPage, BadgesPage
│   │   ├── components/       # Layout, MetricCard, StatusPill
│   │   ├── utils/            # charts, format, ws (原生 WebSocket hook)
│   │   └── api.js            # Fetch 封装
│   ├── vite.config.js
│   └── package.json
│
├── Cargo.toml
├── config.example.toml       # 配置示例
├── .github/
├── LICENSE
├── README.md
├── SECURITY.md
└── CONTRIBUTING.md
```

---

## 快速开始

### 1. 配置

```bash
cp config.example.toml config.toml
```

编辑 `config.toml`：

```toml
server_name = "我的服务器"

[database]
path = "data/motdtracker.db"

poll_interval = 15
port = 5011

# 节点是同一服务器的不同连接入口
[[nodes]]
id = 1
name = "主入口"
host = "play.example.com"
port = 25565
enable = true

[[nodes]]
id = 2
name = "移动优化入口"
host = "mobile.example.com"
port = 25565
enable = true
```

### 2. 构建前端

```bash
cd frontend
npm install
npm run build
```

### 3. 启动后端

```bash
cargo run --release
```

访问 <http://127.0.0.1:5011> 查看监控面板。

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
| 配置 | TOML |
| 日志 | tracing |
| 前端框架 | React 18 + Vite 5 |
| UI 组件库 | MUI 7 |
| 图表 | Chart.js 4 |

---

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
