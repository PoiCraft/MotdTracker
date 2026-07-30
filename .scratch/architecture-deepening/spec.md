# Spec: 架构深化 —— DashboardSnapshot 与深模块改造

**Status:** ready-for-agent

## Problem Statement

MotdTracker 的监控数据（节点最新状态、24 小时统计、组→服务器→节点层级）在六个 API handler 模块中被各自重复聚合：同样的「取 latest status → 建查找映射 → 算 online_count/玩家数/延迟」逻辑在 servers、node、groups、badge、exporter 中各有一份，badge 还内联重算 uptime。node 列表接口存在 N+1 查询（逐节点查历史）。这导致：

- 聚合逻辑的 bug 要在多处分别修，已经实际漂移（exporter 用 `calculate_latency_stats`，badge 内联重算）
- 无法在没有数据库的情况下测试任何一层
- Database trait 55 个方法一一对应 SQL，调用方必须自己知道多查询组合模式；写 mock 等于重实现整个数据库
- 时区修正（+8h）依赖 8 个查询方法各自记得手动调用，类型系统无法兜底
- 前端四个页面各嵌一份 UTC+8 分桶逻辑（三个变体），无测试；组→服务器→节点层级在五处重建，`__ungrouped` 哨兵泄漏进渲染代码；阈值常量复制在五处；`?group_id` 过滤仅一个页面生效

## Solution

引入**仪表盘快照（Dashboard Snapshot）**作为唯一的聚合模块：一次加载返回完全 join、预聚合的组→服务器→节点嵌套树（含最新状态，可选逐节点 24h 统计）。所有 API handler 退化为快照之上的格式适配器（JSON / SVG / Prometheus），前端直接消费嵌套树，删除全部分组代码。

配套深化：badge 拆分渲染与数据；Database trait 拆分为聚焦子 trait 并收编便利默认方法；时区修正移入解码层（Gmt8Naive）；前端派生逻辑收进无 React 依赖的纯模块；阈值常量与组过滤统一收编。

## User Stories

1. 作为监控站访问者，我希望服务器/节点列表接口在数据库故障时返回明确错误，而不是伪装成"全部离线"的空数据，以便我能区分"服务宕了"和"没有服务器在线"
2. 作为监控站访问者，我希望节点列表加载不随节点数线性变慢（消除 N+1 查询），以便大部署下页面依然秒开
3. 作为 Prometheus 用户，我希望 exporter 指标与 Web 界面数据来自同一份聚合结果，以便两边数字永远一致
4. 作为 badge 使用者，我希望 badge 上的 uptime 与 Web 界面显示的 uptime 一致，以便对外展示的数据可信
5. 作为维护者，我希望聚合逻辑只存在于一个模块，以便修一次 bug 处处生效
6. 作为维护者，我希望无需数据库即可测试聚合与格式化逻辑，以便测试快速且覆盖核心规则
7. 作为维护者，我希望新增一个返回时间的查询方法时不需要记得手动调用时区修正，以便不再引入无声的 +8h bug
8. 作为维护者，我希望 mock 数据库协作者只需实现 3-5 个方法，以便为 handler 写聚焦的单元测试
9. 作为维护者，我希望修改 poll_interval 默认值只改一处，而不是 grep 替换 8 处调用链
10. 作为前端用户，我希望仪表盘、服务器详情、节点详情、玩家详情的图表分桶行为一致，以便同一数据在不同页面呈现相同
11. 作为前端用户，我希望 Nodes 和 Players 页面也能按组过滤，以便在大部署下只看关心的组
12. 作为前端维护者，我希望分桶/时区边界逻辑有单元测试，以便改图表不再靠肉眼回归
13. 作为前端维护者，我希望修改高延迟阈值只改一处，以便五个组件不会显示不一致的阈值

## Implementation Decisions

