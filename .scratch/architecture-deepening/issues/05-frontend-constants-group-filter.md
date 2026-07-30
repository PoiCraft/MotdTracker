# 05 — 前端阈值常量与组过滤统一

**What to build:** 高延迟等阈值常量收进单一模块（五处复制删除）；统一的组过滤 hook 读取 `?group_id`；Nodes 和 Players 页面与 Servers 页面行为一致，按组过滤时向服务端传参（若对应路由不支持该参数则补后端）。

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] 阈值常量单一来源，五处复制删除
- [ ] 统一组过滤 hook，所有列表页消费
- [ ] Nodes/Players 页面支持 `?group_id` 服务端过滤（先验证路由支持，不支持则补后端）
- [ ] 切换组时三个页面过滤行为一致
