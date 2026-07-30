# 06 — servers/groups handler 迁移 + 嵌套树 JSON

**What to build:** servers 和 groups 的列表/详情接口改走仪表盘快照，响应改为组→服务器→节点嵌套树 JSON——领域层级在服务端成型，前端不再需要自行分组。compute_aggregate 及其重复变体删除。

**Blocked by:** 02 — DashboardSnapshot 核心 + node 列表迁移

**Status:** done

- [x] servers/groups 列表与详情接口从快照取数，嵌套树序列化
- [x] compute_aggregate 及各 handler 内联聚合删除
- [x] 响应中的聚合字段（在线数、玩家数、延迟）与迁移前数值一致
- [x] 加载失败返回 500
- [x] 格式适配器有纯函数测试：构造快照 → 断言 JSON 结构
