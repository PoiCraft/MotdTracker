# MotdTracker 后端代码审计报告

> 审计范围：`src/` 全部 Rust 源码、`tests/`、`Cargo.toml`、`config.toml`、`build.rs`
> 审计时间：2026-06-24

---

## 一、严重问题（Critical / High）

### 1.1 DoS 漏洞：恶意服务器返回超大 VarInt 长度导致内存耗尽
**文件**：`src/core/monitor.rs` — `read_status_response()`

服务器返回的 VarInt 长度被直接 `as usize` 用于分配 `Vec`：
```rust
let len = read_var_int(&mut buf).await? as usize;
let mut data = vec![0u8; len]; // 恶意服务器可返回 i32::MAX
```
恶意 MC 服务器可返回巨大的长度值（最大 2^31 - 1），导致进程被 OOM kill。

**修复建议**：加 cap，如 `let len = len.min(1024 * 1024); // 1MB 上限`

---

### 1.2 Panic 漏洞：`read_var_int_from_slice()` 无边界检查
**文件**：`src/core/monitor.rs`

```rust
fn read_var_int_from_slice(buf: &[u8]) -> (i32, usize) {
    let mut result = 0i32;
    for i in 0..5 {
        let byte = buf[i]; // 无长度检查，buf 不足时 panic
```
若 buffer 数据不足 5 字节，直接 index out of bounds panic。

**修复建议**：检查 `i < buf.len()`，不足时返回错误。

---

### 1.3 主机名长度截断：`send_handshake()` 使用 u8 存储长度
**文件**：`src/core/monitor.rs` — `send_handshake()`

```rust
let host_len = host.len() as u8; // 超过 255 字节静默截断
```
主机名超过 255 字节时，`as u8` 会截断，导致发送错误的 handshake 包。

**修复建议**：使用 `u16` 或在传入时校验长度上限。

---

### 1.4 防时序攻击的 dummy hash 无效
**文件**：`src/api/admin.rs` — `login()`

```rust
const DUMMY_HASH: &str = "$argon2id$v=19$m=65536,t=3,p=1$dGVzdHNhbHQ$invalidhashvalue00000000000000";
```
当用户名不存在时，代码用此 dummy hash 执行 `verify_password()` 试图消耗等量时间。但该 hash 字符串格式无效（base64 部分 `invalidhashvalue00000000000000` 不是合法的 Argon2 输出），`Argon2::verify_password` 会直接返回 `Err` 或 `Ok(false)` 而不执行实际的哈希计算。防时序攻击完全失效。

**修复建议**：预生成一个合法的 Argon2 hash（如对随机密码哈希一次），硬编码合法值。

---

### 1.5 管理员 API 无统一鉴权中间件
**文件**：`src/api/admin.rs`

每个 protected handler 都手动调用 `authenticate()`：
```rust
async fn some_handler(state, headers) {
    let _user = authenticate(&state.db, &headers).await?; // 容易遗漏
    // ...
}
```
一旦新增 handler 忘记加 `authenticate()`，就会暴露未认证的管理接口。最佳实践是使用 axum 中间件 / layer 统一拦截。

**修复建议**：将 protected 路由挂到带 `from_fn` 鉴权中间件的 `Router` 层上。

---

### 1.6 `move_node_up/down` 竞态条件
**文件**：`src/api/admin.rs`

```rust
// 1. 读取全量节点
let nodes = db.get_all_nodes_by_server(server_id).await?;
// 2. 找到目标节点和相邻节点
// 3. 分别更新两个节点的 sort_order（两次独立 UPDATE）
db.update_node_sort_order(&node.id, ...).await?;
db.update_node_sort_order(&neighbor.id, ...await?;
```
两步更新之间无事务保护，并发调用可导致 sort_order 混乱。

**修复建议**：用 `BEGIN TRANSACTION ... COMMIT` 包裹，或使用单条 SQL `CASE WHEN` 原子更新。

---

### 1.7 WebSocket token 通过 URL query 传递
**文件**：`src/api/mod.rs` — `ws_handler()`

