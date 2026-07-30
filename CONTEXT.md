# MotdTracker 领域模型

## 核心概念

- **服务器组（Server Group）**：服务器的分组容器，含 `sort_order` 排序。对应表 `server_groups`。
- **服务器（Server）**：一个逻辑 Minecraft 服务器，可属于一个组（可选），下挂多个节点。对应表 `servers`。
- **节点（Node）**：服务器的一个连接入口（host:port + edition），是轮询和状态的实际对象。对应 `Node` 模型。
- **状态日志（Status Log）**：一次轮询的结果（在线、玩家数、延迟）。表 `status_logs`。
- **玩家会话（Player Session）**：某玩家在某节点的一段在线时间。表 `player_sessions`。
- **轮询器（Poller）**：`ServerPollerManager` 每轮从 DB 读取启用节点并查询，`poll_interval` 存于 `app_config`（默认 60 秒）。

## 架构决策中确立的概念

- **仪表盘快照（Dashboard Snapshot）**：`DashboardSnapshot::load(db, group_id, history_hours)` 返回的完全 join、预聚合数据（组 → 服务器 → 节点 → 最新状态 [+ 逐节点 24h 统计]）。所有 API handler（JSON/SVG/Prometheus）是快照之上的格式适配器。2026-07-30 架构评审确立：独立模块置于 Database trait 之上；单入口 + 可选历史；失败返回 Result（handler 映射 500，不再静默空数据）。
