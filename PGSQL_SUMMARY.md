# PostgreSQL 支持实现总结

## 已完成的工作

### 1. 依赖管理
- ✅ 在 `pyproject.toml` 中添加 `psycopg2-binary>=2.9.0` 依赖

### 2. 数据库抽象层
- ✅ 创建 `database_base.py` - 数据库操作抽象基类
- ✅ 修改 `database.py` - SQLite 实现继承自基类
- ✅ 创建 `database_pgsql.py` - PostgreSQL 完整实现

### 3. 数据库工厂
- ✅ 创建 `database_factory.py` - 智能数据库选择和迁移
  - 检测配置自动选择数据库类型
  - PostgreSQL 连接失败自动回退到 SQLite
  - 首次启动自动迁移 SQLite 数据到 PostgreSQL

### 4. 应用集成
- ✅ 修改 `poller.py` - 使用数据库工厂创建实例
- ✅ 创建 `config.example.json` - 配置示例

### 5. 迁移工具
- ✅ 创建 `migrate.py` - 手动迁移脚本
  - 交互式确认
  - 批量数据迁移
  - 详细日志输出

### 6. 文档
- ✅ 创建 `POSTGRESQL.md` - 详细的 PostgreSQL 配置指南
- ✅ 更新 `README.md` - 添加 PostgreSQL 支持说明

## 功能特性

### 自动回退机制
```
配置了 PostgreSQL → 尝试连接 → 成功 → 使用 PostgreSQL
                              ↓ 失败
                              → 回退到 SQLite
```

### 平滑迁移流程
```
启动应用 → 检测 PostgreSQL 配置 → 连接成功
              ↓
         检查 SQLite 文件存在
              ↓
         检查 .migrated 备份文件
              ↓
         已存在 → 跳过迁移（避免重复）
         不存在 → 自动迁移数据:
                  - servers (服务器信息)
                  - status_logs (状态日志)
                  - player_sessions (玩家会话)
                  - player_session_history (会话历史)
              ↓
         备份 SQLite 文件 (.migrated)
              ↓
         后续启动检测到备份文件，自动跳过
```

## 使用方法

### 1. 安装依赖
```bash
uv sync
```

### 2. 配置 PostgreSQL (可选)
在 `config.json` 中添加：
```json
{
  "postgresql": {
    "host": "localhost",
    "port": 5432,
    "database": "motdtracker",
    "user": "postgres",
    "password": "your_password"
  }
}
```

### 3. 启动应用
```bash
uv run main.py
```

首次启动会自动：
- 创建 PostgreSQL 表结构
- 迁移现有 SQLite 数据（如果存在）
- 备份 SQLite 文件

### 4. 手动迁移（可选）
```bash
uv run migrate.py
```

## 技术细节

### 数据库差异处理
| 特性 | SQLite | PostgreSQL |
|------|--------|------------|
| 占位符 | `?` | `%s` |
| 布尔值 | INTEGER (0/1) | BOOLEAN |
| 自增主键 | AUTOINCREMENT | SERIAL |
| 冲突处理 | INSERT OR REPLACE | ON CONFLICT ... DO UPDATE |

### PostgreSQL 优势
1. **并发性能**: 无数据库锁定问题
2. **网络访问**: 支持远程连接
3. **数据规模**: 适合大数据量
4. **事务隔离**: 更强的 ACID 保证
5. **在线备份**: 不需要停机

### SQLite 优势
1. **零配置**: 无需额外服务
2. **单文件**: 便于备份和迁移
3. **轻量级**: 资源占用少
4. **嵌入式**: 适合小型部署

## 文件列表

### 新增文件
- `database_base.py` - 抽象基类
- `database_pgsql.py` - PostgreSQL 实现
- `database_factory.py` - 工厂和迁移
- `migrate.py` - 手动迁移脚本
- `config.example.json` - 配置示例
- `POSTGRESQL.md` - 使用文档
- `PGSQL_SUMMARY.md` - 本文件

### 修改文件
- `pyproject.toml` - 添加 psycopg2-binary 依赖
- `database.py` - 继承基类
- `poller.py` - 使用工厂创建数据库
- `README.md` - 添加 PostgreSQL 说明

## 兼容性

- ✅ 向后兼容：现有 SQLite 配置无需修改
- ✅ 平滑升级：添加 PostgreSQL 配置后自动迁移
- ✅ 灵活切换：可随时移除 PostgreSQL 配置回退到 SQLite
- ✅ 零停机：迁移过程不影响现有数据

## 测试建议

1. **SQLite 模式测试**（默认）
   ```bash
   # 不配置 postgresql，应使用 SQLite
   uv run main.py
   ```

2. **PostgreSQL 新部署测试**
   ```bash
   # 配置 postgresql，无 SQLite 数据
   uv run main.py
   ```

3. **数据迁移测试**
   ```bash
   # 先运行 SQLite 模式积累数据
   # 然后添加 postgresql 配置
   # 重启应用，验证数据已迁移
   uv run main.py
   ```

4. **手动迁移测试**
   ```bash
   uv run migrate.py
   ```

5. **回退测试**
   ```bash
   # 移除 postgresql 配置
   # 重启应用，应回到 SQLite
   uv run main.py
   ```

## 下一步

- [ ] 安装依赖: `uv sync`
- [ ] 测试 SQLite 模式（默认）
- [ ] 配置 PostgreSQL（可选）
- [ ] 测试数据迁移
- [ ] 生产环境部署
