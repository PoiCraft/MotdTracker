# 02 — DashboardSnapshot 核心 + node 列表迁移（tracer bullet）

**What to build:** 新的仪表盘快照模块贯穿「DB → 聚合 → JSON」全链路：一次加载返回 join 好的组/服务器/节点数据与最新状态，可选附带逐节点 24h 统计。node 列表接口第一个迁移：不再逐节点查历史（N+1 消除），数据库故障返回 500 而非静默空数据。

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] 快照模块提供单入口 load(db, group_id, history_hours)，返回 Result
- [ ] 可选历史层级：一次全量历史查询 + 逐节点统计，替代逐节点循环查询
- [ ] node 列表接口改走快照，行为等价（过滤、统计字段一致）
- [ ] 加载失败时接口返回 500，不再静默空数据
- [ ] 快照经内存 SQLite 集成测试：树形结构、组过滤、逐节点统计、错误传播
