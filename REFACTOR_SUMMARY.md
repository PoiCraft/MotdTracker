# MotdTracker Rust 重构进度总结

**更新时间**: 2026-05-02 10:50 (UTC+8)
**状态**: Rust 后端 + React 前端全功能可用，前后端完全对接

---

## 执行总结

Rust 后端已完成所有核心 API 端点的实现，且全部与 React 前端的响应格式对齐。前端已从 Socket.IO 迁移到原生 WebSocket，直接对接 Rust 后端。Python 后端作为遗留方案保留。

### 关键成果

| 任务 | 状态 | 完成时间 |
|------|------|--------|
| Rust 后端编译 | 成功 (0 错误) | 2026-03-29 |
| 编译警告修复 | 全部清除 | 2026-03-29 |
| 交互式配置生成 | 已实现 | 2026-03-29 |
| 单元/集成测试 | 27 个全部通过 | 2026-03-30 |
| React 前端骨架 | 已完成 | 2026-03-30 |
| **前端 WebSocket 迁移** | Socket.IO → 原生 WebSocket | 2026-05-02 |
| **Web API 响应格式对齐** | 全部 4 个端点 | 2026-05-02 |
| **Player sessions 端点** | heatmap + daily + hourly_avg | 2026-05-02 |
| **Player weekly-stats 端点** | weekly_heatmap + weekday_preference | 2026-05-02 |
| **Badge 端点补全** | 12 个端点全部实现 | 2026-05-02 |
| **SPA 404 fallback** | React Router 路由支持 | 2026-05-02 |
| **README 更新** | 反映当前架构 | 2026-05-02 |

---

## 前后端对接详情 (2026-05-02)

### 1. WebSocket 协议统一

**问题**: React 前端使用 `socket.io-client`，Rust 后端使用原生 WebSocket（`/api/ws`），两者不兼容。

**方案**: 修改前端使用原生 WebSocket，而非在 Rust 中实现 Socket.IO。

**改动**:
- 新增 `frontend/src/utils/ws.js` — `useWebSocket` hook，使用浏览器原生 `WebSocket` API，支持自动重连
- 所有 6 个页面组件（ServerPage、NodeDetailPage、NodesPage、PlayersPage、PlayerDetailPage、BadgesPage）从 `socket.io-client` 迁移到 `useWebSocket` hook
- 移除 `socket.io-client` 依赖引用
- 移除 `api.js` 中的 `SOCKET_BASE` 导出

### 2. Web API 响应格式对齐

对照 Python 后端 (`routes/web_api.py`) 的响应格式，重写了 Rust 的 4 个 Web 端点：

| 端点 | 改动 |
|------|------|
| `GET /api/web/server` | 历史数据从 `HashMap<i32, Vec<StatusLog>>` 改为紧凑格式 `{timestamps, online, players_online, players_max, latencies}`；新增 `status_timeline`；`head` 字段补充 `timestamp`、`online`、`latencies`、`version`、`motd`、`nodes` |
| `GET /api/web/server/head` | 新增 `latest_history_point`（含 `latencies` 映射）用于增量图表更新；返回完整 `nodes`、`stats_by_id`、`players`、`head`、`config` |
| `GET /api/web/node/:id` | 历史数据从原始 `Vec<StatusLog>` 改为紧凑格式 `{timestamps, online, latency, players_online, players_max}`；新增 `status_timeline`、`config` |
| `GET /api/web/node/:id/head` | 新增 `latest_history_point`、`stats`、`status_timeline`、`config`；`server` 字段简化为 `{id, name, latest_status}` |

### 3. Player API 补全

| 端点 | 改动 |
|------|------|
| `GET /api/player/:name/sessions` | 全新实现：会话区间合并（多服务器去重）、按天/按小时切分、生成 heatmap `{date, hour, seconds}`、daily `{date, total_seconds, sessions}`、hourly_average `{hour, avg_seconds}` |
| `GET /api/player/:name/weekly-stats` | 全新实现：全量历史数据周统计，生成 7×24 weekly_heatmap `{day, day_name, hour, avg_seconds, sample_days}`、weekday_preference `{day, day_name, avg_seconds, sample_days}`、total_sample_days |

### 4. Badge 端点补全

原有 6 个端点（server status/uptime/players + node status/uptime/players），新增 6 个：

| 新端点 | 描述 |
|--------|------|
| `GET /api/badge/node/:id/latency` | 当前延迟 |
| `GET /api/badge/node/:id/latency-stats?stat=avg\|min\|max\|std\|cv\|p95` | 延迟统计 |
| `GET /api/badge/player/:name/status` | 玩家在线状态 |
| `GET /api/badge/player/:name/current-session` | 当前会话时长 |
| `GET /api/badge/player/:name/period-playtime?hours=N` | 时段游戏时长 |
| `GET /api/badge/player/:name/live` | 实时状态（含服务器名） |

### 5. SPA 静态文件服务

`main.rs` 改为：
- 优先从 `frontend/dist/` 提供静态文件（React 构建产物）
- 回退到 `static/`（兼容旧版 Python 前端资源）
- 未匹配路径返回 `index.html`（SPA 404 fallback，支持 React Router）

---

## 代码质量

| 指标 | 值 |
|------|-----|
| 编译错误 | 0 |
| 编译警告 | 0 (仅 sqlx-postgres 外部兼容性警告) |
| 测试数量 | 27 个 (7 单元 + 5 集成 + 15 工具) |
| 测试通过率 | 100% |
| 前端构建 | 成功 (759 KB gzip 240 KB) |

---

## 仍待完成

### 高优先级

- [ ] PostgreSQL 数据库适配器（trait 已设计，代码预留）
- [ ] 端到端集成测试（HTTP API 级别）

### 中优先级

- [ ] 性能基准测试
- [ ] API 文档（OpenAPI/Swagger）
- [ ] GraphQL API（可选）
- [ ] Docker 容器化

### 低优先级

- [ ] CI/CD 流水线
- [ ] 数据迁移工具（SQLite → PostgreSQL）

---

## 相关文件

- 详细进度: [RUST_REFACTOR_PROGRESS.md](RUST_REFACTOR_PROGRESS.md)
- 重构规格: [RUST_REFATOR_PROMPT.md](RUST_REFATOR_PROMPT.md)
- 项目配置: [motdtracker-rs/Cargo.toml](motdtracker-rs/Cargo.toml)
- 主入口: [motdtracker-rs/src/main.rs](motdtracker-rs/src/main.rs)
- 前端入口: [frontend/src/App.jsx](frontend/src/App.jsx)
