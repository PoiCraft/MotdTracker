# MotdTracker 领域词汇表

## 核心领域

- **服务器组 (Server Group)** — 一组 Minecraft 服务器的逻辑分组，侧边栏可按组过滤
- **节点 (Node)** — 一个 Minecraft 服务器连接入口（host:port + edition），隶属于某个服务器组
- **轮询 (Poll)** — 定时向所有启用节点发起 MC 查询并记录状态

## 前端（Minecraft 化重写）

- **游戏界面隐喻 (Game-screen Metaphor)** — 前端信息架构的组织原则：整个 App 按 Minecraft 游戏界面流组织（主菜单导航、多人游戏列表、GUI 面板详情页），而非传统 dashboard 布局
- **Java 经典视觉 (Java Classic Visual)** — 视觉语言基线：Minecraft Java 版 1.12 及以前的 programmer art（泥土背景、灰石按钮、像素字体）
- **程序化贴图 (Procedural Textures)** — 构建期脚本生成的像素噪声贴图（泥土/石头/木板等），用于规避官方素材版权问题
- **多人游戏列表 (Multiplayer List)** — 落地页：照抄 MC 多人服务器列表，节点=服务器条目（MOTD/人数/ping 信号格）
- **统计信息屏 (Statistics Screen)** — 全局图表/指标页，对应 MC 游戏内 Statistics 界面；时间序列用 canvas 像素图
- **TAB 玩家列表** — 玩家列表页，对应 MC 游戏内按 TAB 的玩家面板；仅像素字体名字，无头像
- **昼夜氛围 (Day/Night Ambience)** — 无主题切换，但背景色调随真实时间昼夜变化
