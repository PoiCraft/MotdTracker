# 07 — exporter 塌缩为快照格式适配器

**What to build:** Prometheus exporter 不再自行聚合：从仪表盘快照取数，指标文本生成为纯函数。exporter 指标与 Web 界面数据同源，永远一致。现有 30 秒缓存语义保留。

**Blocked by:** 02 — DashboardSnapshot 核心 + node 列表迁移

**Status:** done

- [x] compute_metrics 的独立聚合（约 130 行）删除，改从快照取数
- [x] 快照 → Prometheus 文本为纯函数，有构造数据的单元测试
- [x] 指标名称、标签、缓存行为与迁移前一致
- [x] 加载失败时端点返回 500
