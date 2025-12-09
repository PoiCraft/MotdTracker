# MotdTracker AI Coding Instructions

## 项目概述

MotdTracker 是一个基于 Flask 的 Minecraft 多节点服务器监控系统，提供实时状态追踪、玩家会话管理、Prometheus 指标导出和 SVG Badge 生成。

**技术栈**: Flask + Flask-SocketIO + Flask-RESTX + APScheduler + mcstatus + (SQLite/PostgreSQL)

## 核心架构

### 三层数据库抽象
- **DatabaseBase** (`database_base.py`): ABC 抽象基类定义所有数据库操作接口
- **Database** (`database.py`): SQLite 实现（默认）
- **PostgreSQLDatabase** (`database_pgsql.py`): PostgreSQL 实现（可选高性能后端）
- **工厂模式** (`database_factory.py`): 根据 `config.json` 自动选择数据库，首次启动 PostgreSQL 时自动从 SQLite 迁移数据（带进度条）

**关键约定**: 新增数据库方法必须在 `DatabaseBase` 声明，然后在两个实现类中同步添加。

### 模块化路由注册
所有路由通过 `register_*_routes(api/app, poller)` 函数注册到 `main.py`：
- **pages.py**: Flask 页面路由（`/`, `/nodes`, `/players`）
- **node_api.py**: 节点 API (`/api/node/*`)
- **server_api.py**: 聚合服务器 API (`/api/server/*`)
- **player_api.py**: 玩家 API (`/api/player/*`)
- **exporter.py**: Prometheus 指标 (`/api/exporter/metrics`)
- **badge_api.py**: SVG Badge 生成 (`/api/badge/*`)
- **web_api.py**: Web 前端专用 API

**约定**: API 路由使用 Flask-RESTX Namespace，页面路由使用 Flask Blueprint。

### 轮询器与 WebSocket 推送
- **ServerPoller** (`poller.py`): 核心轮询器，使用 APScheduler 定时轮询所有节点
  - 并发查询: `ThreadPoolExecutor` 并行查询多个节点（最多 8 线程）
  - 时间戳同步: 同一轮次所有节点共享 `round_timestamp`（精确到秒）
  - 完成通知: 每轮结束后通过 `socketio.emit('poll_complete')` 推送前端
- **MinecraftMonitor** (`monitor.py`): mcstatus 封装，执行 `status()` 和 `query()` 协议查询
- **配置驱动**: `config.json` 的 `poll_interval` 决定轮询频率，24h 统计窗口自动计算为 `86400 / poll_interval`

## 关键开发约定

### 时区处理
**全局 UTC+8**: 使用 `app_utils.py` 中的工具函数，禁止直接使用 `datetime.now()`
```python
from app_utils import utc8_now, parse_dt  # ✅ 正确
timestamp = utc8_now()  # 始终使用 UTC+8

# ❌ 错误
timestamp = datetime.now()
```

### 版本管理
**Go Mod 伪版本格式**: `get_version()` 生成 `v{pyproject.toml version}-{timestamp}-{git hash}`
- 版本号在首次调用时生成并缓存
- 通过 `inject_version()` 上下文处理器全局可用于模板

### CSS 模块化
CSS 已拆分为 7 个模块（见 `static/css/README.md`）：
- `variables.css`: 全局 CSS 变量和重置
- `layout.css`: 页面布局和侧边栏
- `components.css`: 可复用 UI 组件
- `charts.css`: 图表容器
- `heatmap.css`: 24h 热力图
- `players.css`, `pages.css`, `modals.css`, `responsive.css`, `spinners.css`

**约定**: 新增样式必须放入对应模块，修改 `style.css` 只能调整 `@import` 顺序。

### 数据窗口计算
24h 统计基于 `poll_interval` 动态计算：
```python
limit = poller.get_24h_limit()  # 86400 / poll_interval
history = db.get_server_history(server_id, limit=limit)
```

## 开发工作流

### 环境设置
```bash
uv sync           # 安装所有依赖（包括 psycopg2-binary）
uv run main.py    # 启动服务（默认 0.0.0.0:5011）
```

### 添加新 API 端点
1. 在 `routes/` 下创建或修改路由文件
2. 使用 Flask-RESTX Namespace 定义资源类
3. 在 `main.py` 注册路由函数
4. Swagger 文档自动生成于 `/api/docs`

### 数据库迁移
**双数据库兼容**: 修改数据库 schema 时必须同步更新：
1. 在 `DatabaseBase` 添加抽象方法
2. 在 `Database` (SQLite) 实现
3. 在 `PostgreSQLDatabase` 实现
4. 更新 `database_factory.py` 中的迁移逻辑（如需要）

### 前端实时更新
WebSocket 连接到 `/api/socket.io`，监听 `poll_complete` 事件：
```javascript
socket.on('poll_complete', (data) => {
    // 刷新数据逻辑
});
```

## 项目特定模式

### 延迟统计指标
24h 窗口内计算 7 项指标（见 `database*.py` 的 `get_server_stats` 方法）：
- 在线率、平均延迟、标准差、最小值、最大值、P95、CV（变异系数）
- **CV 分级**: <10% 稳定，10-30% 中等，>30% 不稳定

### 玩家会话管理
- 基于 `sample_players` 列表更新会话状态（`update_player_sessions`）
- 服务器离线或无玩家列表时传入 `None`/空列表会标记所有在线玩家离线
- 会话时长精确到秒，基于 `session_start` 和当前时间差计算

### Badge 生成
使用 `anybadge` 库直接生成 SVG（`badge_api.py`）：
```python
badge = anybadge.Badge(label=label, value=value, default_color=color)
return Response(badge.badge_svg_text, mimetype='image/svg+xml')
```

### 节点配置颜色
`config.json` 的 `nodes[].color` 支持十六进制色值，用于图表和 UI 标识：
```json
{"name": "主线", "color": "#10b981"}
```

## 重要文件索引

- **配置**: `config.json` (服务器列表、轮询间隔、数据库)
- **启动**: `main.py` (Flask + SocketIO + 路由注册)
- **核心逻辑**: `poller.py` (轮询调度)、`monitor.py` (mcstatus 查询)
- **数据库**: `database_base.py` (接口)、`database.py` (SQLite)、`database_pgsql.py` (PostgreSQL)
- **迁移文档**: `POSTGRESQL.md`、`MIGRATION_PROGRESS.md`

## 测试与调试

- Swagger UI: `http://localhost:5011/api/docs`
- Prometheus 指标: `http://localhost:5011/api/exporter/metrics`
- 健康检查: `http://localhost:5011/api/exporter/health`

**日志**: APScheduler 和 ServerPoller 日志级别为 INFO，输出到控制台。
