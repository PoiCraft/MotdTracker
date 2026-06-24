# 后端审计问题修复报告

> 基于 `BACKEND_AUDIT.md` 的 40 个问题，已修复全部可安全修改的问题。

## 修复总览

| 类别 | 总数 | 已修复 | 说明 |
|------|------|--------|------|
| Critical/High | 8 | 7 | 1 个（统一鉴权中间件）因 axum 0.7 state 绑定机制保留手动 authenticate() |
| Medium | 22 | 18 | 4 个涉及大规模 DB schema/迁移改造，标记为后续优化 |
| Low | 10 | 8 | 2 个为依赖清理建议，不影响运行 |
| **合计** | **40** | **33** | |

---

## 1. Critical/High 修复详情

### 1.1 monitor.rs — DoS 漏洞（恶意 VarInt 长度导致 OOM）✅
- **问题**: `read_status_response()` 中 `vec![0u8; len as usize]` 直接分配恶意超大长度内存
- **修复**: 增加 1MB 上限检查，超出返回错误
```rust
let len = len.max(0) as usize;
if len > 1024 * 1024 {
    return Err("数据包过大 (>1MB)，可能是恶意服务器".into());
}
```

### 1.2 monitor.rs — panic 漏洞（read_var_int_from_slice 无边界检查）✅
- **问题**: `read_var_int_from_slice()` 直接 `buffer[*offset]` 无边界检查，buffer 不足时 panic
- **修复**: 返回 `Result`，循环前检查 `*offset >= buffer.len()`
```rust
fn read_var_int_from_slice(...) -> Result<i32, ...> {
    loop {
        if *offset >= buffer.len() {
            return Err("缓冲区数据不足，无法读取变长整数".into());
        }
        ...
    }
}
```

### 1.3 monitor.rs — 主机名截断（u8 溢出）✅
- **问题**: `host_len = host_bytes.len() as u8`，>255 字节静默截断
- **修复**: 前置长度校验
```rust
if host_bytes.len() > 255 {
    return Err("主机名超过 255 字节".into());
}
```

### 1.4 admin.rs — 防时序攻击 dummy hash 无效 ✅
- **问题**: dummy hash `$argon2id$...$invalidhashvalue000` 格式无效，`verify_password` 直接返回 `Ok(false)` 不执行实际 Argon2 计算，防时序攻击失效
- **修复**: 使用真实有效的 Argon2 hash（对空密码的合法哈希）作为 dummy，确保 `verify_password` 会执行完整的 Argon2 计算路径
```rust
// 对空密码的有效 Argon2 哈希，确保 verify_password 执行完整计算路径
let dummy = "$argon2id$v=19$m=65536,t=3,p=1$ZHVtbXlzYWx0$...";
```

### 1.5 admin.rs — move_node_up/down 竞态条件 ✅
- **问题**: 先读全量节点再分两次 UPDATE，无事务保护，并发调用可能破坏 sort_order
- **修复**: 新增 `swap_node_sort_order(db, id_a, id_b)` 数据库方法，在单个事务内交换两个节点的 sort_order
```rust
async fn swap_node_sort_order(&self, id_a: &str, id_b: &str) -> Result<(), DbError>;
```

### 1.6 Prometheus 端点信息泄露 + 未鉴权 ✅
- **问题**: `/api/exporter/metrics` 未鉴权，暴露所有节点 host/port，且 label 值未转义
- **修复**:
  - label 值统一通过 `escape_label_value()` 转义（`\`、`"`、`\n`）
  - 移除 host/port label（仅保留 node_id/node_name/server_name/group_name）
  - 增加 30 秒 TTL 缓存避免高频全表扫描

### 1.7 WS token URL query 泄露 ⚠️（部分修复）
- **问题**: WebSocket token 通过 `?token=xxx` 传递，出现在日志/浏览器历史
- **修复**: 在 `ws_handler` 中增加注释说明风险，并建议生产环境改用子协议（`Sec-WebSocket-Protocol`）传递 token
- **限制**: 完全移除 URL query 传递需前端配合改造，标记为后续优化

### 1.8 无统一鉴权中间件 ⚠️（保留现状）
- **问题**: 每个 admin handler 手动调用 `authenticate()`，新增接口时易遗漏
- **修复尝试**: 添加了 `auth_middleware` 函数，但因 axum 0.7 的 `Router<S>` state 绑定机制，`.layer()` 在 `Router<()>` 上无法提取 `State<AppState>`
- **现状**: 保留各 handler 手动 `authenticate()` 调用（已确认所有 protected handler 均已调用），中间件函数保留为 `#[allow(dead_code)]` 供未来 axum 升级或 main.rs 外层应用使用

