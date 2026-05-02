# MotdTracker Rust 重构详细进度

> 最后更新: 2026-05-02 10:50 (UTC+8)

## 概述

本文档记录 MotdTracker 项目从 Python/Flask 重构到 Rust/Axum 的完整进度，包括后端 API、前端 React 对接、WebSocket 迁移等。

## 编译与测试状态

| 项目 | 状态 |
|------|------|
| `cargo build` | ✅ 成功 (0 错误, 0 代码警告) |
| `cargo test` | ✅ 27 个测试全部通过 |
| `npm run build` (frontend) | ✅ 成功 |

## 项目结构

```
motdtracker-rs/
├── Cargo.toml                ✅
└── src/
    ├── main.rs               ✅ Axum 入口 + SPA fallback
    ├── lib.rs                ✅
    ├── config/
    │   ├── mod.rs            ✅ AppConfig, NodeConfig, NapCatAlertConfig, UmamiConfig
    │   └── loader.rs         ✅ TOML 加载 + 交互式配置向导
    ├── models/
    │   ├── mod.rs            ✅
    │   ├── server.rs         ✅ Server, NodeWithStats, NodeStatus, LatencyStats, ServerHead
    │   ├── player.rs         ✅ PlayerSession, PlayerSessionHistory, PlayerDetail, PlayerHeatmap, PlayerListItem
    │   └── status.rs         ✅ StatusLog, StatusLogEntry, ServerStatus, QueryResult
    ├── db/
    │   ├── mod.rs            ✅
    │   ├── database_trait.rs ✅ async Database trait (20+ 方法)
    │   └── sqlite.rs         ✅ 完整 SQLite 实现 (sqlx)
    ├── core/
    │   ├── mod.rs            ✅
    │   ├── monitor.rs        ✅ MinecraftQuerier (原生协议查询)
    │   └── poller.rs         ✅ ServerPoller (JoinSet 并行轮询 + NapCat 告警)
    ├── utils/
    │   ├── mod.rs            ✅
    │   ├── stats.rs          ✅ calculate_latency_stats, get_uptime_color, get_latency_color
    │   └── time.rs           ✅ format_duration, hours_ago, days_ago, start_of_day
    ├── ws/
    │   ├── mod.rs            ✅ WsBroadcaster (broadcast channel) + handle_socket
    │   └── handler.rs        ✅ (空，逻辑在 mod.rs)
    ├── alert/
    │   ├── mod.rs            ✅
    │   └── napcat.rs         ✅ NapCat QQ 机器人告警
    └── api/
        ├── mod.rs            ✅ AppState + ws_handler
        ├── server.rs         ✅ /api/server/* (nodes, head, history, stats, uptime, players, config)
        ├── node.rs           ✅ /api/node/:id/* (detail, history, stats, players)
        ├── player.rs         ✅ /api/player/* (list, detail, sessions, weekly-stats, heatmap)
        ├── web.rs            ✅ /api/web/* (server, server/head, node/:id, node/:id/head)
        ├── badge.rs          ✅ /api/badge/* (12 个端点)
        ├── exporter.rs       ✅ /api/exporter/* (health, version, metrics)
        ├── query.rs          ✅ /api/query (简化 SQL 查询)
        └── pages.rs          ✅ HTML 页面路由 (Askama 模板，遗留)
```

## 模块详细进度

### 1. 配置模块 (100%)

| 组件 | 状态 | 描述 |
|------|------|------|
| AppConfig | ✅ | 主配置: server_name, database, poll_interval, port, nodes |
| NodeConfig | ✅ | 节点: id, name, host, port, color, enable |
| PostgreSQLConfig | ✅ | PostgreSQL 连接信息 |
| NapCatAlertConfig | ✅ | host, groups, delta_minutes, confirm_frames |
| UmamiConfig | ✅ | enabled, script_url, website_id, domains |
| TOML 加载器 | ✅ | load_config, load_config_from_path, load_config_with_fallback |
| 交互式向导 | ✅ | feature flag `interactive`，dialoguer CLI |