```rust
Query(params): Query<HashMap<String, String>>
// token 从 URL ?token=xxx 获取
```
URL query 参数会出现在：
- 服务器访问日志（access log）
- 浏览器历史记录
- HTTP Referer 头
- 代理服务器日志

**修复建议**：改用 WebSocket 子协议（`Sec-WebSocket-Protocol`）或握手时的 Cookie 认证。

---

### 1.8 Prometheus metrics 端点未鉴权且暴露敏感信息
**文件**：`src/api/exporter.rs` — `prometheus_metrics()`

```rust
m.push_str(&format!(
    "motd_node_online{{...,host=\"{}\",port=\"{}\",...}}",
    node.map(|n| n.host.as_str()).unwrap_or(""),
    node.map(|n| n.port).unwrap_or(0),
    ...
));
```
- `host` 和 `port` 暴露所有被监控的 MC 服务器地址
- 标签值未做 Prometheus 转义（`"`、`\`、`\n` 会导致格式错误）
- 端点完全无认证

**修复建议**：
1. 对 label 值做 `escape`（替换 `"` -> `\"`、`\` -> `\\`、`\n` -> `\n`）
2. 考虑移除 `host`/`port` 或限制访问

---

## 二、中等问题（Medium）

### 2.1 `delete_server()` 孤立节点处理不一致
**文件**：`src/db/sqlite.rs`

```sql
-- delete_server():
UPDATE nodes SET server_id = '' WHERE server_id = ?1  -- 空字符串

-- delete_server_group():
UPDATE servers SET group_id = NULL WHERE group_id = ?1  -- NULL
```
空字符串 vs NULL 不一致，导致下游代码需要同时判断 `is_empty()` 和 `is_none()`，极易出 bug。

---

### 2.2 N+1 查询：`end_offline_sessions()`
**文件**：`src/db/sqlite.rs`

```rust
for player in &offline_players {
    let node = self.get_node(&player.node_id).await?; // N 次额外查询
    // ...
}
```
N 个离线玩家 = N 次额外 `get_node()` 查询。应批量查询或 JOIN。

---

### 2.3 逐条 INSERT：`update_player_sessions()`
**文件**：`src/db/sqlite.rs`

```rust
for (name, is_online, sample) in players {
    // 每个玩家一次 INSERT ... ON CONFLICT
    sqlx::query("INSERT INTO player_sessions ...").execute(...).await?;
}
```
N 个玩家 = N 次数据库写入。应使用批量 INSERT 或事务。

---

### 2.4 无数据库迁移系统
**文件**：`src/db/sqlite.rs` — `init_database()`

使用手写 `CREATE TABLE IF NOT EXISTS` 代替 `sqlx::migrate!`。无法处理字段新增/修改/删除等 schema 变更，后续升级只能靠手动 ALTER。

---

### 2.5 `validate_session()` 每次请求查库无缓存
**文件**：`src/db/sqlite.rs`

每个认证 API 请求都执行 `SELECT ... FROM admin_sessions WHERE token = ?`。高频请求下数据库连接池压力较大。建议加内存缓存（如 `DashMap<String, Arc<AdminUser>>` + TTL 过期）。

---

### 2.6 `list_nodes()` 对每个节点查询 720 小时历史
**文件**：`src/api/node.rs`

```rust
for n in filtered {
    let stats = state.db.get_node_history(&n.id, 720).await.ok()...; // 每个节点一次全量历史
}
```
列表接口对每个节点都拉取 720 小时（30 天）的完整历史记录来计算延迟统计，节点数量多时性能极差。应改为聚合查询（`SELECT AVG(latency), ... FROM status_logs WHERE ...`）或缓存。

---

### 2.7 `list_groups()` 全表扫描
**文件**：`src/api/groups.rs`

单次请求执行 4 次全表查询：
```rust
let groups = db.get_all_server_groups();       // 全表
let all_servers = db.get_all_servers();         // 全表
let all_nodes = db.get_all_nodes();             // 全表
let latest_status = db.get_all_latest_status(); // 全表
```
然后在内存中做 JOIN。数据量大时内存和 CPU 开销高。