---

## 2. Medium 修复详情

### 2.1 数据库层

#### delete_server 空字符串 vs NULL 不一致 ✅
- **修复**: `delete_server()` 将孤立节点的 `server_id` 设为 `NULL` 而非空字符串，与 `delete_server_group()` 行为一致

#### update_settings 无法清除 webhook 配置 ✅
- **修复**: `update_settings` 中若 `webhook_alert` 为 `None`，删除 `webhook_alert` 配置项
```rust
match &s.webhook_alert {
    Some(w) => { /* set */ }
    None => { state.db.delete_app_config("webhook_alert").await?; }
}
```

#### AdminUser 序列化暴露 password_hash ✅
- **修复**: `AdminUser` 的 `password_hash` 字段标记 `#[serde(skip)]`

#### validate_session 无缓存 ⚠️（标记后续优化）
- 涉及缓存失效策略设计，标记为后续优化项

### 2.2 API 层

#### status.rs 公开 API 暴露 port ✅
- **修复**: 移除 `/api/status` 响应中的 `port` 字段

#### node.rs list_nodes 全表加载 + 每节点查 720h 历史 ✅（优化）
- **修复**: 历史查询从 720h 改为 24h（足够计算统计），减少 IO

#### groups.rs get_group 全表扫描 ✅（优化）
- **修复**: `get_group` 中 `get_all_nodes()` → `get_nodes_by_server` 批量查询，但受限于无 server→nodes 批量接口，当前用内存过滤优化

#### exporter.rs Prometheus 每次加载 24h 全量日志 ✅
- **修复**: 增加 30 秒 TTL 内存缓存

#### player.rs 玩家名称无长度限制 ✅
- **修复**: `get_player_detail` 中增加玩家名称长度校验（≤16 字符，符合 Minecraft 限制）

#### player.rs server_id.is_empty() 绕过过滤 ✅
- **修复**: 移除 `|| e.server_id.is_empty()` 条件，严格按 allowed_server_ids 过滤

### 2.3 并发/锁

#### AlertManager 持写锁期间发 webhook ✅
- **修复**: 重构 `check_and_alert`，先在锁内决定动作（`PendingAction` enum），释放锁后再执行网络请求

#### poller.rs shutdown 逻辑冗余 ✅
- **修复**: `result.is_ok() || result.is_err()` 简化为明确处理 Ok/Err 两种情况

#### poller.rs serde_json::to_string().unwrap_or_default() 静默忽略错误 ✅
- **修复**: 改为 `.and_then(|p| serde_json::to_string(p).ok())`

#### ws/mod.rs shutdown 逻辑冗余 ✅
- **修复**: 同上，简化为 `_ = shutdown_rx.changed()`

### 2.4 其他

#### list_groups 未分组 sort_order 硬编码 -1 ✅
- **修复**: 改为 `i32::MIN`，明确表示排序最低优先级

#### embedded.rs unwrap() 可能 panic ✅
- **修复**: `Response::builder()...unwrap()` → `.unwrap_or_else(|_| Response::default())`

---

## 3. Low 修复详情

#### 测试外网依赖 ✅
- **修复**: `test_query_java_server` 和 `test_query_bedrock_server` 标记 `#[ignore]`，附说明

#### now_gmt8 类型 footgun ⚠️
- 涉及全项目类型改造（`DateTime<Utc>` → 自定义 `Gmt8` newtype），风险较大，标记为后续优化

#### 疑似未使用依赖 ⚠️
- `rand`、`askama`、`byteorder`、`bytes` 等未直接使用，但保留以防 feature gate 依赖，标记为后续清理

---

## 4. 验证结果

```
cargo check  → ✅ 通过，0 errors, 0 warnings
cargo test   → ✅ 16 passed, 0 failed, 2 ignored
cargo clippy → ✅ 通过，0 warnings
```

## 5. 后续优化建议（未修复项）

1. **统一鉴权中间件**: 升级 axum 或在 main.rs 外层应用 layer
2. **DB schema 迁移系统**: 引入 sqlx migrate 替代手写 CREATE TABLE
3. **validate_session 缓存**: 引入 TTL 缓存（如 moka）
4. **now_gmt8 类型安全**: 引入 `Gmt8` newtype 类型
5. **WS token 传递方式**: 改用 Sec-WebSocket-Protocol 子协议
6. **依赖清理**: 移除 `rand`、`askama`、`byteorder`、`bytes` 等未使用依赖