### 2. 数据模型 (100%)

| 模型 | 字段 | 用途 |
|------|------|------|
| Server | id, name, host, port, color | 服务器节点 |
| NodeWithStats | server + enabled + latest_status + latency_stats | 带状态的节点 |
| NodeStatus | timestamp, online, latency, players_online/max, version, motd | 最新状态 |
| LatencyStats | uptime%, avg, std_dev, min, max, p95, cv, total_checks, online_checks | 统计 |
| StatusLog | 12 个字段 (完整日志记录) | 状态日志 |
| StatusLogEntry | 同 StatusLog (用于插入) | 写入用 |
| PlayerSession | id, server_id, player_name, first_seen, session_start, last_seen, online, duration_seconds | 当前会话 |
| PlayerSessionHistory | id, server_id, player_name, session_start, session_end | 历史会话 |
| PlayerDetail | player_name, online, session_start, last_seen, duration_seconds, servers, sessions | 玩家详情 |
| PlayerListItem | player_name, online, session_start, last_seen, duration_seconds, servers | 列表项 |
| PlayerHeatmap | hour, weekday, count | 热力图原始数据 |

### 3. 数据库层 (100% SQLite, 0% PostgreSQL)

Database trait 定义了 20+ 个 async 方法：

| 方法分类 | 方法 |
|----------|------|
| 服务器管理 | add_server, get_all_servers, get_server, delete_server |
| 状态记录 | log_status, log_status_batch, get_server_latest_status, get_server_history, get_server_history_range, get_all_latest_status, get_all_history, cleanup_old_records |
| 玩家会话 | update_player_sessions, get_online_players, get_all_online_players, get_all_player_sessions, get_player_history, get_all_player_names, get_player_detail, get_player_heatmap, end_offline_sessions |
| 初始化 | init_database |

SQLite 实现使用 WAL 模式、30s busy_timeout、5 连接池。

### 4. 核心功能 (100%)

| 组件 | 描述 |
|------|------|
| MinecraftQuerier | 原生 Minecraft 协议查询 (握手 + 状态请求) |
| ServerPoller | JoinSet 并行轮询所有节点，共享时间戳，轮询完成后广播 WS 事件 |
| NapCat 告警 | 离线/恢复状态变化检测，连续帧确认，QQ 群消息推送 |

### 5. WebSocket (100%)

| 组件 | 描述 |
|------|------|
| WsBroadcaster | `broadcast::channel(256)` 广播器，支持多客户端 |
| 消息格式 | `{"event": "poll_complete", "data": {"timestamp": "..."}}` |
| 端点 | `GET /api/ws` (axum 原生 WebSocket upgrade) |
| 前端对接 | `useWebSocket` hook (原生 WebSocket API + 自动重连) |

### 6. API 端点 — 完整对照

#### Web 前端专用 (前端依赖的 4 个端点)

| 端点 | 响应格式 | 状态 |
|------|----------|------|
| `GET /api/web/server?hours=N` | `{nodes, stats_by_id, history:{timestamps,online,players_online,players_max,latencies}, uptime, status_timeline:{timestamps,online}, players, head:{timestamp,online,players_online,players_max,latencies,version,motd,nodes}, config}` | ✅ |
| `GET /api/web/server/head?hours=N` | 同上 + `latest_history_point:{timestamp,online,players_online,players_max,latencies}` | ✅ |
| `GET /api/web/node/:id?hours=N` | `{server:{id,name,host,port,color,latest_status}, history:{timestamps,online,latency,players_online,players_max}, stats, status_timeline, config}` | ✅ |
| `GET /api/web/node/:id/head?hours=N` | `{server:{id,name,latest_status}, stats, latest_history_point:{timestamp,online,latency,players_online,players_max}, status_timeline, config}` | ✅ |

#### 服务器 / 节点

