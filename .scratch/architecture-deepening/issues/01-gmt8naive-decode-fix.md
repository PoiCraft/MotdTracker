# 01 — Gmt8Naive：时区修正移入解码层

**What to build:** 从 SQLite 读出的时间字段在解码时自动应用 +8h 修正，查询方法不再需要手动调用修正函数。新增返回时间的查询方法天然正确，不存在漏调风险。

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] 新类型实现 sqlx 的 Decode/Type，解码时应用 +8h 修正
- [ ] 所有返回时间的模型字段切换为该类型，8 处手动修正调用全部删除
- [ ] 内存 SQLite 往返测试：写入墙钟字符串，读出断言修正已应用
- [ ] 现有集成测试原样通过