1. **DashboardSnapshot 模块**：独立模块，置于 Database trait 之上（不改动 trait 本身来容纳它）。单入口：`load(db, group_id: Option, history_hours: Option<u32>) -> Result<DashboardSnapshot, DbError>`。
2. **快照内容**：组→服务器→节点嵌套树；每节点附最新状态；`history_hours` 为 `Some` 时，内部调一次全量历史查询，逐节点算出延迟统计（uptime、平均延迟）附在节点上——同时消除 node 列表接口的逐节点历史循环（N+1）。
3. **错误语义**：快照加载失败返回 `Result`；handler 统一映射为 500（沿用现有 `internal_error` 辅助函数）。不再静默降级为空数据。这是对现有行为的显式变更。
4. **格式适配器**：servers/node/groups 的 handler 把快照序列化为 JSON；exporter 塌缩为「快照 → Prometheus 文本」的纯函数；全部 handler 不再直接聚合。
5. **实体树在服务端成型**：快照直接序列化为嵌套树 JSON；前端五处分组代码（含 `__ungrouped` 哨兵）整体删除，不是收拢。API 响应格式随之改变，前端消费方同步迁移。
6. **badge 模块**：保留定向单实体查询（badge 是公开高频端点，不加载全盘快照）；uptime/延迟统计统一调用共享统计模块，删除内联重算；SVG 渲染与 CJK 字宽表拆为独立纯模块，路由 handler 变薄。
7. **Database trait 拆分**：按领域拆为聚焦子 trait（状态、服务器、玩家、管理员、配置），`Database` 成为组合超 trait；`poll_interval_secs()`（及类似的配置便利方法）作为带默认实现的方法收编 8 处「get_app_config → ok → flatten → parse → unwrap_or」调用链。
8. **Gmt8Naive**：新类型实现 sqlx 的 Decode/Type，解码时应用 +8h 修正；返回时间的模型字段切换为该类型；删除 8 处手动修正调用。不改存储格式、不做数据迁移。
9. **前端派生逻辑模块**：无 React 依赖的纯模块，收编全部 StatusLog/会话派生逻辑——历史分桶、多节点延迟序列（含调色板）、逐小时热力、会话统计、在线玩家提取（sample_players JSON 解析）。页面只保留取数与 JSX。
10. **前端收编**：阈值常量（高延迟等）收进单一常量模块；统一组过滤 hook 读取 `?group_id`；Nodes/Players 页面改为向服务端传参过滤（实现时先验证对应路由支持该参数，不支持则补后端）。
11. **前端测试设施**：引入 vitest 作为 devDependency，仅为纯模块单测服务，不影响构建链路。

## Testing Decisions

好测试的标准：只测外部可观察行为（经模块公开接口），不测实现细节；每个模块一个测试面。

- **DashboardSnapshot**：经 `load` 接口测试，使用内存 SQLite（沿用现有 `tests/` 集成测试的建库模式）。覆盖：树形结构正确性、组过滤、逐节点统计存在性、错误传播。
- **格式适配器**：纯函数单测——构造快照对象，断言 JSON/Prometheus 文本输出，不碰数据库。
- **Gmt8Naive**：内存 SQLite 往返测试——写入墙钟时间字符串，读出断言修正已应用。
- **子 trait 拆分**：行为不变重构，现有集成测试原样通过即为验证；编译器保证调用方迁移完整。
- **前端派生逻辑模块**：vitest 单测——分桶对齐、UTC+8 边界、离线断线（null）、玩家提取的 JSON 容错。
- **badge 渲染**：现有渲染测试随模块搬迁原样保留。

先行测试模式参考：后端 `tests/integration_db_tests.rs`（内存 SQLite 模式）、`tests/admin_auth_middleware_tests.rs`（middleware 级集成测试）。

## Out of Scope

- 存储格式变更（时间戳改 epoch / ISO8601）及数据迁移——已评估并拒绝，解码层修正足够
- WebSocket 协议变更（poll_complete 消息不变）
- 轮询器（poller）内部结构改造——仅通过 `poll_interval_secs()` 默认方法受益
- 告警（alert/webhook）模块
- 前端组件视觉/交互重设计
- 管理后台 CRUD 表单抽象（评审中识别但未纳入本轮）

## Further Notes

- 本 spec 源自 2026-07-30 架构评审（报告为临时 HTML，未入库），评审过程经 10 轮 grilling 决策，上述每个决策均有对应问答记录。
- 领域术语见根目录 `CONTEXT.md`；「仪表盘快照（Dashboard Snapshot）」为本次确立的新概念，已收录。
- 实施顺序约束：Gmt8Naive 与快照可先行；badge 与实体树依附快照；Database trait 拆分最后做（避免与快照开发的中间态冲突）；前端两项可与后端并行。
