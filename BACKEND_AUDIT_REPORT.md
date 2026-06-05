# MotdTracker 后端业务逻辑审计报告

## 审计范围
- API 路由与业务逻辑 (`src/api/`)
- 数据库操作 (`src/db/`)
- 轮询与监控 (`src/core/`)
- 告警系统 (`src/alert/`)
- WebSocket (`src/ws/`)
- 认证 (`src/auth/`)
- 主入口 (`src/main.rs`)

---

## 🔴 P0 — 严重逻辑错误（必须立即修复）

### 1. AlertManager 每次轮询都新建实例，确认帧配置完全失效
**位置**: `src/core/poller.rs:123`
```rust
AlertManager::new(cfg, sn)
    .check_and_alert(online > 0, online, total)
    .await;
```
**问题**: 每次轮询都创建新的 `AlertManager`，`online_streak` / `offline_streak` 始终从 0 开始。`offline_confirm_frames` 和 `online_confirm_frames` 配置永远不会生效，意味着网络抖动（单帧离线）就会触发告警。
**修复**: 将 `AlertManager` 改为单例，由 `ServerPollerManager` 持有并在轮询循环中复用。

### 2. 登录限流器速率与注释严重不符
**位置**: `src/main.rs:106-108`
```rust
// 注释: 每 IP 每 15 分钟最多 10 次尝试
let login_limiter = Arc::new(
    RateLimiter::keyed(Quota::per_minute(NonZeroU32::new(10).unwrap())),
);
```
**问题**: 注释说 15 分钟 10 次，实际代码是每分钟 10 次，速率差 15 倍。
**修复**: 改为 `Quota::per_minute(NonZeroU32::new(10).unwrap()).allow_burst(...)` 或 `Quota::per_hour(NonZeroU32::new(40).unwrap())`。

### 3. 时间处理语义根本性错误
**位置**: `src/utils/time.rs:15-17`
```rust
pub fn now_gmt8() -> DateTime<Utc> {
    Utc::now() + Duration::hours(8)
}
```
**问题**: `DateTime<Utc>` 被用来承载 GMT+8 的本地时间值。这不是真正的时区转换，而是把 UTC 时间简单加了 8 小时。这会导致：
- 语义错误：`DateTime<Utc>` 表示的是 UTC 时区，但值却是 GMT+8 的时间
- 夏令时问题：如果系统切换到夏令时，+8h 不再正确
- 外部工具兼容性：其他工具读取数据库时按 UTC 解析会得到错误时间
- 时间比较错误：与真实 UTC 时间比较会差 8 小时
**修复**: 引入 `chrono-tz` 使用 `Asia::Shanghai` 正确处理时区，或至少重命名函数并添加明确的时区偏移。

### 4. 批量插入可能超过 SQLite 参数限制
**位置**: `src/db/sqlite.rs:275-302`
```rust
builder.push_values(entries, |mut b, entry| {
    // 13 列绑定
});
```
**问题**: SQLite 默认单条 SQL 最多 999 个参数。13 列 × 条目数，当节点数超过 76 个时会报错。
**修复**: 对 `entries` 分批处理，每批限制在 50-60 个条目以内。

---

## 🟠 P1 — 明显逻辑问题（强烈建议修复）

### 5. Player API 存在 N+1 查询
**位置**: `src/api/player.rs:33-83`
**问题**: `get_players` 遍历所有玩家名字，对每个名字调用 `get_player_detail`，后者又会查询数据库。玩家数量大时性能极差。
**修复**: 添加批量查询接口，或使用 SQL JOIN 一次性获取所有需要的数据。

### 6. Poller 未使用已实现的批量日志写入
**位置**: `src/core/poller.rs:171-173`
```rust
if let Err(e) = db.log_status(&entry).await {
    error!("记录状态失败: {}", e);
}
```
**问题**: `poll_single` 对每个节点单独调用 `log_status`，但 `log_status_batch` 已经实现。N 个节点产生 N 次数据库写入。
**修复**: 在 `poll_all` 中收集所有 entry 后调用 `log_status_batch`。

### 7. real_client_ip 无条件信任代理 Header
**位置**: `src/api/admin.rs:118-141`
**问题**: 如果服务直接暴露在互联网上（无反向代理），客户端可以伪造 `X-Forwarded-For` 绕过 IP 限流。
**修复**: 添加可信代理 IP 白名单配置，或至少记录警告当日志中发现直接访问但带有这些 header。

### 8. health_check 不检查数据库连接
**位置**: `src/api/exporter.rs:148-149`
```rust
async fn health_check() -> &'static str {
    "OK"
}
```
**问题**: 仅返回字符串，不验证数据库是否可连接。在容器编排环境中，数据库断开时健康检查仍会返回 200。
**修复**: 添加数据库连接检查。

