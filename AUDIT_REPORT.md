# MotdTracker 完整安全与代码审计报告

> **审计日期**: 2026-06-05  
> **审计范围**: 全部 Rust 后端源码 + React/TypeScript 前端源码 + 基础设施配置  
> **审计版本**: v2.0.0 (commit 未记录)  

---

## 1. 执行摘要

本项目是一个 Minecraft 服务器多入口点实时监控系统，采用 **Rust (Axum) + React (TypeScript)** 前后端分离架构，前端资源通过 `rust-embed` 编译期嵌入二进制，实现单文件部署。

| 维度 | 评级 | 关键发现 |
|------|------|----------|
| **安全性** | ⚠️ C+ | CORS 过度开放、无速率限制、Token 存储方式存在 XSS 风险 |
| **代码质量** | B | 结构清晰，但存在大量重复代码、错误信息丢失、部分文件过长 |
| **架构设计** | B+ | 模块化良好，前后端类型基本对齐，Database trait 抽象合理 |
| **性能** | B | 数据库查询部分可优化，前端存在 mock 数据问题 |
| **可靠性** | B | 优雅关闭完善，但存在数据一致性风险和轻微竞态条件 |
| **基础设施** | A- | CI/CD 完善，Docker 安全配置良好，但 build.rs 强依赖 npm |

**总计发现问题**: 18 项  
- 🔴 **严重 (Critical)**: 2 项
- 🟠 **高风险 (High)**: 5 项  
- 🟡 **中风险 (Medium)**: 6 项
- 🟢 **建议 (Low)**: 5 项

---

## 2. 详细发现

### 🔴 严重问题 (Critical)

#### C-001: CORS 配置完全开放
**位置**: `src/main.rs:123`
```rust
.layer(CorsLayer::new().allow_origin(Any).allow_methods(Any))
```
**风险**: 允许任意域名跨域访问，配合 Bearer Token 认证，存在 CSRF 和信息泄露风险。任何恶意网站均可通过浏览器发起对 `/api/*` 的请求。
**修复**: 限制为实际部署域名，或提供 `MOTDTRACKER_CORS_ORIGIN` 环境变量配置。

#### C-002: 公开 API 暴露系统规模信息
**位置**: `src/api/status.rs:12`
状态端点暴露了精确的 `group_count`, `server_count`, `node_count`。
**风险**: 攻击者可据此判断系统规模并针对性扫描 `/api/admin` 端点，降低攻击成本。
**修复**: 移除或模糊化这些计数信息，或将其移到需要认证的端点。

---

### 🟠 高风险问题 (High)

#### H-001: 无速率限制
**位置**: 全局缺失
**风险**: `/api/admin/login` 和 `/api/admin/setup` 无任何速率限制，易受暴力破解和撞库攻击。
**修复**: 添加 `tower-governor` 或基于内存的滑动窗口限流器。

#### H-002: WebSocket 无认证
**位置**: `src/ws/mod.rs:118`
```rust
pub async fn handle_socket(socket: WebSocket, broadcaster: Arc<WsBroadcaster>, ...)
```
**风险**: 任何客户端均可连接 `/api/ws` 接收 `poll_complete` 事件，构成信息收集渠道。
**修复**: WebSocket 升级前验证 Token，或至少要求同源。

#### H-003: Admin API 输入验证薄弱
**位置**: `src/api/admin.rs:293-332`
使用 `serde_json::Value` 而非强类型结构体解析请求：
```rust
Json(req): Json<Value>
let name = req["name"].as_str().unwrap_or("").to_string();
```
**风险**: 字段类型错误时产生 `INTERNAL_SERVER_ERROR` 而非明确的 `BAD_REQUEST`，调试困难。
**修复**: 使用 `#[derive(Deserialize)]` 结构体并配合 `validator` crate。

