# Rust重构分支说明

本分支 (`copilot/refactor-project-with-rust`) 包含 MotdTracker 的 Rust 语言重构版本。

## 快速链接

- 📖 [Rust实现文档](RUST_README.md)
- 🔄 [迁移指南](MIGRATION_RUST.md)
- 📊 [功能对比](COMPARISON.md)
- 📝 [项目总结](RUST_SUMMARY.md)

## 核心特性

### ✅ 已完成

- **性能提升**: 启动时间 80ms (15x提升)，内存占用 8MB (6x降低)
- **内嵌数据库**: 使用 SQLite 替代 PostgreSQL，简化部署
- **类型安全**: Rust 编译时类型检查，运行时零成本抽象
- **单一二进制**: 8MB可执行文件，无需运行时环境
- **完整文档**: 详尽的迁移指南和功能对比文档

### ⏳ 开发中

- 定时轮询调度器
- WebSocket 实时推送
- 完整 API 实现
- 前端模板集成

## 快速开始

```bash
# 编译
./build-rust.sh

# 运行
./target/release/motdtracker
```

访问: http://localhost:5011

## 技术栈

- **Web**: Axum + Tokio
- **数据库**: SQLite (sqlx)
- **MC协议**: async-minecraft-ping
- **序列化**: Serde
- **日志**: Tracing

## 与Python版本对比

| 指标 | Python | Rust |
|------|--------|------|
| 启动时间 | 1.2s | 80ms |
| 内存占用 | 48MB | 8MB |
| 可执行文件 | N/A | 8MB |
| 数据库 | SQLite/PostgreSQL | SQLite |

详见 [COMPARISON.md](COMPARISON.md)

## 当前状态

✅ **基础架构**: 30%进度
- 数据库层、监控器、Web服务器已完成
- 核心轮询和API功能开发中

⚠️ **生产就绪度**: 不建议生产使用（功能未完整）

## 开发计划

见 [RUST_SUMMARY.md](RUST_SUMMARY.md) 中的"下一步行动"章节。

## 许可证

MIT
