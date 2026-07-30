# 03 — badge 模块拆分与统计统一

**What to build:** badge 的 SVG 渲染（含 CJK 字宽表）拆为独立纯模块；所有 badge 的 uptime/延迟统计统一调用共享统计函数，删除内联重算；路由 handler 变薄为「定向查询 → 取字段 → 渲染」。badge 上的数字与 Web 界面同源。

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] SVG 渲染与字宽表拆为独立模块，现有渲染测试随迁原样通过
- [ ] 所有 uptime/延迟统计统一走共享统计函数，内联重算删除
- [ ] badge 保持定向单实体查询（不加载全盘快照）
- [ ] 每个 badge 端点行为与迁移前一致