---

### 2.8 `get_group()` 拉取全量节点
**文件**：`src/api/groups.rs`

```rust
let all_nodes = state.db.get_all_nodes().await.unwrap_or_default();
```
查看单个 group 时不需要拉取所有节点，应按 group 下的 server_id 过滤查询。

---

### 2.9 `get_server()` 拉取全量状态再过滤
**文件**：`src/api/servers.rs`

```rust
let latest_status = state.db.get_all_latest_status().await.unwrap_or_default();
// 然后在内存中 filter 出属于该 server 的节点
```
应直接按 server_id 查询相关节点的最新状态。

---

### 2.10 Prometheus 端点加载 24h 全量历史
**文件**：`src/api/exporter.rs`

```rust
let history = state.db.get_all_history(24).await.unwrap_or_default();
```
每次 `/metrics` 请求都加载所有节点 24 小时的完整状态日志，然后逐节点计算统计。Prometheus 通常 15 秒抓取一次，这个开销不可接受。

**修复建议**：缓存统计结果（TTL = 轮询间隔），或使用 SQL 聚合查询。

---

### 2.11 AlertManager 持有写锁期间发送 Webhook
**文件**：`src/alert/mod.rs` — `check_and_alert()`

```rust
let mut state = self.state.write().await; // 获取写锁
// ... 在持有写锁的情况下 ...
self.send_webhook("offline", ...).await;   // 网络请求，可能耗时 10s+
*state = AlertState::Offline;
```
Webhook HTTP 请求最多 10 秒超时，期间所有并发的 `check_and_alert()` 调用都被阻塞。

**修复建议**：先在锁内更新状态，释放锁后再发送 webhook。

---

### 2.12 AlertManager 嵌套锁可能死锁
**文件**：`src/alert/mod.rs`

在持有 `state` 写锁的同时获取 `last_alert_time` 写锁：
```rust
let mut state = self.state.write().await;
// ...
*self.last_alert_time.write().await = Some(now_gmt8()); // 嵌套写锁
```
虽然当前代码中锁顺序一致不会死锁，但这是危险的 pattern。

---

### 2.13 `now_gmt8()` 类型设计是 footgun
**文件**：`src/utils/time.rs`

```rust
pub fn now_gmt8() -> DateTime<Utc> {
    Utc::now() + Duration::hours(8)
}
```
返回 `DateTime<Utc>` 但实际值是 GMT+8 墙钟时间。任何直接调用 `Utc::now()` 的代码（不经过 `now_gmt8()`）都会产生 8 小时偏差，类型系统无法捕获这个错误。

同时，SQLite 的 `datetime('now')` 返回的是真实 UTC，与存储的"假 UTC"时间差 8 小时，导致 `get_player_heatmap()` 等依赖 SQLite 时间函数的查询结果偏移。

---

### 2.14 Webhook URL 无 SSRF 防护
**文件**：`src/alert/mod.rs`

用户配置的 webhook URL 直接用于 `reqwest::Client` 请求，无内网地址过滤。攻击者获取管理权限后可向 `http://127.0.0.1:xxx`、`http://169.254.169.254/` 等内网地址发送请求。

---

### 2.15 `render_template` 非原子替换
**文件**：`src/alert/mod.rs`

```rust
fn render_template(template: &str, vars: &HashMap<&str, &str>) -> String {
    let mut result = template.to_string();
    for (key, value) in vars {
        result = result.replace(&format!("{{{}}}", key), value);
    }
    result
}
```
若某个变量值中包含 `{另一个变量名}`，后续迭代会错误替换。应使用一次性替换（如 `regex` 或手写状态机）。

---

### 2.16 `update_settings()` 无法清除 webhook 配置
**文件**：`src/api/admin.rs`

```rust
if let Some(webhook) = webhook_alert {
    // 更新 webhook 配置
}
// None 时不做任何操作，保留旧配置
```
用户无法通过传 `null` 来禁用/清除已配置的 webhook 告警。

---

### 2.17 `config.example.toml` 为空文件
**文件**：`config.example.toml`

