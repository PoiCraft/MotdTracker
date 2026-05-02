# 贡献指南

感谢你对 MotdTracker 的关注！我们欢迎各种形式的贡献。

## 如何贡献

### 报告问题

如果你发现了 bug 或有功能建议，请：

1. 先搜索 [已有 Issues](https://github.com/PoiCraft/MotdTracker/issues)，避免重复
2. 创建新 Issue，使用合适的模板
3. 提供详细信息：
   - 问题描述
   - 复现步骤
   - 期望行为 vs 实际行为
   - 环境信息（Rust 版本、Node.js 版本、操作系统等）

### 提交代码

1. **Fork 仓库** 并克隆到本地
2. **创建分支**：`git checkout -b feature/your-feature-name`
3. **安装依赖**：
   ```bash
   cargo build              # Rust 后端
   cd frontend && npm install   # React 前端
   ```
4. **进行修改**，确保：
   - 代码风格一致
   - 添加必要的注释
   - 更新相关文档
5. **测试修改**：
   ```bash
   cargo test
   cd frontend && npm run build
   ```
6. **提交更改**：
   ```bash
   git commit -m "feat: 简短描述你的修改"
   ```
7. **推送分支**：`git push origin feature/your-feature-name`
8. **创建 Pull Request**

## 提交规范

我们使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

| 类型 | 描述 |
|------|------|
| `feat` | 新功能 |
| `fix` | 修复 bug |
| `docs` | 文档更新 |
| `style` | 代码格式（不影响功能） |
| `refactor` | 代码重构 |
| `perf` | 性能优化 |
| `test` | 测试相关 |
| `chore` | 构建/工具变更 |

示例：
```
feat: 添加玩家在线时长统计图表
fix: 修复 WebSocket 断线重连问题
docs: 更新 API 文档中的示例
```

## 开发指南

### 项目架构

Rust 后端源码在 `src/`，React 前端在 `frontend/`。

### 关键约定

1. **时区处理**：使用 `src/utils/time.rs` 中的工具函数
2. **数据库方法**：新增方法必须在 `Database` trait 声明并在 SQLite 实现中同步添加
3. **API 兼容**：修改 API 响应格式时同步更新前端消费代码

### 代码风格

- **Rust**: 遵循 `rustfmt` 和 `clippy` 规范
- **JavaScript/React**: 使用 ESLint 默认配置

## 问题反馈

如有任何问题，欢迎：
- 在 [Discussions](https://github.com/PoiCraft/MotdTracker/discussions) 提问
- 创建 Issue 描述问题

再次感谢你的贡献！
