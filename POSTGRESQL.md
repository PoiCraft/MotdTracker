# PostgreSQL 数据库支持

MotdTracker 现在支持使用 PostgreSQL 作为数据库后端，提供更好的并发性能和可扩展性。

## 功能特性

- ✅ **双数据库支持**: 同时支持 SQLite 和 PostgreSQL
- ✅ **自动回退**: 如果 PostgreSQL 配置失败，自动回退到 SQLite
- ✅ **平滑迁移**: 首次配置 PostgreSQL 时，自动从 SQLite 迁移数据
- ✅ **零配置 SQLite**: 未配置 PostgreSQL 时默认使用 SQLite

## 配置方法

### 1. 安装依赖

PostgreSQL 支持需要额外的 Python 包：

```bash
uv sync
```

依赖会自动安装（已包含在 `pyproject.toml` 中）。

### 2. 配置 PostgreSQL

在 `config.json` 中添加 `postgresql` 配置节：

```json
{
  "server_name": "PoiCraft",
  "nodes": [...],
  "database": "minecraft_stats.db",
  "poll_interval": 15,
  "postgresql": {
    "host": "localhost",
    "port": 5432,
    "database": "motdtracker",
    "user": "postgres",
    "password": "your_password"
  }
}
```

### 3. 创建 PostgreSQL 数据库

在使用前需要先创建数据库：

```sql
CREATE DATABASE motdtracker;
```

或使用命令行：

```bash
psql -U postgres -c "CREATE DATABASE motdtracker;"
```

### 4. 启动应用

```bash
uv run main.py
```

应用会：

1. 检测到 PostgreSQL 配置
2. 连接 PostgreSQL 数据库
3. 自动创建表结构
4. 如果存在 SQLite 数据库且未迁移过，自动迁移所有数据
5. 备份原 SQLite 文件为 `minecraft_stats.db.migrated`
6. 后续启动检测到 `.migrated` 文件存在，自动跳过迁移

## 配置参数说明

| 参数 | 必填 | 说明 |
|------|------|------|
| `host` | 是 | PostgreSQL 服务器地址 |
| `port` | 是 | PostgreSQL 端口（默认 5432） |
| `database` | 是 | 数据库名称 |
| `user` | 是 | 数据库用户名 |
| `password` | 是 | 数据库密码 |

## 数据迁移

### 自动迁移

首次启动配置了 PostgreSQL 的应用时，系统会自动：

1. 检测 SQLite 数据库文件
2. 检查是否已迁移过（`.migrated` 文件是否存在）
3. 如果未迁移，执行数据迁移：
   - ✅ 服务器信息 (`servers`)
   - ✅ 状态日志 (`status_logs`)
   - ✅ 玩家会话 (`player_sessions`)
   - ✅ 会话历史 (`player_session_history`)
4. 备份 SQLite 文件为 `.migrated`
5. 后续启动自动跳过迁移（检测到 `.migrated` 文件）

### 手动迁移

如果需要重新迁移，可以：

1. 删除 `.migrated` 后缀的备份文件
2. 重启应用（会重新触发自动迁移）

或使用迁移脚本：

```bash
# 删除备份文件后运行
uv run migrate.py
```

## 回退到 SQLite

如果想回退到 SQLite：

1. 从 `config.json` 中删除 `postgresql` 配置节
2. 重启应用

系统会自动使用 SQLite 数据库。

## 性能优势

使用 PostgreSQL 相比 SQLite 的优势：

| 特性 | SQLite | PostgreSQL |
|------|--------|------------|
| 并发写入 | ⚠️ 有限制 | ✅ 完全支持 |
| 多连接 | ⚠️ 锁竞争 | ✅ 无锁定 |
| 数据量 | ✅ 适合小型 | ✅ 适合大型 |
| 网络访问 | ❌ 不支持 | ✅ 支持 |
| 备份恢复 | ⚠️ 需停机 | ✅ 在线备份 |

## 故障排除

### 连接失败

如果看到以下日志：

```
PostgreSQL 连接失败: connection refused, 回退到 SQLite
```

检查：
1. PostgreSQL 服务是否运行
2. 端口配置是否正确
3. 防火墙是否允许连接
4. 用户名密码是否正确

### 迁移失败

如果迁移过程出错：

```
数据迁移失败（如果是首次启动可以忽略）: ...
```

- 首次启动时这是正常的（没有 SQLite 数据可迁移）
- 如果确实有数据需要迁移，检查日志获取详细错误信息

### 模块导入错误

如果看到：

```
无法导入 PostgreSQL 模块: No module named 'psycopg2'
```

运行：

```bash
uv sync
```

## Docker 部署

使用 Docker Compose 部署时的配置示例：

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: motdtracker
      POSTGRES_USER: motdtracker
      POSTGRES_PASSWORD: secure_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  motdtracker:
    build: .
    depends_on:
      - postgres
    environment:
      - DATABASE_TYPE=postgresql
    volumes:
      - ./config.json:/app/config.json

volumes:
  postgres_data:
```

对应的 `config.json`：

```json
{
  "postgresql": {
    "host": "postgres",
    "port": 5432,
    "database": "motdtracker",
    "user": "motdtracker",
    "password": "secure_password"
  }
}
```