`load_config_with_fallback()` 会在 `config.toml` 不存在时回退到 `config.example.toml`，但该文件内容为空。解析空 TOML 虽然不会报错（所有字段用默认值），但作为示例文件完全没有指导作用。

---

### 2.18 `handle_socket` shutdown 条件冗余
**文件**：`src/ws/mod.rs`

```rust
result = shutdown_rx.changed() => {
    if result.is_ok() || result.is_err() { // 恒为 true
        // ...
        break;
    }
}
```
`result.is_ok() || result.is_err()` 恒为 `true`，等价于无条件 break。与 `poller.rs` 中的同类问题一致。

---

### 2.19 `client_count` 使用 RwLock 而非 AtomicUsize
**文件**：`src/ws/mod.rs`

```rust
client_count: Arc<RwLock<usize>>,
```
简单计数器使用 `RwLock` 是过度设计，应使用 `AtomicUsize`，开销更低且无需 async。

---

### 2.20 `embedded_static_handler` SPA fallback 过于宽泛
**文件**：`src/embedded.rs`

```rust
match Assets::get(path) {
    Some(content) => { /* 返回文件 */ }
    None => embedded_spa_fallback(), // 所有未找到的路径都返回 index.html
}
```
对 `.js`、`.css` 等静态资源 404 也返回 `index.html`（200），浏览器可能把 HTML 当 JS 解析导致报错。应只对非静态资源路径做 SPA fallback。

---

### 2.21 测试 DB 文件污染项目根目录
**文件**：`tests/integration_db_tests.rs`

```rust
let db_path = "test_init.db"; // 在工作目录（项目根）创建
```
如果测试 panic 或 cleanup 失败，`.db` 文件会留在项目根目录（当前已可见 `test_*.db` 文件）。应使用 `std::env::temp_dir()`。

---

### 2.22 `list_nodes` group 过滤使用 `Vec::contains` O(n) 查找
**文件**：`src/api/node.rs`

```rust
let server_ids_in_group: Vec<String> = all_servers.iter()
    .filter(|s| s.group_id.as_deref() == Some(gid.as_str()))
    .map(|s| s.id.clone()).collect();
all_nodes.iter().filter(|n| server_ids_in_group.contains(&n.server_id)) // O(n*m)
```
应使用 `HashSet` 达到 O(1) 查找。

---

## 三、低级别问题（Low）

### 3.1 疑似未使用的依赖
**文件**：`Cargo.toml`

- `rand = "0.10.1"` — 代码中未见直接使用（UUID v4 由 `uuid` crate 内部使用）
- `askama` — 未见模板文件
- `byteorder` — 未见使用
- `bytes` — 未见直接使用

建议运行 `cargo machete` 或 `cargo udeps` 确认后移除。

---

### 3.2 测试中包含真实外网服务器地址
**文件**：`src/core/monitor.rs`

```rust
#[cfg(test)]
// 测试连接 mc.hypixel.net、play.nethergames.org
```
CI 环境中网络不可用时测试会失败。应 mock 或标记为 `#[ignore]`。

---

### 3.3 `badge_player_live` badge 宽度无上限
**文件**：`src/api/badge.rs`

```rust
let server_names: Vec<String> = d.servers.iter()
    .filter(|s| s.online)
    .map(|s| s.server_name.clone()).collect();
// server_names.join(", ") 无长度限制
```
若玩家同时在线在大量服务器上，badge SVG 宽度可能极大。建议截断到前 N 个服务器名。

---

### 3.4 `get_player_heatmap()` 时区不一致
**文件**：`src/db/sqlite.rs`

SQL 中使用 `strftime('%w', timestamp)` 和 `strftime('%H', timestamp)` 计算星期和小时，但 `timestamp` 存储的是"假 UTC"（实际 GMT+8）时间。而 `datetime('now', ?)` 中的 `'now'` 返回的是真实 UTC。两套时间混用会导致热力图时区偏移。

---

### 3.5 `get_player_history()` 时间拼接
**文件**：`src/db/sqlite.rs`