### 9. 部分 API 仍使用弱类型 Json<Value>
**位置**: `src/api/admin.rs:637-673` (groups), `src/api/admin.rs:715-792` (servers)
**问题**: `add_group`, `update_group`, `add_server`, `update_server` 使用 `Json<Value>`，而 `add_node`, `update_node` 使用强类型 DTO。API 设计不一致，缺少输入验证。
**修复**: 为这些接口添加强类型 DTO。

### 10. CORS 配置解析失败会导致 panic
**位置**: `src/main.rs:141`
```rust
.allow_origin(config.cors_origin.parse::<axum::http::HeaderValue>().expect("Invalid cors_origin"))
```
**问题**: 如果用户配置了非法的 cors_origin（如包含空格的字符串），程序直接 panic 而非返回错误信息。
**修复**: 使用 `match` 或 `if let` 优雅处理解析错误。

### 11. config_synced 未检测 sort_order 变更
**位置**: `src/core/poller.rs:21-36`
**问题**: `compute_config_hash` 没有包含 `sort_order` 字段。用户仅修改节点排序时，`config_synced()` 仍返回 true。
**修复**: 将 `sort_order` 加入哈希计算。

### 12. poll_all 忽略任务 panic/失败
**位置**: `src/core/poller.rs:76-84`
```rust
while let Some(r) = tasks.join_next().await {
    if let Ok((entry, pls)) = r { ... }
}
```
**问题**: 如果某个节点的查询任务 panic，`r` 为 Err，该节点不被计入 total，导致 `total < enabled_nodes.len()`。
**修复**: 在 Err 分支中记录错误并正确增加 total 计数。

---

## 🟡 P2 — 代码不一致/可改进

### 13. CreateNodeRequest 与 UpdateNodeRequestDto 完全重复
**位置**: `src/api/admin.rs:24-56`
**问题**: 两个结构体字段完全相同，代码冗余。
**修复**: 合并为一个 `NodeRequest` DTO，或使用 `#[serde(default)]` 使其同时适用于创建和更新。

### 14. 函数名与参数不匹配
**位置**: `src/db/sqlite.rs:345-351`
```rust
async fn get_server_history_for_group(&self, server_id: &str, hours: u32) -> Result<Vec<StatusLog>, DbError>
```
**问题**: 函数名说 "for_group"，但参数是 `server_id`，实际也是按 server_id 查询。
**修复**: 重命名为 `get_server_history`。

### 15. get_all_player_sessions_mut_node 命名不清
**位置**: `src/db/database_trait.rs:104-106`
**问题**: "mut_node" 含义不明。
**修复**: 重命名为 `get_player_sessions_by_node`。

### 16. list_nodes 中 latency_stats 始终为 None
**位置**: `src/api/node.rs:61-79`
**问题**: `NodeWithStats { latency_stats: None }` 永远为空值，字段没有实际用途。
**修复**: 使用 `calculate_latency_stats` 计算并填充该字段。

### 17. groups.rs 聚合逻辑重复
**位置**: `src/api/groups.rs:46-65`
**问题**: 手动计算在线数、玩家数等聚合指标，没有复用 `servers.rs` 中的 `compute_aggregate`。
**修复**: 提取公共聚合逻辑。

### 18. WebSocket 广播容量可能不足
**位置**: `src/ws/mod.rs:47`
```rust
let (sender, _) = broadcast::channel(256);
```
**问题**: 256 条消息缓冲，在高并发或快速轮询场景下可能丢失消息。
**修复**: 增大容量至 1024 或根据客户端数量动态调整。

### 19. reqwest::Client 未复用
**位置**: `src/alert/mod.rs:138`
**问题**: 每次发送 webhook 都创建新的 `reqwest::Client`。
**修复**: 使用共享的 client 实例。

### 20. extract_motd 未处理 "extra" 字段
**位置**: `src/core/monitor.rs:509-528`
**问题**: Minecraft MOTD JSON 常见格式 `{"text": "...", "extra": [...]}` 未被处理。
**修复**: 递归处理 `extra` 字段。

---

## 修复优先级建议

| 优先级 | 问题 | 影响 |
|--------|------|------|
| P0 | AlertManager 每次新建 | 告警系统完全失效（确认帧无效） |
| P0 | 限流器速率错误 | 安全性降低，暴力破解风险 |
| P0 | 时间语义错误 | 数据不一致，外部集成失败 |
| P0 | 批量插入参数限制 | 节点数 >76 时程序崩溃 |
| P1 | Poller 未用批量写入 | 性能问题，轮询间隔短时数据库压力大 |
| P1 | N+1 查询 | 玩家多时 API 响应极慢 |
| P1 | health_check 不检查 DB | 容器编排无法正确检测故障 |

---

## 当前测试状态
- `cargo check`: ✅ 通过
- `cargo test`: ✅ 43 个测试全部通过（但部分逻辑错误未被测试覆盖）

## 建议新增测试
1. AlertManager 连续帧计数测试
2. 限流器速率测试（验证 15 分钟窗口）
3. 批量插入 100+ 节点测试
4. health_check 在数据库断开时的行为测试
5. real_client_ip 伪造 header 测试