| 端点 | 状态 |
|------|------|
| `GET /api/server/nodes` | ✅ Vec<NodeWithStats> |
| `GET /api/server/head` | ✅ ServerHead |
| `GET /api/server/history?hours=N` | ✅ HashMap<i32, Vec<StatusLog>> |
| `GET /api/server/stats` | ✅ HashMap<i32, LatencyStats> |
| `GET /api/server/uptime?hours=N` | ✅ HashMap<i32, f64> |
| `GET /api/server/players` | ✅ Vec<PlayerSession> (去重) |
| `GET /api/server/config` | ✅ {server_name, poll_interval, port, node_count} |
| `GET /api/node/:id` | ✅ NodeWithStats |
| `GET /api/node/:id/history?hours=N` | ✅ Vec<StatusLog> |
| `GET /api/node/:id/stats` | ✅ LatencyStats |
| `GET /api/node/:id/players` | ✅ Vec<PlayerSession> |

#### 玩家

| 端点 | 响应格式 | 状态 |
|------|----------|------|
| `GET /api/player` | Vec<PlayerListItem> (聚合去重) | ✅ |
| `GET /api/player/:name/detail` | PlayerDetail | ✅ |
| `GET /api/player/:name/sessions?days=N` | `{days, player_online, heatmap:[{date,hour,seconds}], daily:[{date,total_seconds,sessions:[{start,end,server_name}]}], average_daily_seconds, average_session_seconds, hourly_average:[{hour,avg_seconds}]}` | ✅ |
| `GET /api/player/:name/weekly-stats` | `{player_name, total_sample_days, weekly_heatmap:[{day,day_name,hour,avg_seconds,sample_days}], weekday_preference:[{day,day_name,avg_seconds,sample_days}]}` | ✅ |
| `GET /api/player/:name/heatmap?days=N` | Vec<PlayerHeatmap> | ✅ |

#### Badge (SVG)

| 端点 | 状态 |
|------|------|
| `GET /api/badge/server/status` | ✅ |
| `GET /api/badge/server/uptime?hours=N` | ✅ |
| `GET /api/badge/server/players` | ✅ |
| `GET /api/badge/node/:id/status` | ✅ |
| `GET /api/badge/node/:id/uptime?hours=N` | ✅ |
| `GET /api/badge/node/:id/latency` | ✅ |
| `GET /api/badge/node/:id/latency-stats?stat=avg\|min\|max\|std\|cv\|p95&hours=N` | ✅ |
| `GET /api/badge/node/:id/players` | ✅ |
| `GET /api/badge/player/:name/status` | ✅ |
| `GET /api/badge/player/:name/current-session` | ✅ |
| `GET /api/badge/player/:name/period-playtime?hours=N` | ✅ |
| `GET /api/badge/player/:name/live` | ✅ |

#### 其他

| 端点 | 状态 |
|------|------|
| `GET /api/exporter/health` | ✅ |
| `GET /api/exporter/version` | ✅ |
| `GET /api/exporter/metrics` | ✅ (简化版) |
| `GET /api/query` | ✅ (简化 SQL 查询) |
| `WS /api/ws` | ✅ |

#### Python 后端独有 (Rust 未实现)

| 端点 | 原因 |
|------|------|
| `GET /api/graphql` | 低优先级，feature flag `graphql` 已预留 |
| `GET /api/docs` (Swagger UI) | Flask-RESTX 特有，Rust 无对应 |

### 7. 静态文件与 SPA (100%)

| 功能 | 实现 |
|------|------|
| 静态文件服务 | `ServeDir` 优先 `frontend/dist/`，回退 `static/` |
| SPA fallback | 未匹配路径返回 `index.html`，支持 React Router |
| CORS | `CorsLayer::new().allow_origin(Any).allow_methods(Any)` |

## 测试清单

### 单元测试 (7 个)