```rust
let sql = format!(
    "SELECT ... WHERE session_end >= datetime('now', '-{} days')",
    days.unwrap_or(7)
);
```
`days` 直接拼入 SQL，虽然类型是 `Option<i32>` 不易注入，但应使用参数化查询。

---

### 3.6 `AdminUser` 序列化暴露 `password_hash`
**文件**：`src/models/admin.rs`

```rust
#[derive(Serialize, Deserialize, FromRow)]
pub struct AdminUser {
    pub password_hash: String, // 可被序列化到 JSON 响应
    // ...
}
```
若某处不小心将 `AdminUser` 作为 JSON 响应返回，密码哈希会泄露。应在 `password_hash` 字段加 `#[serde(skip)]`。

---

### 3.7 `ServerStatus` 中 `players_online`/`players_max` 类型为 `u32`
**文件**：`src/models/status.rs`

```rust
pub struct ServerStatus {
    pub players_online: Option<u32>,
    pub players_max: Option<u32>,
    // ...
}
```
但 `StatusLog` 和 `NodeStatus` 中使用 `Option<i32>`。类型不统一，在转换时需要 `as` 强转。

---

### 3.8 `port` 暴露在公开 status API
**文件**：`src/api/status.rs`

```rust
// 公开 API 返回:
// { "port": 5011, ... }
```
Web 服务端口号暴露在公开接口中，虽影响不大但属于不必要的信息泄露。

---

### 3.9 `AlertManager::update_config` 需要 `&mut self`
**文件**：`src/alert/mod.rs`

```rust
pub fn update_config(&mut self, config: WebhookAlertConfig, server_name: String) {
```
`AlertManager` 在实际使用中很可能被 `Arc` 包装，`&mut self` 无法直接调用。需要 `Arc<Mutex<AlertManager>>` 或改用内部可变性。

---

### 3.10 `unwrap()` 在 Response builder 上
**文件**：多个文件（`embedded.rs`、`badge.rs`、`exporter.rs`、`api/mod.rs`）

```rust
Response::builder()
    .status(StatusCode::OK)
    .body(Body::from(...))
    .unwrap() // 理论上不会失败，但 unwrap 在生产代码中不优雅
```
虽然 `Response::builder().body()` 极少失败，但建议使用 `expect("response builder")` 或 `?` + 错误处理。

---

## 四、架构设计建议

### 4.1 认证架构
当前：每个 handler 手动 `authenticate()` → 容易遗漏
建议：使用 axum middleware/layer 统一拦截 `protected` 路由

### 4.2 时间处理
当前：`DateTime<Utc>` 承载 GMT+8 墙钟时间，类型系统无法区分
建议：定义 newtype `Gmt8Time(DateTime<Utc>)`，或统一使用真实 UTC + 在序列化时转换

### 4.3 数据库查询优化
当前：大量"全表加载 + 内存 JOIN"模式
建议：
- 节点列表的延迟统计改用 SQL 聚合（`AVG`、`MIN`、`MAX` 等）
- group/server 详情查询使用 SQL JOIN 而非全表加载
- Prometheus 端点结果加缓存

### 4.4 数据库迁移
当前：`CREATE TABLE IF NOT EXISTS`
建议：引入 `sqlx::migrate!`，建立 `migrations/` 目录管理 schema 变更

### 4.5 错误处理
当前：大量 `unwrap_or_default()` 静默忽略数据库错误
建议：区分"无数据"和"查询失败"，对查询失败返回 500 或在日志中记录

---

## 五、问题汇总统计

| 严重级别 | 数量 | 关键项 |
|---------|------|--------|
| Critical/High | 8 | DoS 漏洞、panic 漏洞、防时序攻击失效、无鉴权中间件、竞态条件、WS token 泄露、Prometheus 信息泄露 |
| Medium | 22 | N+1 查询、全表扫描、锁持有期间网络请求、SSRF、类型设计 footgun、配置不可清除 |
| Low | 10 | 未使用依赖、测试外网依赖、类型不统一、信息泄露 |
| **总计** | **40** | |
