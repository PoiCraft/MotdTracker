# 04 — 前端派生逻辑纯模块 + vitest

**What to build:** 一个无 React 依赖的纯模块收编全部 StatusLog/会话派生逻辑：历史分桶、多节点延迟序列（含调色板）、逐小时热力、会话统计、在线玩家提取。四个页面删除内联实现，图表行为在各页面一致；引入 vitest 运行纯函数单测。

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] 纯模块收编全部五类派生逻辑，页面只保留取数与 JSX
- [ ] vitest 作为 devDependency 引入，含运行脚本
- [ ] 单测覆盖：分桶对齐、UTC+8 边界、离线断线（null）、玩家提取的 JSON 容错
- [ ] 四个页面渲染结果与迁移前一致（人工冒烟）
