# MotdTracker - Rust Implementation

这是 MotdTracker 的 Rust 重构版本，使用内嵌 SQLite 数据库代替 PostgreSQL。

## 技术栈

- **Web框架**: Axum 0.7
- **异步运行时**: Tokio
- **数据库**: SQLite (sqlx)
- **Minecraft协议**: async-minecraft-ping
- **序列化**: serde, serde_json
- **日志**: tracing, tracing-subscriber
- **任务调度**: tokio-cron-scheduler
- **指标导出**: prometheus
- **Badge生成**: badge

## 核心特性

### 与Python版本功能对齐

- ✅ 多节点监控与聚合
- ✅ 内嵌SQLite数据库（替代PostgreSQL）
- ✅ Minecraft服务器状态查询
- ✅ 玩家会话管理
- ✅ 数据库抽象层
- ⏳ WebSocket实时推送
- ⏳ Prometheus指标导出
- ⏳ SVG Badge生成
- ⏳ 24小时统计分析
- ⏳ 定时轮询调度

### 新增特性

- 🚀 更高性能（Rust原生）
- 🔒 类型安全保证
- 📦 单一可执行文件部署
- ⚡ 更低资源占用

## 快速开始

### 环境要求

- Rust 1.70+ (推荐使用 rustup)
- SQLite 3
- Node.js 18+ (用于构建前端)

### 编译

```bash
# 构建后端
cargo build --release

# 构建前端
./build-frontend.sh
# 或手动构建
cd frontend && npm install && npm run build
```

### 运行

```bash
# 运行后端（会自动提供前端静态文件）
cargo run --release
# 或
./target/release/motdtracker
```

默认监听 `0.0.0.0:5011`，可在 `config.json` 中调整。

访问 http://localhost:5011 查看 React 前端界面。

### 开发模式

开发前端时可以使用热重载：

```bash
# 终端1: 运行后端
cargo run

# 终端2: 运行前端开发服务器
cd frontend
npm run dev
```

然后访问 http://localhost:3000 (前端会自动代理API到后端)

### 配置

使用与Python版本相同的 `config.json` 格式：

```json
{
  "server_name": "PoiCraft",
  "nodes": [
    {
      "id": 1,
      "name": "主线入口",
      "host": "play.example.com",
      "port": 25565,
      "color": "#10b981"
    }
  ],
  "database": "minecraft_stats.db",
  "poll_interval": 15,
  "port": 5011
}
```

**注意**: Rust版本仅使用内嵌SQLite，`postgresql` 配置项将被忽略。

## 项目结构

```
src/
├── main.rs              # 主程序入口
├── models/              # 数据模型
│   ├── config.rs        # 配置模型
│   ├── server.rs        # 服务器模型
│   ├── player.rs        # 玩家模型
│   └── status.rs        # 状态模型
├── db/                  # 数据库层
│   ├── mod.rs           # 数据库连接池
│   ├── migrations.rs    # Schema迁移
│   └── operations.rs    # 数据库操作
├── monitor/             # Minecraft监控
│   └── mod.rs           # 服务器查询实现
├── api/                 # HTTP API
│   ├── node.rs          # 节点API
│   ├── server.rs        # 服务器聚合API
│   ├── player.rs        # 玩家API
│   ├── exporter.rs      # Prometheus导出器
│   ├── badge.rs         # Badge生成
│   └── web.rs           # Web前端API
└── utils/               # 工具函数
    ├── time.rs          # 时间处理（UTC+8）
    └── version.rs       # 版本号生成
```

## 与Python版本的差异

### 数据库

| 特性 | Python版本 | Rust版本 |
|------|-----------|----------|
| SQLite | ✅ 支持 | ✅ 支持（默认） |
| PostgreSQL | ✅ 可选 | ❌ 不支持 |
| 迁移 | 自动从SQLite | 不适用 |
| 连接池 | 单线程 | 异步连接池（10连接） |

### Minecraft查询

| 特性 | Python版本 | Rust版本 |
|------|-----------|----------|
| 库 | mcstatus | async-minecraft-ping |
| status协议 | ✅ | ✅ |
| query协议 | ✅ | ❌ |
| 延迟测量 | 手动计时 | 手动计时 |

**注意**: Rust版本的 `software`, `plugins`, `map` 字段将始终为 `None`，因为 async-minecraft-ping 不支持 query 协议。

### 性能对比

| 指标 | Python版本 | Rust版本 |
|------|-----------|----------|
| 启动时间 | ~1s | <100ms |
| 内存占用 | ~50MB | ~10MB |
| 并发请求 | 同步+线程池 | 异步运行时 |
| 编译产物 | 无需编译 | 单一可执行文件 |

## 开发指南

### 添加新功能

1. 定义数据模型 (`src/models/`)
2. 实现数据库操作 (`src/db/operations.rs`)
3. 创建API路由 (`src/api/`)
4. 在 `src/api/mod.rs` 注册路由

### 运行测试

```bash
cargo test
```

### 生成文档

```bash
cargo doc --open
```

### 代码格式化

```bash
cargo fmt
cargo clippy
```

## 部署

### 单一可执行文件

```bash
cargo build --release --target x86_64-unknown-linux-musl
```

产物位于 `target/x86_64-unknown-linux-musl/release/motdtracker`

### Docker

```bash
docker build -t motdtracker-rust .
docker run -p 5011:5011 -v $(pwd)/config.json:/app/config.json motdtracker-rust
```

## 迁移指南

### 从Python版本迁移

1. **数据库兼容性**: Rust版本使用相同的SQLite schema，可直接使用现有 `minecraft_stats.db`
2. **配置文件**: 无需修改 `config.json`（除非使用了PostgreSQL）
3. **静态文件**: 复用 `static/` 和 `templates/` 目录
4. **API兼容**: 所有API端点路径保持一致

### 不兼容项

- PostgreSQL 支持已移除，仅使用 SQLite
- `software`, `plugins`, `map_name` 字段将为空（query协议不支持）
- WebSocket路径保持 `/api/socket.io`（待实现）

## 许可证

MIT

## 贡献

欢迎提交 Issue 和 Pull Request！
