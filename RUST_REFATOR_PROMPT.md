# MotdTracker 项目完整描述 - Rust 重构指南

> 本文档详细描述了 MotdTracker 项目的架构、功能和实现细节，为使用 Rust 进行重构提供完整的技术规格说明。

---

## 目录

1. [项目概述](#1-项目概述)
2. [技术栈与依赖](#2-技术栈与依赖)
3. [项目结构](#3-项目结构)
4. [核心模块详解](#4-核心模块详解)
5. [数据库设计与操作](#5-数据库设计与操作)
6. [API 接口规范](#6-api-接口规范)
7. [WebSocket 实时通信](#7-websocket-实时通信)
8. [前端架构](#8-前端架构)
9. [配置系统](#9-配置系统)
10. [Rust 重构建议](#10-rust-重构建议)

---

## 1. 项目概述

### 1.1 项目简介

**MotdTracker** 是一个专为 Minecraft 服务器设计的多节点实时监控系统。它能够同时监控多个 Minecraft 服务器入口点（节点），提供实时状态追踪、玩家会话管理、延迟统计分析和 Prometheus 指标导出等功能。

### 1.2 核心功能

| 功能模块 | 描述 |
|---------|------|
| 🚀 实时监控 | WebSocket 推送，毫秒级延迟数据更新 |
| 📊 数据可视化 | Chart.js 趋势图 + 24h 热力图 |
| 👥 玩家追踪 | 会话管理、在线时长统计、历史记录 |
| 📈 延迟分析 | 24h 统计指标（平均/标准差/P95/CV） |
| 🔌 Prometheus 集成 | 完整节点级指标导出 |
| 💾 双数据库支持 | SQLite（默认）/ PostgreSQL（可选） |
| 🎨 Badge 生成 | SVG 状态徽章生成 |
| 🔔 告警通知 | NapCat QQ 机器人告警集成 |
| 📱 PWA 支持 | 渐进式 Web 应用，支持离线访问 |

### 1.3 项目版本

- **当前版本**: v1.5.1
- **Python 版本要求**: >= 3.13
- **许可证**: MIT

---

## 2. 技术栈与依赖

### 2.1 后端技术栈

| 组件 | 技术 | 用途 |
|------|------|------|
| Web 框架 | Flask 3.0+ | HTTP 请求处理、路由 |
| WebSocket | Flask-SocketIO 5.3+ | 实时双向通信 |
| REST API | Flask-RESTX 0.5+ | RESTful API + Swagger 文档 |
| GraphQL | Graphene 3.4+ | GraphQL 查询接口 |
| 任务调度 | APScheduler 3.10+ | 定时轮询任务 |
| Minecraft 查询 | mcstatus 11.0+ | Minecraft 服务器状态查询 |
| SQLite | sqlite3 (内置) | 默认数据库 |
| PostgreSQL | psycopg2 2.9+ | 可选数据库后端 |
| Badge 生成 | anybadge 1.14+ | SVG 徽章生成 |
| HTTP 客户端 | requests 2.32+ | NapCat API 调用 |

### 2.2 前端技术栈

| 组件 | 技术 | 用途 |
|------|------|------|
| 模板引擎 | Jinja2 | HTML 模板渲染 |
| 图表库 | Chart.js | 数据可视化 |
| WebSocket 客户端 | Socket.IO | 实时通信 |
| PWA | Service Worker | 离线缓存支持 |
| CSS | 自定义 CSS | 响应式布局 |

### 2.3 Rust 重构推荐 Crates

```
# Web 框架
axum = "0.7"              # 或 actix-web = "4"
tower = "0.4"
tower-http = "0.5"

# 异步运行时
tokio = { version = "1", features = ["full"] }

# 序列化
serde = { version = "1", features = ["derive"] }
serde_json = "1"

# 数据库
sqlx = { version = "0.7", features = ["runtime-tokio", "sqlite", "postgres"] }

# WebSocket
axum-extra = { version = "0.9", features = ["typed-header"] }
# 或 tokio-tungstenite = "0.21"

# 配置解析
toml = "0.8"

# 定时任务
tokio-cron-scheduler = "0.9"

# Minecraft 查询
# 需要自行实现或参考 mcstatus 的协议

# HTTP 客户端（告警）
reqwest = { version = "0.11", features = ["json"] }

# SVG Badge 生成
# 可参考 badge crate 或自行实现

# GraphQL (可选)
async-graphql = "7"
async-graphql-axum = "7"

# Prometheus 指标
prometheus = "0.13"

# 日志
tracing = "0.1"
tracing-subscriber = "0.3"

# 时间处理
chrono = { version = "0.4", features = ["serde"] }

# 统计计算
statrs = "0.16"
```

---

## 3. 项目结构

```
MotdTracker/
├── main.py                    # 应用入口，Flask 应用初始化
├── pyproject.toml             # 项目配置和依赖
├── config.toml                # 运行时配置（不提交）
├── config.example.toml        # 配置示例
│
├── core/                      # 核心业务逻辑
│   ├── __init__.py
│   ├── monitor.py             # Minecraft 服务器查询
│   └── poller.py              # 定时轮询器
│
├── db/                        # 数据库层
│   ├── __init__.py
│   ├── database_base.py       # 数据库抽象接口
│   ├── database_factory.py    # 数据库工厂 + 迁移
│   ├── database_sqlite.py     # SQLite 实现
│   └── database_postgresql.py # PostgreSQL 实现
│
├── routes/                    # API 路由
│   ├── api_models.py          # Flask-RESTX 模型定义
│   ├── badge_api.py           # Badge 生成 API
│   ├── exporter.py            # Prometheus 指标导出
│   ├── graphql_api.py         # GraphQL 入口
│   ├── graphql_schema.py      # GraphQL Schema 定义
│   ├── node_api.py            # 节点管理 API
│   ├── pages.py               # HTML 页面路由
│   ├── player_api.py          # 玩家相关 API
│   ├── query_api.py           # 类 SQL 查询 API
│   ├── server_api.py          # 服务器聚合 API
│   └── web_api.py             # Web 前端专用 API
│
├── utils/                     # 工具函数
│   ├── __init__.py
│   ├── app_utils.py           # 通用工具函数
│   ├── badge_generator.py     # Badge 生成工具
│   ├── config_loader.py       # 配置文件加载
│   ├── data_processing.py     # 数据处理函数
│   ├── data_stats.py          # 统计计算函数
│   ├── history_query.py       # 历史数据查询
│   └── query_parser.py        # SQL 解析器
│
├── templates/                 # Jinja2 HTML 模板
│   ├── base.html              # 基础布局模板
│   ├── server.html            # 服务器监控页面
│   ├── nodes.html             # 节点列表页面
│   ├── players.html           # 玩家列表页面
│   ├── player_detail.html     # 玩家详情页面
│   └── badges.html            # Badge 展示页面
│
├── static/                    # 静态资源
│   ├── css/                   # 样式文件
│   │   ├── style.css          # 主入口
│   │   ├── variables.css      # CSS 变量
│   │   ├── layout.css         # 布局样式
│   │   ├── components.css     # 组件样式
│   │   ├── heatmap.css        # 热力图样式
│   │   ├── players.css        # 玩家页面样式
│   │   ├── modals.css         # 弹窗样式
│   │   ├── pages.css          # 页面特定样式
│   │   ├── responsive.css     # 响应式样式
│   │   └── spinners.css       # 加载动画
│   ├── js/                    # JavaScript
│   │   ├── chart.min.js       # Chart.js 库
│   │   ├── socket.io.min.js   # Socket.IO 客户端
│   │   └── notifications.js   # 通知处理
│   ├── icons/                 # PWA 图标
│   ├── manifest.json          # PWA 清单
│   ├── sw.js                  # Service Worker
│   └── poi.png                # 网站图标
│
├── scripts/                   # 辅助脚本
│   ├── migrate.py             # 数据迁移脚本
│   ├── fix_pgsql.py           # PostgreSQL 修复脚本
│   └── generate_icons.py      # 图标生成脚本
│
├── tests/                     # 测试文件
│   └── test_badge.py
│
└── docs/                      # 文档
    └── API.md                 # API 文档
```

---

## 4. 核心模块详解

### 4.1 应用入口 (main.py)

```python
# 应用初始化流程
1. 创建 Flask 应用实例
2. 配置 SECRET_KEY
3. 初始化 SocketIO（路径: /api/socket.io）
4. 初始化 Flask-RESTX Api（基础路径: /api）
5. 创建 ServerPoller 实例
6. 注册所有路由模块
7. 配置优雅关闭处理
8. 启动服务（默认端口: 5011）
```

**关键点**:
- SocketIO 路径配置为 `/api/socket.io`
- Swagger 文档位于 `/api/docs`
- GraphQL 端点位于 `/api/graphql`
- GraphiQL 界面位于 `/api/graphiql`

### 4.2 服务器监控 (core/monitor.py)

#### `MinecraftMonitor` 类

负责与 Minecraft 服务器通信，获取服务器状态信息。

**主要方法**:

```python
@staticmethod
def query_server(host: str, port: int = 25565, timeout: int = 5) -> Dict
```

**返回数据结构**:

```json
{
    "online": false,
    "latency": null,
    "players_online": null,
    "players_max": null,
    "version": null,
    "motd": null,
    "sample_players": null,
    "software": null,
    "plugins": null,
    "map": null,
    "error": null
}
```

**查询流程**:

1. 创建 `JavaServer` 对象
2. 调用 `status()` 方法获取基本信息
3. 测量延迟（毫秒）
4. 尝试调用 `query()` 获取详细信息（需要服务器启用 query）
5. 合并玩家样本列表（status + query）
6. 提取软件、插件、地图信息

**异常处理**:
- `ConnectionRefusedError`: 连接被拒绝
- `TimeoutError`: 连接超时
- 其他异常: 记录错误信息

### 4.3 轮询器 (core/poller.py)

#### `ServerPoller` 类

系统的核心调度组件，负责定时查询所有节点并维护状态。

**初始化参数**:
- `config_path`: 配置文件路径（可选，自动检测）
- `socketio`: SocketIO 实例（可选）

**核心属性**:

| 属性 | 类型 | 描述 |
|------|------|------|
| `config` | Dict | 配置字典 |
| `db` | DatabaseBase | 数据库实例 |
| `monitor` | MinecraftMonitor | 监控器实例 |
| `scheduler` | BackgroundScheduler | 任务调度器 |
| `socketio` | SocketIO | WebSocket 实例 |
| `server_ids` | Dict[str, int] | 服务器地址到 ID 的映射 |
| `previous_status` | Dict[int, bool] | 上一帧在线状态 |
| `current_status` | Dict[int, bool] | 当前帧在线状态 |

**核心方法**:

1. **`poll_server(server_info, timestamp)`** - 轮询单个节点
   - 查询服务器状态
   - 记录到数据库
   - 更新玩家会话
   - 维护状态缓存

2. **`poll_all_servers()`** - 轮询所有节点
   - 过滤已禁用节点
   - 使用线程池并行轮询（最多 8 线程）
   - 发送 WebSocket `poll_complete` 事件
   - 检查告警条件

3. **`check_alerts()`** - 告警检查
   - 连续帧计数逻辑
   - 状态变化检测
   - NapCat 消息发送

**告警逻辑**:

```
状态: online / offline
帧计数: online_streak / offline_streak

触发离线告警条件:
  - 当前帧任何节点都不在线
  - offline_streak >= offline_confirm_frames
  - alert_state != "offline"

触发恢复告警条件:
  - 当前帧有节点在线
  - online_streak >= online_confirm_frames
  - alert_state != "online"

重复告警:
  - 离线状态下每隔 delta_minutes 发送一次
```

---

## 5. 数据库设计与操作

### 5.1 表结构

#### `servers` 表 - 服务器节点信息

| 字段 | 类型 | 约束 | 描述 |
|------|------|------|------|
| id | INTEGER | PRIMARY KEY | 节点 ID |
| name | TEXT | NOT NULL | 节点名称 |
| host | TEXT | NOT NULL | 服务器地址 |
| port | INTEGER | NOT NULL | 服务器端口 |
| color | TEXT | NULLABLE | 图表颜色 |

**唯一约束**: `(host, port)`

#### `status_logs` 表 - 状态日志

| 字段 | 类型 | 约束 | 描述 |
|------|------|------|------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | 记录 ID |
| server_id | INTEGER | FOREIGN KEY | 节点 ID |
| timestamp | DATETIME | NOT NULL | 记录时间 |
| online | BOOLEAN | NOT NULL | 是否在线 |
| latency | REAL | NULLABLE | 延迟（毫秒）|
| players_online | INTEGER | NULLABLE | 在线玩家数 |
| players_max | INTEGER | NULLABLE | 最大玩家数 |
| version | TEXT | NULLABLE | 服务器版本 |
| motd | TEXT | NULLABLE | 服务器 MOTD |
| sample_players | TEXT | NULLABLE | 玩家样本（JSON）|
| software | TEXT | NULLABLE | 服务端软件 |
| plugins | TEXT | NULLABLE | 插件列表（JSON）|
| map | TEXT | NULLABLE | 地图名称 |

**索引**:
- `idx_status_logs_timestamp` on `(timestamp)`
- `idx_status_logs_server_id` on `(server_id)`

#### `player_sessions` 表 - 玩家当前会话

| 字段 | 类型 | 约束 | 描述 |
|------|------|------|------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | 记录 ID |
| server_id | INTEGER | FOREIGN KEY | 节点 ID |
| player_name | TEXT | NOT NULL | 玩家名称 |
| first_seen | DATETIME | NOT NULL | 首次出现时间 |
| session_start | DATETIME | NULLABLE | 当前会话开始时间 |
| last_seen | DATETIME | NOT NULL | 最后在线时间 |
| online | BOOLEAN | NOT NULL DEFAULT 0 | 是否在线 |
| duration_seconds | INTEGER | NULLABLE | 会话时长（秒）|

**唯一约束**: `(server_id, player_name)`

#### `player_session_history` 表 - 玩家历史会话

| 字段 | 类型 | 约束 | 描述 |
|------|------|------|------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | 记录 ID |
| server_id | INTEGER | FOREIGN KEY | 节点 ID |
| player_name | TEXT | NOT NULL | 玩家名称 |
| session_start | DATETIME | NOT NULL | 会话开始时间 |
| session_end | DATETIME | NOT NULL | 会话结束时间 |

### 5.2 数据库抽象接口

`DatabaseBase` 定义了所有数据库操作的标准接口：

```python
class DatabaseBase(ABC):
    # 连接管理
    def get_connection(self) -> Connection
    
    # 初始化
    def init_database(self)
    
    # 服务器管理
    def add_server(name, host, port, color, server_id) -> int
    def get_all_servers() -> List[Dict]
    
    # 状态记录
    def log_status(server_id, online, latency, ...)
    def get_server_latest_status(server_id) -> Optional[Dict]
    def get_server_history(server_id, limit) -> List[Dict]
    
    # 玩家会话
    def update_player_sessions(server_id, sample_players, timestamp)
    def get_online_players(server_id) -> List[Dict]
    def get_all_player_sessions(server_id) -> List[Dict]
    def get_player_history(player_name, days) -> List[Dict]
    def get_all_player_names() -> List[str]
```

### 5.3 SQLite 特性

- 使用 WAL 模式支持并发读写
- 设置 `busy_timeout=30000` 处理锁等待
- `check_same_thread=False` 允许多线程访问
- 自动迁移旧版表结构（AUTOINCREMENT 移除）

### 5.4 PostgreSQL 差异

- 使用 `SERIAL` 替代 `AUTOINCREMENT`
- 布尔值使用 `true/false` 而非 `0/1`
- 使用 `%s` 占位符而非 `?`
- 支持 `ON CONFLICT ... DO UPDATE` 语法

### 5.5 数据迁移

从 SQLite 迁移到 PostgreSQL 的流程：

1. 检查 SQLite 文件和备份文件
2. 统计各表数据量
3. 批量读取并插入数据
4. 创建备份文件 `*.migrated`

---

## 6. API 接口规范

### 6.1 API 路由概览

| 路径前缀 | 模块 | 描述 |
|---------|------|------|
| `/` | pages | HTML 页面 |
| `/api/node` | node_api | 节点管理 |
| `/api/server` | server_api | 服务器聚合数据 |
| `/api/player` | player_api | 玩家数据 |
| `/api/web` | web_api | Web 前端专用 |
| `/api/badge` | badge_api | Badge 生成 |
| `/api/exporter` | exporter | Prometheus 指标 |
| `/api/query` | query_api | 类 SQL 查询 |
| `/api/graphql` | graphql_api | GraphQL 端点 |
| `/api/socket.io` | socketio | WebSocket |

### 6.2 服务器 API (`/api/server`)

#### `GET /nodes`
获取所有节点及 24h 统计

**响应示例**:
```json
[
  {
    "id": 1,
    "name": "主线入口",
    "host": "play.example.com",
    "port": 25565,
    "color": "#10b981",
    "enabled": true,
    "latest_status": {
      "timestamp": "2026-01-17T12:34:56",
      "online": true,
      "latency": 15.5,
      "players_online": 42,
      "players_max": 100,
      "version": "1.20.1"
    },
    "latency_stats": {
      "uptime_percentage": 98.5,
      "avg_latency": 18.7,
      "std_dev": 4.2,
      "p95_latency": 28.5,
      "cv": 22.5
    }
  }
]
```

#### `GET /head`
获取服务器实时聚合状态

#### `GET /history?hours=12`
获取聚合历史数据（支持 1-720 小时）

#### `GET /history-compact?hours=12`
获取精简历史数据（用于图表）

#### `GET /stats`
获取 24h 统计指标

#### `GET /uptime`
获取在线率

#### `GET /status-timeline`
获取 24h 状态时间线（用于热图）

#### `GET /players`
获取在线玩家列表（去重）

#### `GET /config`
获取服务器配置信息

### 6.3 节点 API (`/api/node`)

#### `GET /<int:node_id>`
获取单个节点详情

#### `GET /<int:node_id>/history?hours=12`
获取节点历史数据

#### `GET /<int:node_id>/stats`
获取节点统计

#### `GET /<int:node_id>/players`
获取节点玩家

### 6.4 玩家 API (`/api/player`)

#### `GET /`
获取所有玩家列表（聚合）

#### `GET /<player_name>/detail`
获取玩家详情

#### `GET /<player_name>/sessions?days=30`
获取玩家会话历史

#### `GET /<player_name>/heatmap?days=30`
获取玩家热力图数据

### 6.5 Web API (`/api/web`)

专为前端设计的一体化接口，减少请求次数。

#### `GET /server?hours=12`
获取服务器页面完整数据

**响应结构**:
```json
{
  "nodes": [...],
  "stats_by_id": {...},
  "history": {...},
  "uptime": {...},
  "status_timeline": {...},
  "players": [...],
  "head": {...},
  "config": {
    "poll_interval": 15,
    "server_name": "MyServer"
  }
}
```

#### `GET /server/head?hours=12`
获取服务器增量更新数据

#### `GET /node/<node_id>?hours=12`
获取节点页面完整数据

#### `GET /node/<node_id>/head?hours=12`
获取节点增量更新数据

### 6.6 Badge API (`/api/badge`)

所有 Badge 端点返回 `image/svg+xml`。

#### `GET /server/status`
服务器在线状态 Badge

#### `GET /server/uptime?hours=24`
在线率 Badge

#### `GET /server/players`
在线玩家数 Badge

#### `GET /node/<node_id>/status`
节点状态 Badge

#### `GET /node/<node_id>/uptime?hours=24`
节点在线率 Badge

**颜色规则**:
- 在线率 >= 99%: green
- 在线率 >= 95%: limegreen
- 在线率 >= 90%: yellowgreen
- 在线率 >= 75%: yellow
- 在线率 >= 50%: orange
- 在线率 < 50%: red

### 6.7 Prometheus Exporter (`/api/exporter`)

#### `GET /metrics`
导出 Prometheus 格式指标

**指标列表**:

| 指标名 | 类型 | 标签 | 描述 |
|--------|------|------|------|
| `motd_server_online` | gauge | server_id, node_name, host, port | 是否在线 |
| `motd_server_players_online` | gauge | ... | 在线玩家数 |
| `motd_server_players_max` | gauge | ... | 最大玩家数 |
| `motd_server_latency_ms` | gauge | ... | 当前延迟 |
| `motd_server_uptime_percentage` | gauge | ... | 在线率 |
| `motd_server_avg_latency_ms` | gauge | ... | 平均延迟 |
| `motd_server_max_latency_ms` | gauge | ... | 最大延迟 |
| `motd_server_min_latency_ms` | gauge | ... | 最小延迟 |
| `motd_server_latency_stddev_ms` | gauge | ... | 延迟标准差 |
| `motd_server_latency_p95_ms` | gauge | ... | P95 延迟 |
| `motd_server_latency_cv` | gauge | ... | 变异系数 |
| `motd_player_online` | gauge | player_name | 玩家是否在线 |
| `motd_player_session_duration_seconds` | gauge | player_name | 会话时长 |
| `motd_players_count` | gauge | - | 在线玩家总数 |
| `motd_server_count` | gauge | - | 服务器总数 |

#### `GET /health`
健康检查端点

### 6.8 GraphQL API (`/api/graphql`)

#### 查询类型

```graphql
type Query {
  nodes(enabledOnly: Boolean = true): [Node]
  node(id: Int!): Node
  serverHead: ServerHead
  serverHistory(hours: Int = 12): [ServerHistoryRecord]
  serverStats(hours: Int = 24): ServerStats
  serverUptime(hours: Int = 24): UptimeInfo
  players(onlineOnly: Boolean = false): [Player]
  player(name: String!, days: Int = 30): PlayerDetail
  onlinePlayers: [Player]
}
```

#### 类型定义

```graphql
type Node {
  id: Int
  name: String
  host: String
  port: Int
  color: String
  enabled: Boolean
  latestStatus: NodeStatus
  latencyStats: LatencyStats
  history(hours: Int = 12): [NodeHistoryRecord]
}

type LatencyStats {
  uptimePercentage: Float
  avgLatency: Float
  stdDev: Float
  minLatency: Float
  maxLatency: Float
  p95Latency: Float
  cv: Float
  totalChecks: Int
  onlineChecks: Int
}

type Player {
  playerName: String
  online: Boolean
  sessionStart: String
  lastSeen: String
  durationSeconds: Int
  servers: [PlayerServerEntry]
}
```

### 6.9 类 SQL 查询 API (`/api/query`)

#### `GET /schema`
获取可查询的表结构

#### `POST /`
执行类 SQL 查询

**请求体**:
```json
{
  "query": "SELECT name, host FROM servers WHERE id = 1"
}
```

**支持语法**:
- SELECT field1, field2 FROM table
- SELECT * FROM table
- SELECT COUNT(*) FROM table
- WHERE 条件 (=, !=, <>, <, >, <=, >=, LIKE, IN, NOT IN, IS NULL, IS NOT NULL)
- ORDER BY field ASC/DESC
- LIMIT n OFFSET m
- 聚合函数: COUNT, SUM, AVG, MIN, MAX

**允许查询的表**: servers, status_logs, player_sessions, player_session_history

---

## 7. WebSocket 实时通信

### 7.1 连接配置

- **端点**: `/api/socket.io`
- **跨域**: 允许所有来源 (`cors_allowed_origins="*"`)

### 7.2 事件

#### 服务端发送事件

| 事件名 | 数据 | 描述 |
|--------|------|------|
| `poll_complete` | `{"timestamp": "ISO时间"}` | 一轮轮询完成 |

#### 客户端行为

前端在收到 `poll_complete` 事件后，会调用 `/api/web/server/head` 获取增量数据更新 UI。

### 7.3 连接状态

前端显示 WebSocket 连接状态：
- `ws-connecting`: 连接中（黄色）
- `ws-connected`: 已连接（绿色）
- `ws-disconnected`: 已断开（灰色）

---

## 8. 前端架构

### 8.1 页面结构

| 页面 | URL | 模板 | 功能 |
|------|-----|------|------|
| 服务器 | `/server` | server.html | 聚合监控面板 |
| 节点 | `/nodes` | nodes.html | 节点列表和详情 |
| 玩家 | `/players` | players.html | 玩家列表 |
| 玩家详情 | `/player/<name>` | player_detail.html | 玩家会话历史 |
| Badges | `/badges` | badges.html | Badge 展示 |

### 8.2 数据加载模式

**初始加载**:
1. 调用 `/api/web/server` 获取完整数据
2. 渲染图表和列表

**增量更新**:
1. 监听 WebSocket `poll_complete` 事件
2. 调用 `/api/web/server/head` 获取增量数据
3. 更新图表数据点和 UI 状态

**手动刷新**:
- 点击刷新按钮触发 `manualRefresh()` 重新全量加载

### 8.3 图表配置

**延迟对比图** (line chart):
- X 轴: 时间戳（升序）
- Y 轴: 延迟（毫秒）
- 多系列: 每个节点一条线

**玩家趋势图** (line chart):
- X 轴: 时间戳
- Y 轴: 玩家数量

**在线状态图** (bar chart):
- 显示在线/离线状态

**热力图** (自定义):
- 24 小时状态可视化
- 每小时一格

### 8.4 响应式设计

- 移动端侧边栏折叠
- 表格响应式滚动
- 图表自适应大小

### 8.5 PWA 支持

**manifest.json**:
- 应用名称、图标、主题色
- 启动配置

**Service Worker**:
- 静态资源缓存
- 离线访问支持

---

## 9. 配置系统

### 9.1 配置文件格式 (TOML)

```toml
# 基础配置
server_name = "MyMinecraftServer"
database = "minecraft_stats.db"
poll_interval = 15
port = 5011

# 节点配置
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

# PostgreSQL 配置（可选）
[postgresql]
host = "localhost"
port = 5432
database = "motdtracker"
user = "postgres"
password = "your_password"

# NapCat 告警配置（可选）
[napcat_alert]
host = "napcat-host:port"
groups = ["123456789"]
delta_minutes = 30
offline_confirm_frames = 3
online_confirm_frames = 3
enable = true

# Umami 分析配置（可选）
[umami]
enabled = true
script_url = "https://analytics.example.com/script.js"
website_id = "your-website-id"
domains = "example.com"
```

### 9.2 配置加载

```python
def load_config(config_path: str = None) -> Dict[str, Any]:
    # 默认查找 config.toml
    # 不存在则抛出 FileNotFoundError
    # 使用 tomllib 解析
```

### 9.3 配置项说明

| 配置项 | 类型 | 默认值 | 描述 |
|--------|------|--------|------|
| server_name | string | - | 服务器显示名称 |
| database | string | minecraft_stats.db | SQLite 数据库路径 |
| poll_interval | int | 60 | 轮询间隔（秒）|
| port | int | 5011 | Web 服务端口 |
| nodes | array | - | 节点配置列表 |
| postgresql | object | - | PostgreSQL 配置 |
| napcat_alert | object | - | 告警配置 |
| umami | object | - | 分析配置 |

---

## 10. Rust 重构建议

### 10.1 推荐项目结构

```
motdtracker-rs/
├── Cargo.toml
├── config.example.toml
│
├── src/
│   ├── main.rs                 # 入口
│   ├── lib.rs                  # 库导出
│   │
│   ├── config/
│   │   ├── mod.rs
│   │   └── loader.rs           # 配置加载
│   │
│   ├── core/
│   │   ├── mod.rs
│   │   ├── monitor.rs          # MC 服务器查询
│   │   └── poller.rs           # 轮询器
│   │
│   ├── db/
│   │   ├── mod.rs
│   │   ├── trait.rs            # 数据库 trait
│   │   ├── sqlite.rs           # SQLite 实现
│   │   └── postgres.rs         # PostgreSQL 实现
│   │
│   ├── api/
│   │   ├── mod.rs
│   │   ├── server.rs           # 服务器 API
│   │   ├── node.rs             # 节点 API
│   │   ├── player.rs           # 玩家 API
│   │   ├── badge.rs            # Badge API
│   │   ├── exporter.rs         # Prometheus
│   │   ├── graphql.rs          # GraphQL
│   │   └── query.rs            # SQL 查询
│   │
│   ├── ws/
│   │   ├── mod.rs
│   │   └── handler.rs          # WebSocket 处理
│   │
│   ├── models/
│   │   ├── mod.rs
│   │   ├── server.rs           # 服务器模型
│   │   ├── player.rs           # 玩家模型
│   │   └── status.rs           # 状态模型
│   │
│   ├── utils/
│   │   ├── mod.rs
│   │   ├── time.rs             # 时间工具
│   │   └── stats.rs            # 统计计算
│   │
│   └── alert/
│       ├── mod.rs
│       └── napcat.rs           # 告警发送
│
├── static/                     # 静态文件
│   ├── css/
│   ├── js/
│   └── icons/
│
├── templates/                  # HTML 模板
│
└── migrations/                 # 数据库迁移
```

### 10.2 核心数据结构

```rust
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

/// 服务器节点配置
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct NodeConfig {
    pub id: i32,
    pub name: String,
    pub host: String,
    #[serde(default = "default_port")]
    pub port: u16,
    pub color: Option<String>,
    #[serde(default = "default_enable")]
    pub enable: bool,
}

fn default_port() -> u16 { 25565 }
fn default_enable() -> bool { true }

/// 服务器状态
#[derive(Debug, Clone, Serialize)]
pub struct ServerStatus {
    pub online: bool,
    pub latency: Option<f64>,
    pub players_online: Option<u32>,
    pub players_max: Option<u32>,
    pub version: Option<String>,
    pub motd: Option<String>,
    pub sample_players: Option<Vec<String>>,
    pub software: Option<String>,
    pub plugins: Option<Vec<String>>,
    pub map: Option<String>,
    pub error: Option<String>,
}

/// 状态日志记录
#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct StatusLog {
    pub id: i64,
    pub server_id: i32,
    pub timestamp: DateTime<Utc>,
    pub online: bool,
    pub latency: Option<f64>,
    pub players_online: Option<i32>,
    pub players_max: Option<i32>,
    pub version: Option<String>,
    pub motd: Option<String>,
    pub sample_players: Option<String>,  // JSON
    pub software: Option<String>,
    pub plugins: Option<String>,  // JSON
    pub map: Option<String>,
}

/// 玩家会话
#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct PlayerSession {
    pub server_id: i32,
    pub player_name: String,
    pub first_seen: DateTime<Utc>,
    pub session_start: Option<DateTime<Utc>>,
    pub last_seen: DateTime<Utc>,
    pub online: bool,
    pub duration_seconds: Option<i64>,
}

/// 延迟统计
#[derive(Debug, Clone, Serialize)]
pub struct LatencyStats {
    pub uptime_percentage: f64,
    pub avg_latency: Option<f64>,
    pub std_dev: Option<f64>,
    pub min_latency: Option<f64>,
    pub max_latency: Option<f64>,
    pub p95_latency: Option<f64>,
    pub cv: Option<f64>,
    pub total_checks: u32,
    pub online_checks: u32,
}
```

### 10.3 数据库 Trait

```rust
use async_trait::async_trait;

#[async_trait]
pub trait Database: Send + Sync {
    // 服务器管理
    async fn add_server(&self, name: &str, host: &str, port: u16, color: Option<&str>, server_id: Option<i32>) -> Result<i32, DbError>;
    async fn get_all_servers(&self) -> Result<Vec<Server>, DbError>;
    
    // 状态记录
    async fn log_status(&self, status: &StatusLogEntry) -> Result<(), DbError>;
    async fn get_server_latest_status(&self, server_id: i32) -> Result<Option<StatusLog>, DbError>;
    async fn get_server_history(&self, server_id: i32, limit: i32) -> Result<Vec<StatusLog>, DbError>;
    
    // 玩家会话
    async fn update_player_sessions(&self, server_id: i32, sample_players: &[String], timestamp: DateTime<Utc>) -> Result<(), DbError>;
    async fn get_online_players(&self, server_id: i32) -> Result<Vec<PlayerSession>, DbError>;
    async fn get_all_player_sessions(&self, server_id: i32) -> Result<Vec<PlayerSession>, DbError>;
    async fn get_player_history(&self, player_name: &str, days: Option<i32>) -> Result<Vec<PlayerSessionHistory>, DbError>;
    async fn get_all_player_names(&self) -> Result<Vec<String>, DbError>;
}
```

### 10.4 Minecraft 服务器查询实现

```rust
use tokio::net::TcpStream;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use byteorder::{BigEndian, ByteOrder};

pub struct MinecraftQuerier;

impl MinecraftQuerier {
    /// 查询 Java 版 Minecraft 服务器
    pub async fn query_server(host: &str, port: u16, timeout: Duration) -> ServerStatus {
        // 实现 Minecraft 服务器查询协议
        // 1. TCP 连接
        // 2. 发送握手包
        // 3. 发送状态请求包
        // 4. 接收状态响应（JSON）
        // 5. 解析响应
        
        // 参考协议: https://wiki.vg/Server_List_Ping
    }
    
    /// 发送握手包
    async fn send_handshake(stream: &mut TcpStream, host: &str, port: u16) -> Result<(), Error> {
        // 协议版本 + 地址 + 端口 + 状态(1)
    }
    
    /// 发送状态请求
    async fn send_status_request(stream: &mut TcpStream) -> Result<(), Error> {
        // 发送空请求包
    }
    
    /// 读取状态响应
    async fn read_status_response(stream: &mut TcpStream) -> Result<ServerStatus, Error> {
        // 读取变长帧长度
        // 读取 JSON 响应
        // 解析为 ServerStatus
    }
}
```

### 10.5 轮询器实现

```rust
use std::sync::Arc;
use tokio::task::JoinSet;
use tokio_cron_scheduler::Job;

pub struct ServerPoller {
    config: Arc<AppConfig>,
    db: Arc<dyn Database>,
    alert_state: Arc<RwLock<AlertState>>,
    ws_broadcaster: WsBroadcaster,
}

impl ServerPoller {
    pub async fn start(&self) -> Result<(), Error> {
        // 启动定时任务
        let poller = self.clone();
        let job = Job::new_recurring(
            Duration::from_secs(self.config.poll_interval),
            move |_uuid, _l| {
                let poller = poller.clone();
                tokio::spawn(async move {
                    poller.poll_all_servers().await;
                });
            }
        )?;
        
        // 立即执行首次轮询
        self.poll_all_servers().await;
        
        Ok(())
    }
    
    pub async fn poll_all_servers(&self) {
        let timestamp = Utc::now();
        let enabled_nodes: Vec<_> = self.config.nodes.iter()
            .filter(|n| n.enable)
            .collect();
        
        let mut tasks = JoinSet::new();
        
        for node in enabled_nodes {
            let db = self.db.clone();
            let node = node.clone();
            let ts = timestamp;
            
            tasks.spawn(async move {
                Self::poll_single_node(db, &node, ts).await
            });
        }
        
        // 等待所有任务完成
        while tasks.join_next().await.is_some() {}
        
        // 发送 WebSocket 通知
        self.ws_broadcaster.broadcast_poll_complete(timestamp).await;
        
        // 检查告警
        self.check_alerts().await;
    }
    
    async fn poll_single_node(db: Arc<dyn Database>, node: &NodeConfig, timestamp: DateTime<Utc>) {
        let status = MinecraftQuerier::query_server(&node.host, node.port, Duration::from_secs(5)).await;
        
        // 记录状态
        db.log_status(&StatusLogEntry {
            server_id: node.id,
            timestamp,
            online: status.online,
            latency: status.latency,
            // ...
        }).await;
        
        // 更新玩家会话
        if let Some(players) = &status.sample_players {
            db.update_player_sessions(node.id, players, timestamp).await;
        }
    }
}
```

### 10.6 API 路由 (Axum 示例)

```rust
use axum::{
    routing::{get, post},
    Router,
    Json,
    extract::{Path, Query, State},
};
use serde::Deserialize;

#[derive(Deserialize)]
pub struct HoursQuery {
    #[serde(default = "default_hours")]
    pub hours: u32,
}

fn default_hours() -> u32 { 12 }

pub fn create_router(state: AppState) -> Router {
    Router::new()
        // 服务器 API
        .route("/api/server/nodes", get(get_nodes))
        .route("/api/server/head", get(get_server_head))
        .route("/api/server/history", get(get_server_history))
        .route("/api/server/stats", get(get_server_stats))
        
        // 节点 API
        .route("/api/node/:id", get(get_node))
        .route("/api/node/:id/history", get(get_node_history))
        .route("/api/node/:id/stats", get(get_node_stats))
        
        // 玩家 API
        .route("/api/player", get(get_players))
        .route("/api/player/:name/detail", get(get_player_detail))
        .route("/api/player/:name/sessions", get(get_player_sessions))
        
        // Badge API
        .route("/api/badge/server/status", get(badge_server_status))
        .route("/api/badge/server/uptime", get(badge_server_uptime))
        
        // Prometheus
        .route("/api/exporter/metrics", get(prometheus_metrics))
        
        // 静态文件
        .fallback_service(ServeDir::new("static"))
        .with_state(state)
}

async fn get_nodes(
    State(state): State<AppState>,
) -> Json<Vec<NodeWithStats>> {
    let servers = state.db.get_all_servers().await;
    // 计算统计...
    Json(servers)
}

async fn get_server_history(
    State(state): State<AppState>,
    Query(query): Query<HoursQuery>,
) -> Json<ServerHistory> {
    let hours = query.hours.clamp(1, 720);
    // 查询历史数据...
    Json(history)
}
```

### 10.7 WebSocket 实现 (Axum)

```rust
use axum::{
    extract::ws::{WebSocket, WebSocketUpgrade, Message},
    response::Response,
};

pub struct WsBroadcaster {
    clients: Arc<RwLock<Vec<Sender<Result<Message, Error>>>>>,
}

impl WsBroadcaster {
    pub fn new() -> Self {
        Self {
            clients: Arc::new(RwLock::new(Vec::new())),
        }
    }
    
    pub async fn broadcast_poll_complete(&self, timestamp: DateTime<Utc>) {
        let msg = serde_json::json!({
            "event": "poll_complete",
            "data": {
                "timestamp": timestamp.to_rfc3339()
            }
        });
        
        let msg = Message::Text(msg.to_string());
        let clients = self.clients.read().await;
        
        for client in clients.iter() {
            let _ = client.send(msg.clone()).await;
        }
    }
    
    pub async fn handle_socket(&self, socket: WebSocket) {
        let (tx, mut rx) = socket.split();
        
        // 添加客户端
        self.clients.write().await.push(tx);
        
        // 保持连接
        while let Some(msg) = rx.next().await {
            match msg {
                Ok(Message::Ping(data)) => { /* pong */ }
                Ok(Message::Close(_)) => break,
                _ => {}
            }
        }
    }
}

// 路由处理
async fn ws_handler(
    ws: WebSocketUpgrade,
    State(broadcaster): State<Arc<WsBroadcaster>>,
) -> Response {
    ws.on_upgrade(|socket| async move {
        broadcaster.handle_socket(socket).await;
    })
}
```

### 10.8 统计计算

```rust
pub fn calculate_latency_stats(history: &[StatusLog]) -> LatencyStats {
    let total_checks = history.len() as u32;
    let online_checks = history.iter().filter(|h| h.online).count() as u32;
    
    let uptime_percentage = if total_checks > 0 {
        (online_checks as f64 / total_checks as f64) * 100.0
    } else {
        0.0
    };
    
    let latencies: Vec<f64> = history.iter()
        .filter(|h| h.online && h.latency.is_some())
        .map(|h| h.latency.unwrap())
        .collect();
    
    if latencies.is_empty() {
        return LatencyStats {
            uptime_percentage,
            avg_latency: None,
            std_dev: None,
            min_latency: None,
            max_latency: None,
            p95_latency: None,
            cv: None,
            total_checks,
            online_checks,
        };
    }
    
    let avg = statrs::statistics::Data::new(latencies.clone()).mean().unwrap();
    let std_dev = if latencies.len() > 1 {
        Some(statrs::statistics::Data::new(latencies.clone()).std_dev().unwrap())
    } else {
        Some(0.0)
    };
    
    let min = latencies.iter().cloned().fold(f64::INFINITY, f64::min);
    let max = latencies.iter().cloned().fold(f64::NEG_INFINITY, f64::max);
    
    // P95
    let mut sorted = latencies.clone();
    sorted.sort_by(|a, b| a.partial_cmp(b).unwrap());
    let p95_index = (sorted.len() as f64 * 0.95) as usize;
    let p95 = sorted.get(p95_index).copied().unwrap_or(max);
    
    // CV
    let cv = if avg > 0.0 && std_dev.is_some() {
        Some((std_dev.unwrap() / avg) * 100.0)
    } else {
        None
    };
    
    LatencyStats {
        uptime_percentage,
        avg_latency: Some(avg),
        std_dev,
        min_latency: Some(min),
        max_latency: Some(max),
        p95_latency: Some(p95),
        cv,
        total_checks,
        online_checks,
    }
}
```

### 10.9 Badge 生成

```rust
pub fn generate_badge(label: &str, value: &str, color: &str) -> String {
    // 简化版 SVG 生成
    // 可使用 badge crate 或自行实现
    
    format!(
        r#"<svg xmlns="http://www.w3.org/2000/svg" width="{}" height="20">
            <rect width="{}" height="20" fill="#555"/>
            <rect x="{}" width="{}" height="20" fill="{}"/>
            <text x="{}" y="14" fill="#fff" font-size="11">{}</text>
            <text x="{}" y="14" fill="#fff" font-size="11">{}</text>
        </svg>"#,
        // 参数...
    )
}
```

### 10.10 迁移步骤建议

1. **阶段一：核心功能**
   - 实现配置加载
   - 实现 Minecraft 服务器查询
   - 实现数据库层（SQLite 优先）
   - 实现基本 HTTP API

2. **阶段二：实时功能**
   - 实现 WebSocket
   - 实现轮询器
   - 实现告警系统

3. **阶段三：高级功能**
   - 实现 GraphQL API
   - 实现 Prometheus 导出
   - 实现 Badge 生成

4. **阶段四：前端适配**
   - 确保静态文件服务
   - 确保 API 兼容性
   - 测试 WebSocket 连接

5. **阶段五：数据迁移**
   - 从现有 SQLite 导出数据
   - 导入到新系统
   - 验证数据完整性

---

## 附录

### A. API 端点完整列表

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/` | 重定向到 /server |
| GET | `/server` | 服务器监控页面 |
| GET | `/nodes` | 节点列表页面 |
| GET | `/players` | 玩家列表页面 |
| GET | `/player/<name>` | 玩家详情页面 |
| GET | `/badges` | Badge 展示页面 |
| GET | `/api/docs` | Swagger UI |
| GET | `/api/graphiql` | GraphiQL 界面 |
| GET | `/api/server/nodes` | 获取节点列表 |
| GET | `/api/server/head` | 获取服务器状态 |
| GET | `/api/server/history` | 获取历史数据 |
| GET | `/api/server/history-compact` | 获取精简历史 |
| GET | `/api/server/stats` | 获取统计 |
| GET | `/api/server/uptime` | 获取在线率 |
| GET | `/api/server/status-timeline` | 获取状态时间线 |
| GET | `/api/server/players` | 获取在线玩家 |
| GET | `/api/server/config` | 获取配置 |
| GET | `/api/node/<id>` | 获取节点详情 |
| GET | `/api/node/<id>/history` | 获取节点历史 |
| GET | `/api/node/<id>/stats` | 获取节点统计 |
| GET | `/api/node/<id>/players` | 获取节点玩家 |
| GET | `/api/player` | 获取玩家列表 |
| GET | `/api/player/<name>/detail` | 获取玩家详情 |
| GET | `/api/player/<name>/sessions` | 获取玩家会话 |
| GET | `/api/player/<name>/heatmap` | 获取玩家热力图 |
| GET | `/api/web/server` | Web 完整数据 |
| GET | `/api/web/server/head` | Web 增量数据 |
| GET | `/api/web/node/<id>` | 节点完整数据 |
| GET | `/api/web/node/<id>/head` | 节点增量数据 |
| GET | `/api/badge/server/status` | 状态 Badge |
| GET | `/api/badge/server/uptime` | 在线率 Badge |
| GET | `/api/badge/server/players` | 玩家数 Badge |
| GET | `/api/badge/node/<id>/status` | 节点状态 Badge |
| GET | `/api/badge/node/<id>/uptime` | 节点在线率 Badge |
| GET | `/api/badge/node/<id>/players` | 节点玩家 Badge |
| GET | `/api/exporter/metrics` | Prometheus 指标 |
| GET | `/api/exporter/health` | 健康检查 |
| GET/POST | `/api/graphql` | GraphQL 查询 |
| GET | `/api/query/schema` | 查询架构 |
| POST | `/api/query` | 执行查询 |

### B. 错误码

| HTTP 状态码 | 描述 |
|------------|------|
| 200 | 成功 |
| 400 | 请求参数错误 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |

### C. 时间格式

- 所有时间使用 ISO 8601 格式
- 时区: UTC+8 (北京时间)
- 示例: `2026-01-17T12:34:56`

### D. 版本号格式

格式: `v{project_version}-{yyyymmddhhmmss}-{commit_hash}`

示例: `v1.5.1-20260117123456-abcdefabcdef`

---

*文档版本: 1.0*
*最后更新: 2026-03-29*
*适用项目版本: v1.5.1*
