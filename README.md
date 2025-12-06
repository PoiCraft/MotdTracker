# Minecraft服务器监控工具

这是一个基于Flask的Minecraft Java版服务器监控工具，可以定期轮询多个服务器的状态并记录到SQLite数据库中。

## 功能特性

- ⏱️ 定时轮询多个Minecraft服务器（默认1分钟间隔）
- 📊 记录服务器延迟、在线玩家数、版本等信息
- 💾 使用SQLite数据库持久化存储监控数据
- 🌐 提供Web界面查看实时状态
- 🔌 提供REST API接口获取服务器数据

## 安装

1. 确保已安装Python 3.13+

2. 安装依赖：
```bash
uv sync
```

## 配置

编辑 `config.json` 文件，添加要监控的服务器：

```json
{
  "servers": [
    {
      "name": "示例服务器1",
      "host": "mc.example.com",
      "port": 25565
    },
    {
      "name": "示例服务器2",
      "host": "play.example.net",
      "port": 25565
    }
  ],
  "database": "minecraft_stats.db",
  "poll_interval": 60
}
```

配置说明：
- `servers`: 服务器列表
  - `name`: 服务器名称
  - `host`: 服务器地址
  - `port`: 服务器端口（默认25565）
- `database`: 数据库文件路径
- `poll_interval`: 轮询间隔（秒）

## 运行

```bash
uv run main.py
```

启动后访问 http://127.0.0.1:5000 查看监控面板。

## API接口

### 获取所有服务器状态
```
GET /api/servers
```

### 获取单个服务器最新状态
```
GET /api/server/<server_id>
```

### 获取服务器历史记录
```
GET /api/server/<server_id>/history
```

## 数据库结构

### servers表
存储服务器基本信息：
- id: 服务器ID
- name: 服务器名称
- host: 服务器地址
- port: 服务器端口

### status_logs表
存储监控记录：
- id: 记录ID
- server_id: 服务器ID
- timestamp: 记录时间
- online: 是否在线
- latency: 延迟（毫秒）
- players_online: 在线玩家数
- players_max: 最大玩家数
- version: 服务器版本
- motd: 服务器描述

## 技术栈

- Flask: Web框架
- mcstatus: Minecraft服务器查询库
- APScheduler: 定时任务调度
- SQLite: 数据存储

## 许可证

MIT License