| 测试 | 模块 |
|------|------|
| test_default_config | config::loader |
| test_config_with_defaults | config::loader |
| test_calculate_latency_stats | utils::stats |
| test_get_uptime_color | utils::stats |
| test_format_duration | utils::time |
| test_hours_ago | utils::time |
| test_query_server | core::monitor |

### 集成测试 (5 个)

| 测试 | 描述 |
|------|------|
| test_sqlite_database_initialization | 建表 + 索引 |
| test_add_and_retrieve_server | 服务器 CRUD |
| test_log_and_retrieve_status | 状态日志写入查询 |
| test_player_sessions | 玩家会话管理 |
| test_get_server_history | 历史数据检索 |

### 工具测试 (15 个)

| 测试 | 描述 |
|------|------|
| test_calculate_latency_stats_all_offline | 全离线统计 |
| test_calculate_latency_stats_all_online | 全在线统计 |
| test_calculate_latency_stats_mixed | 混合统计 |
| test_calculate_latency_stats_single_entry | 单条记录 |
| test_empty_history | 空历史 |
| test_p95_calculation | P95 计算 |
| test_standard_deviation_calculation | 标准差计算 |
| test_get_uptime_color | 在线率颜色 |
| test_get_latency_color | 延迟颜色 |
| test_format_duration | 时长格式化 |
| test_hours_ago | 小时偏移 |
| test_days_ago | 天偏移 |
| test_is_within_range | 时间范围判断 |
| test_start_of_day | 当天开始 |
| test_end_of_day | 当天结束 |

## 依赖版本

| Crate | 版本 | 用途 |
|-------|------|------|
| axum | 0.7 | Web 框架 (含 ws feature) |
| axum-extra | 0.9 | 额外提取器 |
| tower | 0.4 | 中间件 |
| tower-http | 0.5 | CORS, ServeDir, Trace |
| tokio | 1 | 异步运行时 (full) |
| serde / serde_json | 1 | 序列化 |
| sqlx | 0.7 | 数据库 (sqlite, chrono, migrate) |
| toml | 0.8 | 配置解析 |
| chrono | 0.4 | 时间处理 |
| reqwest | 0.12 | HTTP 客户端 (告警用) |
| tracing / tracing-subscriber | 0.1 / 0.3 | 日志 |
| async-trait | 0.1 | 异步 trait |
| thiserror / anyhow | 1 | 错误处理 |
| statrs | 0.16 | 统计计算 |
| futures | 0.3 | StreamExt, SinkExt |
| tokio-cron-scheduler | 0.9 | 定时轮询 |
| dialoguer | 0.11 | 交互式 CLI (feature `interactive`) |
| askama | 0.12 | HTML 模板 (遗留页面) |

## 编译修复记录

1. `axum-extra` 不含 `ws` feature → 改用 `axum::extract::ws`
2. `tower_http::fs::ServeDir` → `tower_http::services::ServeDir`
3. `PlayerHeatmap` 缺少 `FromRow` derive → 添加并修改字段类型
4. `servers.into_iter()` 所有权问题 → 改为 `.iter()` + `.clone()`
5. `main.rs` 错误处理 → 移除 `anyhow::Result`，显式 match
6. 前端 WebSocket 迁移时 `wsStatus` 重复声明 → 移除 useState
7. `SessionInfo` 缺少 `Serialize` → 添加 derive
8. `HourAccum`/`WeekdayTotal` 缺少 `Clone` → 添加 derive
9. String vs &str 比较 → 使用 `.as_str()` 或 `.to_string()`
10. `get_latency_color` 返回 `&str` vs `String` → 统一为 `.to_string()`

## 下一步

| 优先级 | 任务 |
|--------|------|
| 高 | PostgreSQL 适配器实现 |
| 高 | HTTP API 级集成测试 |
| 中 | 性能基准测试 |
| 中 | API 文档 (OpenAPI) |
| 低 | Docker 容器化 |
| 低 | GraphQL (feature flag 已预留) |