#### H-004: 前端 Token 存储在 localStorage
**位置**: `frontend/src/providers/AuthProvider.tsx:19`
```typescript
const [token, setToken] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY))
```
**风险**: 若存在 XSS 漏洞（如 Badge SVG 渲染、MOTD 展示等），Token 可被窃取。
**修复**: 后端改为 httpOnly cookie 认证，或至少实现严格的 CSP 头。

#### H-005: 数据库查询性能隐患
**位置**: `src/db/sqlite.rs:291`
```rust
"SELECT ... FROM status_logs WHERE id IN (SELECT MAX(id) FROM status_logs GROUP BY node_id)"
```
**风险**: `status_logs` 表随时间线性增长，子查询在大数据量下性能急剧下降，且每次查询都重新计算。
**修复**: 为 `(node_id, timestamp)` 创建复合索引，或维护独立的 `latest_status` 物化视图/缓存表。

---

### 🟡 中风险问题 (Medium)

#### M-001: 错误信息完全吞没
**位置**: 大量出现于 `src/api/admin.rs`, `src/api/servers.rs` 等
```rust
.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
```
**风险**: 服务器端日志也丢失了原始错误原因，导致生产环境故障排查极其困难。
**修复**: 使用 `tracing::error!` 记录原始错误后再映射为通用响应。

#### M-002: 大量代码重复
**位置**: `src/api/servers.rs`, `src/api/admin.rs`
- `list_servers` 和 `get_server` 中计算 aggregate 的逻辑几乎相同
- `move_node_up` 和 `move_node_down` 仅两行差异，却复制了 40+ 行
**修复**: 提取 `compute_server_aggregate()` 和 `swap_sort_order()` 辅助函数。

#### M-003: `log_status_batch` 非真正批量
**位置**: `src/db/sqlite.rs:271`
```rust
async fn log_status_batch(&self, entries: &[StatusLogEntry]) -> Result<(), DbError> {
    for e in entries { self.log_status(e).await?; }  // 逐条插入！
}
```
**风险**: N 次网络往返，性能差。在高节点数场景下显著影响轮询效率。
**修复**: 使用 `sqlx::QueryBuilder` 构建单条 `INSERT INTO ... VALUES (...), (...)` 语句。

#### M-004: `active_config_hash` 使用 Relaxed 内存序
**位置**: `src/core/poller.rs:184`
```rust
active_config_hash: AtomicU64::new(0)
// 读写均使用 Ordering::Relaxed
```
**风险**: 在极端并发下可能读取到不完整的 hash 值，导致配置同步状态判断错误。
**修复**: 至少使用 `Acquire/Release` 语义。

#### M-005: 前端 Mock 数据污染生产
**位置**: `frontend/src/pages/DashboardPage.tsx:11`
```typescript
function generateMockData(base: number, points: number = 12): number[] {
    // 每次调用 Math.random()，导致 React 重渲染时 sparkline 抖动
}
```
**风险**: Dashboard 的 sparkline 在每次数据刷新时随机变化，展示非真实趋势，误导用户。
**修复**: 使用真实的历史数据或固定 seed。

#### M-006: WebSocket 重连无最大尝试限制
**位置**: `frontend/src/providers/WebSocketProvider.tsx:27`
```typescript
reconnectTimer.current = setTimeout(connect, 3000)
```
**风险**: 后端宕机时前端无限重连，造成客户端资源浪费和无效网络流量。
**修复**: 添加指数退避和最大重试次数。

---

### 🟢 低风险 / 建议 (Low)

#### L-001: TypeScript `any` 类型不安全
**位置**: 前端多处 `catch (e: any)`
**建议**: TypeScript 严格模式下应避免 `any`，建议使用 `unknown` + 类型守卫。

#### L-002: 浏览器原生 `confirm()` 阻塞主线程
**位置**: `frontend/src/pages/AdminPage.tsx:380`
**建议**: 使用浏览器原生 `confirm()` 不符合现代 SPA 体验，建议替换为 Dialog 组件。

