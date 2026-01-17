# MotdTracker

<div align="center">

**Minecraft 多节点服务器监控面板**

基于 Flask + Flask-SocketIO + Flask-RESTX 的轻量级实时监控系统

[快速开始](#快速开始) • [功能特性](#功能特性) • [API 文档](#api-文档) • [配置说明](#配置说明)

</div>

---

## 概述

MotdTracker 是一个专为 Minecraft 服务器设计的实时监控系统，支持多节点聚合监控、玩家追踪、延迟统计分析与 Prometheus 集成。

**核心能力**
- 🚀 **实时监控** - WebSocket 推送，毫秒级延迟数据更新
- 📊 **数据可视化** - Chart.js 趋势图 + 24h 热力图，P95 自适应
- 👥 **玩家追踪** - 会话管理、在线时长统计、去重玩家列表
- 📈 **延迟分析** - 7 项 24h 统计指标（平均/标准差/P95/CV）
- 🔌 **Prometheus 集成** - 完整节点级指标导出
- 🎨 **可定制化** - 节点颜色配置，轮询间隔调整
- 💾 **灵活存储** - 双数据库支持（SQLite / PostgreSQL），自动迁移

---

## 快速开始

### 1. 安装依赖

```bash
# 推荐使用 uv（快速）
uv sync

# 或使用 pip
pip install -e .
```

### 2. 配置服务器

复制示例配置并修改：

```bash
cp config.example.json config.json
```

编辑 `config.json` 添加你的服务器节点：

```json
{
  "server_name": "PoiCraft",
  "nodes": [
    {
      "name": "主线入口",
      "host": "play.example.com",
      "port": 25565,
      "color": "#10b981"
    },
    {
      "name": "电信优化",
      "host": "ct.example.com",
      "port": 25565,
      "color": "#f59e0b"
    }
  ],
  "database": "minecraft_stats.db",
  "poll_interval": 15,
  "port": 5011
}
```

### 3. 启动服务

```bash
uv run main.py
```

访问 <http://127.0.0.1:5011> 查看监控面板。

---

## 功能特性

### 多节点监控

- **聚合视图** - Server 页面汇总所有节点在线率与延迟统计
- **独立展示** - Nodes 页面按节点查看详细数据与趋势
- **颜色标识** - 每个节点可配置专属颜色用于图表区分
- **实时状态** - 当前延迟、在线玩家数、服务器版本、MOTD

### 延迟统计分析（24h 窗口）

基于 `poll_interval` 动态计算窗口大小（`86400 / poll_interval` 条记录）：

| 指标 | 说明 | 用途 |
|-----|------|------|
| **在线率** | 24h 内成功查询占比 | 可用性评估 |
| **平均延迟** | 算术平均值 | 整体性能 |
| **标准差** | 数据离散程度 | 稳定性判断 |
| **最小/最大** | 极值统计 | 性能范围 |
| **P95** | 95 分位数 | 长尾性能 |
| **CV (变异系数)** | 标准差/平均值 × 100% | 稳定性分级 |

**CV 分级标准**
- ✅ **<10%** - 稳定（绿色）
- ⚠️ **10-30%** - 中等（黄色）
- ❌ **>30%** - 不稳定（红色）

### 玩家追踪

- **会话管理** - 自动记录玩家上线/下线，精确到秒
- **在线时长** - 实时计算当前会话时长
- **历史统计** - 查看玩家历史会话记录与总在线时长
- **去重列表** - Server 页聚合显示跨节点在线玩家（去重）

### 数据可视化

- **趋势图** - Chart.js 绘制延迟时序曲线，缺失值以 null 填充
- **热力图** - 24h 按小时聚合，颜色深度表示延迟高低
- **自适应 Y 轴** - 基于 P95 自动调整坐标轴范围，避免极值干扰
- **响应式布局** - 支持桌面与移动端浏览

### Prometheus 集成

**节点级指标**（带 `node` 标签）

```prometheus
# 实时状态
motd_server_online{node="主线入口"} 1
motd_server_players_online{node="主线入口"} 42
motd_server_players_max{node="主线入口"} 100
motd_server_latency_ms{node="主线入口"} 35.2

# 24h 统计
motd_server_uptime_percentage{node="主线入口"} 99.8
motd_server_avg_latency_ms{node="主线入口"} 28.5
motd_server_min_latency_ms{node="主线入口"} 15.0
motd_server_max_latency_ms{node="主线入口"} 120.0
motd_server_latency_stddev_ms{node="主线入口"} 8.3
motd_server_latency_p95_ms{node="主线入口"} 45.0
motd_server_latency_cv{node="主线入口"} 29.1
```

**玩家指标**（带 `player` 标签）

```prometheus
motd_player_online{player="Steve"} 1
motd_player_session_duration_seconds{player="Steve"} 3600
```

**汇总指标**

```prometheus
motd_players_count 42              # 当前在线玩家总数（去重）
motd_server_count 2                # 节点总数
motd_server_sample_players_count 42 # 节点玩家总数（未去重）
```

**Prometheus 配置示例**

```yaml
scrape_configs:
  - job_name: 'motdtracker'
    metrics_path: '/api/exporter/metrics'
    static_configs:
      - targets: ['127.0.0.1:5011']
    scrape_interval: 60s
```

健康检查端点：`/api/exporter/health`

---

## 项目结构

```
MotdTracker/
├── main.py                    # 应用入口（Flask + SocketIO + 路由注册）
├── config.json                # 配置文件（节点、数据库、端口）
├── config.example.json        # 配置模板
├── pyproject.toml             # 项目元数据与依赖
│
├── core/                      # 核心运行时逻辑
│   ├── poller.py             # ServerPoller（APScheduler 轮询调度）
│   └── monitor.py            # MinecraftMonitor（mcstatus 查询封装）
│
├── db/                        # 数据库抽象层
│   ├── database_base.py      # ABC 抽象基类
│   ├── database_sqlite.py    # SQLite 实现
│   ├── database_postgresql.py# PostgreSQL 实现
│   └── database_factory.py   # 工厂模式 + 自动迁移
│
├── routes/                    # Flask 路由模块
│   ├── pages.py              # 页面路由（/, /nodes, /players）
│   ├── server_api.py         # Server 聚合 API
│   ├── node_api.py           # 节点 API
│   ├── player_api.py         # 玩家 API
│   ├── exporter.py           # Prometheus 指标导出
│   ├── badge_api.py          # SVG Badge 生成
│   ├── web_api.py            # Web 前端专用 API
│   └── route_utils.py        # 路由通用工具
│
├── utils/                     # 通用工具库
│   ├── app_utils.py          # UTC+8 时间、版本管理、参数校验
│   └── badge_generator.py    # 本地 SVG Badge 生成器
│
├── scripts/                   # 运维脚本
│   ├── migrate.py            # SQLite → PostgreSQL 迁移工具
│   └── fix_pgsql.py          # PostgreSQL 表结构修复
│
├── static/                    # 前端静态资源
│   ├── css/                  # 模块化 CSS（7 个模块）
│   └── js/                   # Chart.js + Socket.IO
│
├── templates/                 # Jinja2 模板
│   ├── base.html             # 基础布局（侧边栏 + 头部）
│   ├── nodes.html            # 节点监控页
│   ├── server.html           # Server 聚合页
│   ├── players.html          # 玩家列表页
│   ├── player_detail.html    # 玩家详情页
│   └── badges.html           # Badge 生成指南
│
└── tests/                     # 测试用例
    └── test_badge.py         # Badge 生成器测试
```

### 关键约定

- **三层数据库抽象**
  - `DatabaseBase`: 定义所有操作接口
  - `Database` / `PostgreSQLDatabase`: 分别实现 SQLite / PostgreSQL
  - 新增方法必须在三处同步添加

- **时区处理** - 全局 UTC+8
  - 使用 `utils.app_utils.utc8_now()` 获取当前时间
  - 禁止直接使用 `datetime.now()`

- **版本管理** - Go Mod 伪版本格式
  - `v{pyproject.toml version}-{timestamp}-{git hash}`
  - 通过 `get_version()` 获取，首次调用时生成并缓存

- **CSS 模块化** - 7 个独立模块
  - `variables.css`, `layout.css`, `components.css`, `charts.css`, `heatmap.css`, `players.css`, `responsive.css`
  - 修改样式必须放入对应模块

---

## 配置说明

### 基础配置 (config.json)

```json
{
  "server_name": "PoiCraft",         // 服务器名称（显示在页面标题）
  "nodes": [                          // 节点列表
    {
      "name": "主线入口",             // 节点名称
      "host": "play.example.com",     // 服务器地址
      "port": 25565,                  // 服务器端口
      "color": "#10b981"              // 节点颜色（可选，十六进制）
    }
  ],
  "database": "minecraft_stats.db",   // SQLite 数据库文件路径
  "poll_interval": 15,                // 轮询间隔（秒）
  "port": 5011                        // Web 服务端口
}
```

**参数说明**

- `nodes[].color` - 可选，用于图表与 UI 标识，支持十六进制色值
- `poll_interval` - 轮询间隔，单位秒
  - 24h 统计窗口自动计算为 `86400 / poll_interval` 条记录
  - 示例：15 秒间隔 = 5760 条/24h

### PostgreSQL 支持（可选）

MotdTracker 支持使用 PostgreSQL 作为数据库后端，提供更好的并发性能和可扩展性。

#### 优势对比

| 特性 | SQLite | PostgreSQL |
|-----|--------|------------|
| **并发写入** | ⚠️ 有限制 | ✅ 完全支持 |
| **多连接** | ⚠️ 锁竞争 | ✅ 无锁定 |
| **数据量** | ✅ 适合小型 | ✅ 适合大型 |
| **网络访问** | ❌ 不支持 | ✅ 支持 |
| **备份恢复** | ⚠️ 需停机 | ✅ 在线备份 |
| **配置难度** | ✅ 零配置 | ⚠️ 需额外服务 |

#### 配置步骤

**1. 创建 PostgreSQL 数据库**

```bash
# 使用 psql 命令行
psql -U postgres -c "CREATE DATABASE motdtracker;"

# 或进入 psql 交互式环境
psql -U postgres
CREATE DATABASE motdtracker;
\q
```

**2. 添加配置**

在 `config.json` 中添加 `postgresql` 配置节：

```json
{
  "server_name": "PoiCraft",
  "nodes": [...],
  "database": "minecraft_stats.db",
  "poll_interval": 15,
  "postgresql": {
    "host": "localhost",
    "port": 5432,
    "database": "motdtracker",
    "user": "postgres",
    "password": "your_password"
  }
}
```

**3. 启动应用**

```bash
uv run main.py
```

应用会自动：
1. 检测 PostgreSQL 配置
2. 连接数据库并创建表结构
3. 检查是否存在 SQLite 数据库且未迁移过
4. 如果检测到未迁移数据，自动执行迁移（带进度条）
5. 备份原 SQLite 文件为 `minecraft_stats.db.migrated`
6. 后续启动检测到 `.migrated` 文件存在，自动跳过迁移

#### 数据迁移

**自动迁移（推荐）**

配置 PostgreSQL 后首次启动会自动迁移，过程包含：

```
======================================================================
开始数据迁移：SQLite → PostgreSQL
======================================================================

📊 统计数据量...
待迁移数据统计:
  • 服务器: 5 条
  • 状态日志: 12,345 条
  • 玩家会话: 678 条
  • 会话历史: 3,456 条
  • 总计: 16,484 条记录

🔄 [1/4] 迁移服务器数据...
    [██████████████████████████████████████████████████] 100% (5/5)
✅ 服务器迁移完成: 5 条

🔄 [2/4] 迁移状态日志...
    [████████████████████████████████████████████████████] 100% (12,345/12,345)
✅ 状态日志迁移完成: 12,345 条

======================================================================
✅ 数据迁移完成！
======================================================================

💾 备份原数据库: minecraft_stats.db.migrated
```

**手动迁移**

如需重新迁移或手动控制：

```bash
# 删除备份文件
rm minecraft_stats.db.migrated

# 运行迁移脚本
uv run scripts/migrate.py
```

**回退到 SQLite**

1. 从 `config.json` 中删除 `postgresql` 配置节
2. 重启应用即可自动使用 SQLite

#### 技术细节

**数据类型映射**

| 类型 | SQLite | PostgreSQL |
|-----|--------|------------|
| 布尔值 | INTEGER (0/1) | BOOLEAN |
| 时间戳 | DATETIME (文本) | TIMESTAMP WITHOUT TIME ZONE |
| 自增主键 | AUTOINCREMENT | SERIAL |
| 占位符 | `?` | `%s` |

**时间处理**

- **存储格式** - Naive datetime（不带时区信息）
- **PostgreSQL 类型** - `TIMESTAMP WITHOUT TIME ZONE`（避免自动时区转换）
- **统一时区** - 全局 UTC+8，使用 `utils.app_utils.utc8_now()` 生成时间戳

⚠️ **重要**：PostgreSQL 必须使用 `TIMESTAMP WITHOUT TIME ZONE`，否则会根据服务器时区进行自动转换导致时间混乱。

#### 故障排查

**布尔类型默认值错误**

```
PostgreSQL 连接失败: column "online" is of type boolean but default expression is of type integer
```

解决方法：

```bash
# 方法 1：使用修复脚本（推荐）
uv run scripts/fix_pgsql.py

# 方法 2：手动删除表后重启
psql -U postgres -d motdtracker -c "
DROP TABLE IF EXISTS player_session_history CASCADE;
DROP TABLE IF EXISTS player_sessions CASCADE;
DROP TABLE IF EXISTS status_logs CASCADE;
DROP TABLE IF EXISTS servers CASCADE;
"
```

**连接失败**

```
PostgreSQL 连接失败: connection refused, 回退到 SQLite
```

检查清单：
- [ ] PostgreSQL 服务是否运行
- [ ] 端口配置是否正确（默认 5432）
- [ ] 防火墙是否允许连接
- [ ] 用户名密码是否正确
- [ ] 数据库是否已创建

---

## API 文档

### Swagger UI

访问 <http://127.0.0.1:5011/api/docs> 查看完整交互式 API 文档。

### Server 聚合 API (前缀 `/api/server`)

| 端点 | 方法 | 说明 | 参数 |
|-----|------|------|------|
| `/nodes` | GET | 所有节点状态 + 24h 延迟统计 | - |
| `/history` | GET | 聚合历史趋势数据 | `hours` (1-72, 默认 24) |
| `/stats` | GET | 聚合 24h 统计指标 | - |
| `/players` | GET | 在线玩家列表（去重） | - |

**示例**

```bash
# 获取所有节点状态
curl http://localhost:5011/api/server/nodes

# 获取 48 小时历史数据
curl http://localhost:5011/api/server/history?hours=48
```

### 节点 API (前缀 `/api/node`)

| 端点 | 方法 | 说明 | 参数 |
|-----|------|------|------|
| `/` | GET | 所有节点基础信息 | - |
| `/<id>` | GET | 单节点当前状态 | - |
| `/<id>/history` | GET | 单节点历史数据 | `hours` (1-72, 默认 24) |
| `/<id>/stats` | GET | 单节点 24h 统计 | - |
| `/<id>/online_players` | GET | 单节点在线玩家 | - |

**示例**

```bash
# 获取节点 1 的状态
curl http://localhost:5011/api/node/1

# 获取节点 1 的 24h 历史
curl http://localhost:5011/api/node/1/history
```

### 玩家 API (前缀 `/api/player`)

| 端点 | 方法 | 说明 | 参数 |
|-----|------|------|------|
| `/<name>` | GET | 玩家详情与当前会话 | - |
| `/<name>/sessions` | GET | 玩家历史会话记录 | - |
| `/players` | GET | 所有在线玩家列表 | - |

**示例**

```bash
# 查询玩家 Steve 的详情
curl http://localhost:5011/api/player/Steve

# 查询 Steve 的历史会话
curl http://localhost:5011/api/player/Steve/sessions
```

### Prometheus Exporter (前缀 `/api/exporter`)

| 端点 | 方法 | 说明 |
|-----|------|------|
| `/metrics` | GET | Prometheus 格式指标 |
| `/health` | GET | 健康检查 |

---

## Badge 生成器

MotdTracker 内置本地 SVG Badge 生成器，无需依赖外部服务（如 shields.io）。

### 功能特性

- ✅ **完全本地化** - 不依赖外部 API，毫秒级生成
- ✅ **多种样式** - 支持 5 种 Badge 样式
- ✅ **颜色预设** - 内置常用颜色映射
- ✅ **文本转义** - 自动处理特殊字符
- ✅ **响应式宽度** - 根据文本长度自动调整
- ✅ **无障碍支持** - 包含 aria-label 和 title 标签

### 支持的样式

1. **Flat** (默认) - 经典平面设计，带轻微渐变
2. **Flat Square** - 完全平面的方形设计
3. **Plastic** - 塑料质感，带光泽效果
4. **For The Badge** - 大号字体，醒目设计
5. **Social** - 社交媒体风格，带分隔效果

### 颜色预设

| 颜色名称 | 十六进制 | 用途 |
|---------|---------|------|
| `brightgreen` | `#4c1` | 优秀状态 |
| `green` | `#97ca00` | 良好状态 |
| `yellow` | `#dfb317` | 警告 |
| `orange` | `#fe7d37` | 注意 |
| `red` | `#e05d44` | 错误/离线 |
| `blue` | `#007ec6` | 信息 |
| `success` | `#10b981` | 成功 |
| `warning` | `#f59e0b` | 警告 |
| `danger` | `#ef4444` | 危险 |

也可使用任何十六进制色值，如 `#ff0000`。

### API 使用

```python
from utils.badge_generator import generate_badge

# 生成简单 badge
svg = generate_badge('status', 'online', 'brightgreen')

# 指定样式
svg = generate_badge('build', 'passing', 'success', 'flat-square')

# 自定义颜色
svg = generate_badge('custom', 'badge', '#ff6600', 'plastic')
```

### HTTP 端点 (前缀 `/api/badge`)

访问 <http://127.0.0.1:5011/badges> 查看完整使用指南。

**示例**

```bash
# 生成状态 badge
curl http://localhost:5011/api/badge/status/online/brightgreen/flat

# 生成玩家在线 badge
curl http://localhost:5011/api/badge/players/42/blue/for-the-badge
```

### 与 shields.io 对比

| 特性 | MotdTracker | shields.io |
|-----|------------|------------|
| 网络依赖 | ❌ 无 | ✅ 需要 |
| 响应速度 | ⚡ <1ms | 🐌 100-500ms |
| 可用性 | ✅ 100% | ⚠️ 依赖服务 |
| 自定义性 | ✅ 完全可控 | ⚠️ 受限 |
| 样式数量 | 5 种 | 10+ 种 |
| 图标支持 | ❌ 无 | ✅ 有 |

---

## 开发与部署

### 环境要求

- Python >= 3.13
- 依赖管理工具：`uv` (推荐) 或 `pip`

### 开发工作流

```bash
# 克隆仓库
git clone https://github.com/PoiCraft/MotdTracker.git
cd MotdTracker

# 安装依赖
uv sync

# 运行开发服务器
uv run main.py
```

### 生产部署

**使用 Systemd**

创建 `/etc/systemd/system/motdtracker.service`：

```ini
[Unit]
Description=MotdTracker Minecraft Server Monitor
After=network.target postgresql.service

[Service]
Type=simple
User=motdtracker
WorkingDirectory=/opt/motdtracker
ExecStart=/usr/local/bin/uv run main.py
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

启动服务：

```bash
sudo systemctl daemon-reload
sudo systemctl enable motdtracker
sudo systemctl start motdtracker
```

**使用 Docker**

创建 `Dockerfile`：

```dockerfile
FROM python:3.13-slim

WORKDIR /app

# 安装 uv
RUN pip install uv

# 复制项目文件
COPY pyproject.toml ./
COPY . .

# 安装依赖
RUN uv sync

# 暴露端口
EXPOSE 5011

# 启动应用
CMD ["uv", "run", "main.py"]
```

构建并运行：

```bash
docker build -t motdtracker .
docker run -d -p 5011:5011 -v ./config.json:/app/config.json motdtracker
```

### 反向代理 (Nginx)

```nginx
server {
    listen 80;
    server_name monitor.example.com;

    location / {
        proxy_pass http://127.0.0.1:5011;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /socket.io/ {
        proxy_pass http://127.0.0.1:5011/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

---

## 技术栈

### 后端

- **Flask** - 轻量级 Web 框架
- **Flask-SocketIO** - WebSocket 实时推送
- **Flask-RESTX** - Swagger API 文档自动生成
- **APScheduler** - 任务调度（轮询器）
- **mcstatus** - Minecraft 服务器查询协议
- **psycopg2-binary** - PostgreSQL 驱动（可选）

### 前端

- **原生 JavaScript** - 无框架依赖
- **Chart.js** - 数据可视化
- **Socket.IO Client** - WebSocket 客户端
- **模块化 CSS** - 7 个独立模块

### 存储

- **SQLite** - 默认数据库，零配置
- **PostgreSQL** - 可选高性能后端

---

## 运维脚本

### 数据迁移 (scripts/migrate.py)

手动执行 SQLite → PostgreSQL 迁移：

```bash
uv run scripts/migrate.py
```

交互式确认，带完整进度条与统计信息。

### 表结构修复 (scripts/fix_pgsql.py)

修复早期版本的 PostgreSQL 布尔类型错误：

```bash
uv run scripts/fix_pgsql.py
```

删除旧表并重建结构，保留数据迁移逻辑。

---

## 测试

```bash
# 运行所有测试
uv run -m pytest -q

# 运行 Badge 生成器测试
uv run -m pytest tests/test_badge.py -v
```

---

## 许可证

MIT License

---

## 贡献指南

欢迎提交 Issue 与 Pull Request！

**提交前请确保：**
- 代码符合项目约定（见 `.github/copilot-instructions.md`）
- 新增数据库方法已在 `DatabaseBase`、`Database`、`PostgreSQLDatabase` 三处同步
- 时间处理使用 `utils.app_utils.utc8_now()`
- CSS 修改已放入对应模块
- 已运行测试并通过

---

## 鸣谢

- [mcstatus](https://github.com/py-mine/mcstatus) - Minecraft 服务器查询库
- [Chart.js](https://www.chartjs.org/) - 图表库
- [Flask](https://flask.palletsprojects.com/) - Web 框架

---

<div align="center">

**[返回顶部](#motdtracker)**

Made with ❤️ by PoiCraft Team

</div>
