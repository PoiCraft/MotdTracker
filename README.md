# MotdTracker — Minecraft 服务器多节点监控

基于 Flask + Flask-SocketIO + Flask-RESTX 的轻量监控面板，支持多节点聚合、实时图表、玩家追踪与 Prometheus 指标导出。

## 功能概览

- 多节点监控与聚合：按节点展示，也可在 Server 页聚合查看。
- 实时数据：延迟、在线玩家、版本，WebSocket 推送。
- 延迟统计（24h）：当前、在线率、平均、标准差、最小、最大、P95、CV。
- 数据可视化：Chart.js 趋势图，24h 热力图，P95 自适应 Y 轴。
- 玩家追踪：去重后的在线玩家列表与会话时长。
- Prometheus 导出：完整节点级延迟与在线率指标。
- 配色定制：节点可配置固定颜色用于图表与标识。
- 双数据库支持：SQLite（默认）或 PostgreSQL，支持平滑迁移。
- 轻量存储：轮询间隔可配置，24h 统计窗口随 poll_interval 动态计算。

## 环境要求

- Python >= 3.13
- 依赖见 `pyproject.toml`

## 快速开始

```bash
# 安装依赖（推荐）
uv sync

# 运行
uv run main.py
# 默认监听 0.0.0.0:5011，可在 config.json 的 port 中调整
```

打开：<http://127.0.0.1:5011>

## 配置 (config.json)

```json
{
    "server_name": "PoiCraft",
    "nodes": [
      { "name": "主线入口", "host": "play.example.com", "port": 25565, "color": "#10b981" },
      { "name": "电信优化", "host": "ct.example.com", "port": 25565, "color": "#f59e0b" }
    ],
    "database": "minecraft_stats.db",
    "poll_interval": 15,
    "port": 5011
}
```

- `nodes[].color` 可选，十六进制色值。
- `poll_interval` 单位秒；24h 统计窗口自动计算为 `86400 / poll_interval` 条。

### PostgreSQL 支持（可选）

支持使用 PostgreSQL 作为数据库，提供更好的并发性能。在 `config.json` 中添加：

```json
{
    "database": "minecraft_stats.db",
    "postgresql": {
        "host": "localhost",
        "port": 5432,
        "database": "motdtracker",
        "user": "postgres",
        "password": "your_password"
    }
}
```

首次启动时会自动从 SQLite 迁移数据到 PostgreSQL。详见 [POSTGRESQL.md](POSTGRESQL.md)。

## 页面

- `/` Server 聚合页：汇总在线率、延迟统计、趋势图、热力图、在线玩家。
- `/nodes` 节点列表：每节点的实时与 24h 统计、趋势图、热力图、在线玩家。
- `/players` 玩家页：去重在线玩家列表与会话信息。
- Swagger 文档：`/api/docs`

## API (前缀 /api)

- Server 聚合：`/server/nodes` (含延迟统计)、`/server/history`、`/server/stats`、`/server/players`
- 节点：`/node`、`/node/<id>`、`/node/<id>/history`、`/node/<id>/stats`、`/node/<id>/online_players`
- 玩家：`/player/<name>`、`/player/<name>/sessions`、`/players`
- Prometheus：`/exporter/metrics`、`/exporter/health`

## 延迟与稳定性指标（24h窗口）

- 当前延迟、在线率
- 平均值、标准差、最小值、最大值、P95
- CV (变异系数，%): <10% 稳定，10-30% 中等，>30% 不稳定
- 图表：缺失值以 null 填充，P95 驱动 Y 轴上限自适应

## Prometheus 指标 (前缀 motd_)

- 节点级：`motd_server_online`，`motd_server_players_online`，`motd_server_players_max`，`motd_server_latency_ms`
- 24h 统计：`motd_server_uptime_percentage`，`motd_server_avg_latency_ms`，`motd_server_min_latency_ms`，`motd_server_max_latency_ms`，`motd_server_latency_stddev_ms`，`motd_server_latency_p95_ms`，`motd_server_latency_cv`
- 玩家：`motd_player_online`，`motd_player_session_duration_seconds`
- 汇总：`motd_players_count`，`motd_server_count`，`motd_server_sample_players_count`
- 健康检查：`/api/exporter/health`
  Prometheus 抓取示例：

  ```yaml
  scrape_configs:
    - job_name: 'motdtracker'
      metrics_path: '/api/exporter/metrics'
      static_configs:
        - targets: ['127.0.0.1:5011']
      scrape_interval: 60s
  ```

## 运行与维护

- 终止：Ctrl+C，进程会优雅停止调度器。
- 端口：`config.json` 的 `port`。
- 数据库：支持 SQLite（默认）和 PostgreSQL，数据库文件/表由应用自动创建。
- 数据迁移：配置 PostgreSQL 后首次启动自动迁移，或使用 `uv run migrate.py` 手动迁移。

## 技术栈

- 后端：Flask, Flask-SocketIO, Flask-RESTX
- 计划任务：APScheduler
- MC 查询：mcstatus
- 前端：原生 JS + Chart.js
- 存储：SQLite / PostgreSQL

## 许可证

MIT
