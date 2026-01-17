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
   - 环境信息（Python 版本、操作系统等）

### 提交代码

1. **Fork 仓库** 并克隆到本地
2. **创建分支**：`git checkout -b feature/your-feature-name`
3. **安装依赖**：
   ```bash
   uv sync
   ```
4. **进行修改**，确保：
   - 代码风格一致
   - 添加必要的注释
   - 更新相关文档
5. **测试修改**：
   ```bash
   uv run main.py
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
fix: 修复 PostgreSQL 连接超时问题
docs: 更新 API 文档中的示例
```

## 开发指南

### 项目架构

```
MotdTracker/
├── core/          # 核心逻辑（轮询器、监控器）
├── db/            # 数据库抽象层（必须同时实现 SQLite 和 PostgreSQL）
├── routes/        # API 和页面路由
├── utils/         # 工具函数
├── static/        # 静态资源（CSS 模块化）
└── templates/     # Jinja2 模板
```

### 关键约定

1. **时区处理**：使用 `app_utils.utc8_now()` 而非 `datetime.now()`
2. **数据库方法**：新增方法必须同时在 `DatabaseBase`、`Database`（SQLite）、`PostgreSQLDatabase` 中实现
3. **CSS 模块化**：新样式放入对应模块文件，不直接修改 `style.css`

### 代码风格

- 使用 Python 3.13+ 类型提示
- 函数和类添加 docstring
- 保持代码简洁，单个函数不超过 50 行

## 问题反馈

如有任何问题，欢迎：
- 在 [Discussions](https://github.com/PoiCraft/MotdTracker/discussions) 提问
- 创建 Issue 描述问题

再次感谢你的贡献！🎉
