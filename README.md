# MotdTracker - Minecraft 服务器监控系统

一个功能强大的 Minecraft Java 版服务器监控工具，支持多节点监控、实时数据展示、玩家追踪和 Prometheus 指标导出。

## ✨ 核心功能

- 📊 **多节点监控** - 支持监控多个服务器节点，自动聚合数据
- ⏱️ **实时数据** - 延迟、在线玩家、服务器版本等实时监控
- 👥 **玩家追踪** - 记录玩家上下线时间和在线时长
- 📈 **数据可视化** - Chart.js 图表展示延迟趋势、玩家数量变化
- 🔥 **热力图** - 24小时在线状态热力图
- 📡 **WebSocket** - 实时推送更新，无需刷新页面
- 🔌 **REST API** - 完整的 RESTful API 接口
- 📊 **Prometheus 导出器** - 支持 Prometheus 监控集成
- 💾 **SQLite 存储** - 轻量级数据库，无需额外配置

## 🚀 快速开始

### 安装依赖

```bash
# 使用 uv (推荐)
uv sync

# 或使用 pip
pip install -r requirements.txt
```

### 配置服务器

编辑 `config.json` 文件：

```json
{
  "servers": [
    {
      "name": "主服务器",
      "host": "mc.example.com",
      "port": 25565,
      "group": "MyServer"
    },
    {
      "name": "备用节点",
      "host": "backup.example.com",
      "port": 25565,
      "group": "MyServer"
    }
  ],
  "database": "minecraft_stats.db",
  "poll_interval": 60
}
```

### 启动应用

```bash
uv run main.py
```

访问 http://127.0.0.1:5000 查看监控面板

## ⚙️ 配置说明

### config.json 配置项

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `servers` | Array | ✓ | 服务器列表 |
| `servers[].name` | String | ✓ | 节点显示名称 |
| `servers[].host` | String | ✓ | 服务器地址 |
| `servers[].port` | Number | ✓ | 服务器端口（默认 25565） |
| `servers[].group` | String | ✗ | 分组名称，同组节点会被聚合显示 |
| `database` | String | ✓ | SQLite 数据库文件路径 |
| `poll_interval` | Number | ✓ | 轮询间隔（秒），建议 60-300 |

### 节点分组说明

- **相同 `group` 的节点会被聚合为一个服务器**
- 适用于同一服务器的多个区域节点（如 CDN、多线路入口）
- 聚合数据包括：
  - **在线玩家**：取任一在线节点的数据（共享玩家列表）
  - **平均延迟**：所有在线节点的平均延迟
  - **在线率**：整体可用性统计
  - **活跃节点数**：当前在线的节点数量

### 配置示例

```json
{
  "servers": [
    {
      "name": "主线入口",
      "host": "play.example.com",
      "port": 25565,
      "group": "MainServer"
    },
    {
      "name": "电信优化",
      "host": "telecom.example.com",
      "port": 25565,
      "group": "MainServer"
    },
    {
      "name": "联通优化",
      "host": "unicom.example.com",
      "port": 25565,
      "group": "MainServer"
    }
  ],
  "database": "minecraft_stats.db",
  "poll_interval": 60
}
```

## 📊 监控数据

### 服务器指标

- **当前延迟** - 实时网络延迟（ms）
- **24h 平均延迟** - 过去 24 小时的平均延迟
- **标准差 (σ)** - 延迟波动幅度
- **P95 延迟** - 95% 的请求延迟低于此值
- **变异系数 (CV)** - 稳定性指标（<10% 稳定，>30% 不稳定）
- **24h 在线率** - 服务器可用性百分比
- **在线玩家** - 当前在线玩家数量和列表

### 玩家数据

- 玩家上下线时间记录
- 在线时长统计
- 历史会话查询
- 跨节点去重（同一玩家不重复计数）

## 🌐 Web 界面

### 页面导航

- **服务器** (`/`) - 聚合视图，显示所有服务器整体状态
- **节点** (`/nodes`) - 单节点详细视图
- **玩家** (`/players`) - 玩家列表和统计

### 功能特性

- 📱 响应式设计，支持移动端
- 🔄 WebSocket 实时更新
- 📈 交互式图表（延迟趋势、玩家数量、在线状态）
- 🗓️ 24 小时热力图
- 🎨 暗色主题

## 🔌 API 文档

### 节点接口

- `GET /api/node` - 获取所有节点列表
- `GET /api/node/<id>` - 获取节点详情
- `GET /api/node/<id>/history` - 获取节点历史数据
- `GET /api/node/<id>/stats` - 获取节点统计信息
- `GET /api/node/<id>/online_players` - 获取节点在线玩家

### 服务器接口（聚合）

- `GET /api/server/nodes` - 获取所有节点（含延迟统计）
- `GET /api/server/history` - 获取聚合历史数据
- `GET /api/server/stats` - 获取聚合统计信息
- `GET /api/server/players` - 获取所有在线玩家（去重）

### 玩家接口

- `GET /api/players` - 获取所有玩家列表
- `GET /api/player/<name>` - 获取玩家详细信息
- `GET /api/player/<name>/sessions` - 获取玩家会话历史

### Prometheus 导出器

- `GET /api/exporter/metrics` - Prometheus 格式指标
- `GET /api/exporter/health` - 健康检查

## 📡 Prometheus 集成

### 配置 Prometheus

在 `prometheus.yml` 中添加：

```yaml
scrape_configs:
  - job_name: 'minecraft'
    static_configs:
      - targets: ['localhost:5000']
    metrics_path: '/api/exporter/metrics'
    scrape_interval: 60s
```

### 导出指标

- `minecraft_server_online` - 服务器在线状态（0/1）
- `minecraft_server_players` - 在线玩家数
- `minecraft_server_latency_avg_ms` - 平均延迟
- `minecraft_server_latency_min_ms` - 最小延迟
- `minecraft_server_latency_max_ms` - 最大延迟
- `minecraft_server_uptime_percentage` - 在线率
- `minecraft_server_sample_players_count` - 样本玩家数
- `minecraft_player_online` - 玩家在线状态
- `minecraft_player_session_duration_seconds` - 玩家在线时长

## 🛠️ 技术栈

- **后端**: Flask + Flask-SocketIO + Flask-RESTX
- **数据库**: SQLite
- **前端**: Vanilla JavaScript + Chart.js
- **实时通信**: Socket.IO
- **服务器查询**: mcstatus
- **任务调度**: APScheduler

## 📝 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！
