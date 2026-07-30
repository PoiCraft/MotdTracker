# 09 — Database trait 拆分子 trait + 默认方法收编

**What to build:** 55 方法的 Database trait 按领域拆为聚焦子 trait（状态、服务器、玩家、管理员、配置），Database 成为组合超 trait；poll_interval_secs() 等配置便利方法以默认实现收编，8 处「get_app_config → ok → flatten → parse → unwrap_or」调用链删除。mock 单个协作者只需实现 3-5 个方法。

**Blocked by:** 03 — badge 模块拆分与统计统一; 06 — servers/groups handler 迁移 + 嵌套树 JSON; 07 — exporter 塌缩为快照格式适配器

**Status:** done

- [x] 五个聚焦子 trait 定义，Database 组合超 trait 保持现有调用方可编译
- [x] SqliteDatabase 实现按域重组，行为不变（现有集成测试原样通过）
- [x] poll_interval_secs() 默认方法收编 8 处调用链
- [x] 全部调用方迁移完成，无残留的旧式配置读取链
