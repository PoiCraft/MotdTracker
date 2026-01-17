# MotdTracker

<div align="center">

**Minecraft 多节点服务器监控面板**

基于 Flask + Flask-SocketIO + Flask-RESTX 的轻量级实时监控系统

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Python 3.13+](https://img.shields.io/badge/Python-3.13+-blue.svg)](https://www.python.org/)

</div>

---

## 简介

MotdTracker 是一个专为 Minecraft 服务器设计的实时监控系统，支持多节点聚合监控、玩家追踪、延迟统计分析与 Prometheus 集成。

- 🚀 **实时监控** - WebSocket 推送，毫秒级延迟数据更新
- 📊 **数据可视化** - Chart.js 趋势图 + 24h 热力图
- 👥 **玩家追踪** - 会话管理、在线时长统计
- 📈 **延迟分析** - 24h 统计指标（平均/标准差/P95/CV）
- 🔌 **Prometheus 集成** - 完整节点级指标导出
- 💾 **灵活存储** - 双数据库支持（SQLite / PostgreSQL）

---

## 快速开始

### 1. 安装依赖

```bash
# 推荐使用 uv
uv sync

# 或使用 pip
pip install -e .
```

### 2. 配置

复制示例配置并修改：

```bash
cp config.example.toml config.toml
```

编辑 `config.toml`：

```toml
server_name = "我的服务器"
database = "minecraft_stats.db"
poll_interval = 15
port = 5011

[[nodes]]
id = 1
name = "主线入口"
host = "play.example.com"
port = 25565
color = "#10b981"
enable = true

[[nodes]]
id = 2
name = "备用线路"
host = "backup.example.com"
port = 25565
color = "#f59e0b"
enable = true
```

### 3. 启动

```bash
uv run main.py
```

访问 <http://127.0.0.1:5011> 查看监控面板。

---

## PostgreSQL 配置（可选）

MotdTracker 默认使用 SQLite，如需更好的并发性能，可配置 PostgreSQL。

### 1. 创建数据库

```bash
psql -U postgres -c "CREATE DATABASE motdtracker;"
```

### 2. 添加配置

在 `config.toml` 中添加：

```toml
[postgresql]
host = "localhost"
port = 5432
database = "motdtracker"
user = "postgres"
password = "your_password"
```

### 3. 自动迁移

配置 PostgreSQL 后首次启动会自动将 SQLite 数据迁移到 PostgreSQL，原数据库备份为 `*.migrated`。

### 手动迁移

如需重新迁移或手动控制：

```bash
# 删除备份文件（如存在）
rm minecraft_stats.db.migrated

# 运行迁移脚本
uv run scripts/migrate.py
```

### 表结构修复

如遇到布尔类型默认值错误，可运行修复脚本：

```bash
uv run scripts/fix_pgsql.py
```

### 回退到 SQLite

删除或注释 `[postgresql]` 配置节后重启即可。

---

## 贡献

欢迎提交 Issue 与 Pull Request！

详细贡献指南请参阅 [CONTRIBUTING.md](CONTRIBUTING.md)。

---

## 鸣谢

- [mcstatus](https://github.com/py-mine/mcstatus) - Minecraft 服务器查询库
- [Chart.js](https://www.chartjs.org/) - 图表库
- [Flask](https://flask.palletsprojects.com/) - Web 框架

---

## 许可证

[MIT License](LICENSE)

---

<div align="center">

Made with ❤️ by PoiCraft Team

</div>