#### L-003: Cargo.toml 可选依赖未使用
**位置**: `Cargo.toml:69-73`
`async-graphql` 和 `prometheus` 作为可选 feature，但代码中未见使用痕迹。
**建议**: 移除未使用的可选依赖，减少编译时间。

#### L-004: 构建脚本强依赖 npm
**位置**: `build.rs:76`
**建议**: 在非前端开发环境（如纯 Rust CI）无法构建。建议提供 `skip-frontend-build` feature。

#### L-005: TUI 代码待完整移除
**位置**: `src/tui/wizard.rs` (973 行)
**建议**: README 已声明 TUI 已移除，但代码仍保留。需彻底清理相关文件和依赖。

---

## 3. 正面评价

| 项目 | 位置 | 评价 |
|------|------|------|
| Argon2 密码哈希 | `src/auth/password.rs` | 使用 `Argon2::default()`，符合 OWASP 推荐 |
| 登录时序攻击防护 | `src/api/admin.rs:126` | dummy hash 机制防止用户名枚举 |
| 参数化 SQL | `src/db/sqlite.rs` 全局 | 彻底避免 SQL 注入 |
| 优雅关闭 | `src/main.rs:136` | Ctrl+C → shutdown_tx → 轮询器 → DB checkpoint，完整链路 |
| Docker 非 root 运行 | `Dockerfile:50` | `adduser -u 10001`，安全最佳实践 |
| 前端代码分割 | `frontend/src/App.tsx` | `React.lazy()` 按需加载页面，首屏性能良好 |
| 类型对齐 | `frontend/src/api/types.ts` | 与 Rust 模型基本 1:1 对应，维护成本低 |
| WebSocket 广播 | `src/ws/mod.rs` | 使用 tokio broadcast channel，设计合理 |
| 轮询器配置热重载 | `src/core/poller.rs` | 通过 config hash 检测变化并重建轮询器，设计巧妙 |

---

## 4. 前后端关键映射关系

| 后端模块 | 前端对应 | 状态 |
|----------|----------|------|
| `src/api/admin.rs` | `frontend/src/pages/AdminPage.tsx` | ✅ 对齐 |
| `src/api/servers.rs` | `frontend/src/pages/ServersPage.tsx` | ✅ 对齐 |
| `src/api/node.rs` | `frontend/src/pages/NodesPage.tsx` | ✅ 对齐 |
| `src/api/player.rs` | `frontend/src/pages/PlayersPage.tsx` | ✅ 对齐 |
| `src/api/badge.rs` | `frontend/src/pages/BadgesPage.tsx` | ✅ 对齐 |
| `src/ws/mod.rs` | `frontend/src/providers/WebSocketProvider.tsx` | ⚠️ 仅单向通知，无认证 |
| `src/db/database_trait.rs` | `frontend/src/api/types.ts` | ✅ 类型基本匹配 |

---

## 5. 行动建议

### P0 - 立即修复 (安全相关)
1. **限制 CORS** 为白名单域名或环境变量配置
2. **添加速率限制** 到 `/api/admin/login` 和 `/api/admin/setup`
3. **移除 TUI 模块** 及相关依赖

### P1 - 本周内 (功能与质量)
4. Admin API 改用强类型结构体 + 输入验证
5. `log_status_batch` 改为真正的批量插入
6. 修复 Dashboard sparkline mock 数据问题
7. WebSocket 添加认证校验

### P2 - 下次迭代 (工程化)
8. 统一错误日志记录（`tracing::error!` + 通用响应）
9. 提取重复代码（aggregate 计算、sort_order 交换）
10. 数据库查询优化（latest_status 索引/缓存表）
11. 前端 Token 存储改为 httpOnly Cookie 或实现 CSP

### P3 - 长期规划
12. 分页查询历史数据（防止大数据量查询超时）
13. 添加 OpenAPI / Swagger 文档
14. 分离 `build.rs` 前端构建为可选 feature
15. 添加自动化安全测试（如 cargo-audit, npm audit）

---

*报告生成时间: 2026-06-05*  
*审计工具: 人工代码审查 + 静态分析*
