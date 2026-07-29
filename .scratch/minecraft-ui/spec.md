# Spec: Minecraft 游戏界面前端重写

状态：已确认（grill-with-docs 面试定稿 2026-07-29）
关联文档：`CONTEXT.md`、`docs/adr/0001-minecraft-game-screen-frontend-rewrite.md`

## 目标

将 MotdTracker 前端**从零重写**为 Minecraft Java 经典版（1.12 前 programmer art）游戏界面：用户打开网站就像进入了 Minecraft。整个 App 按**游戏界面隐喻**组织，而非"MC 皮肤的 dashboard"。

## 非目标

- 后端零改动（API 契约、Badge SVG 生成、轮询器、WebSocket 全部不动）
- 不引入官方 Minecraft 资源（字体/贴图/音效一律开源复刻或程序化生成）
- 不做多主题皮肤系统（下界/末地等变体留给未来）
- 不做全套音效（仅按钮点击音）
- 玩家列表无头像

## 已定决策（13 条）

| # | 决策 | 结论 |
|---|---|---|
| 1 | 重写边界 | 彻底从 0，`frontend/src` 零继承 |
| 2 | 技术栈 | React 19 + Vite + TS（不变） |
| 3 | 风格深度 | 游戏界面隐喻 |
| 4 | 视觉时代 | Java 经典 programmer art |
| 5 | 素材 | 开源像素字体（拉丁 + OFL 中文）自托管；贴图程序化生成 |
| 6 | 落地页 | 多人游戏列表直接落地 |
| 7 | 页面映射 | 见下表 |
| 8 | 图表 | 自研 canvas 像素图 + 快捷栏/经验条热力 |
| 9 | 音效 | 按钮点击音 + 按压动画 + 全局静音开关 |
| 10 | 主题 | 单主题 + 昼夜氛围（背景色调随真实时间） |
| 11 | 多语言 | zh-CN + en 双语保留 |
| 12 | 切换策略 | 就地清场重建：地基 → 多人列表页 → 逐页补齐 |
| 13 | 玩家头像 | 无头像，TAB 列表纯像素字体名字 |

## 页面映射

| 现有路由 | MC 界面 | 说明 |
|---|---|---|
| `/` | **多人游戏列表**（落地页） | 节点=服务器条目：MOTD（含格式化代码渲染）、人数 `x/y`、ping 信号格、在线绿点/离线红叉；组过滤=列表上方标签栏 |
| `/stats`（原 Dashboard 图表区） | **统计信息屏** | 全局指标 + canvas 像素时间序列图（人数历史、延迟） |
| `/nodes/:nodeId` | **服务器信息 GUI 面板** | 物品栏边框式容器；节点详情、历史图表、在线率快捷栏 |
| `/players` | **TAB 玩家列表** | 悬浮面板：像素字体名字网格，按节点分组 |
| `/players/:playerName` | **玩家统计屏** | 该玩家的会话历史、常在节点、在线时长（成就/统计式排版） |
| `/badges` | **设置屏风格表单** | Badge 生成器：MC 选项页式输入框/下拉/滑块 + 实时预览 |
| `/admin` | **"选项..."设置屏** | 节点 CRUD、组管理、Webhook 告警、密码修改；MC 表单控件 |
| `/login` | **MC 登录框** | 居中输入框 + 大按钮 |
| 其余（`/server`、`/nodes`、`/monitor`） | 合并/删除 | 功能并入多人列表与统计屏，路由 301 或直接移除 |

## 视觉系统

### 字体
- 拉丁：开源 Minecraft 复刻像素字体（OFL/CC0），woff2 自托管
- 中文：OFL 中文像素字体（缝合像素字体或等价物），woff2 自托管
- 字体栈：`"MC-Latin", "MC-CJK", monospace`；全局像素渲染（`image-rendering: pixelated` 用于图形，字体不做平滑 hack）

### 贴图（构建期脚本程序化生成 PNG）
- 泥土（平铺背景）、石头、木板、沙砾、黑曜石（深色容器）
- GUI 边框：物品栏槽位、窗口边框（九宫格切片）
- 按钮：灰石按钮三态（正常/悬停/按下），高光边+阴影边 CSS 实现优先，贴图兜底
- 生成脚本放 `frontend/scripts/gen-textures.*`，产物入 `frontend/src/assets/textures/` 并提交（构建可复现，但生成结果也入库以便审阅）

### 组件库（`frontend/src/components/mc/`，全部手写 CSS）
- `McButton`（三态 + 点击音 + 按压动画）
- `McPanel`（GUI 窗口边框容器）
- `McSlot`（物品栏槽位卡片）
- `McInput` / `McSelect` / `McSlider` / `McToggle`（设置屏控件）
- `McTabs`（组过滤标签栏）
- `McTooltip`（MC 物品提示框样式：深蓝底+紫边框）
- `McProgressBar`（经验条样式）
- `McHeatBar`（在线率热力，快捷栏格子样式）
- `McServerEntry`（多人列表条目：MOTD 渲染、人数、ping 格）
- `McMotd`（MOTD 格式化代码 `§` 渲染器，含颜色+粗体/斜体/下划线/乱码）

### 图表（`frontend/src/components/mc/charts/`）
- canvas 渲染，关闭抗锯齿，块状像素
- 调色板：草绿 `#7CBD3E`=在线，红石红 `#C62828`=离线，金 `#FCDB00`=警告，青灰=网格
- 时间序列：像素折线/柱状 + 坐标纸网格；hover 十字线 + McTooltip 读数
- 数据层沿用现有 API（react-query），图表只负责渲染

### 音效
- 按钮点击音：CC0 复刻或合成，单文件 `click.ogg/mp3`，`McButton` 统一播放
- 全局静音开关：localStorage 持久化，设置屏可关
- 按压动画：高光/阴影边翻转 + 1px 位移，无音频依赖

### 昼夜氛围
- 依据本地时间计算日周期系数，调整全局背景色调/亮度（泥土背景叠加深色蒙版透明度）
- 纯 CSS 变量驱动，无主题切换 UI

## 管道

- **保留**：react-router v7、@tanstack/react-query、i18next 系、zod、react-hook-form
- **删除**：Tailwind、Radix 全家、recharts、lucide-react、next-themes、cmdk、class-variance-authority、tailwind-merge、clsx（按需保留）
- **构建契约不变**：`vite build` → `frontend/dist/`（rust-embed 编译期嵌入，路径不可改）
- 图标：像素图标手写 SVG 或内联，不引图标库

## 迁移策略

就地清场重建：
1. Ticket 1：清空 `frontend/src`，打地基——字体接入、贴图生成脚本、全局 CSS 变量、MC 组件库、应用壳（路由 + i18n + Auth + WS 重建）
2. Ticket 2：多人游戏列表落地页（最先可用）
3. 后续 ticket 逐页补齐（统计屏、节点详情、玩家、徽章、管理、登录）
4. 中间状态允许缺页，但 `main` 始终可构建

## 验收

- 每页在浏览器冒烟验证（视觉确认"像在游戏里"）
- 全部现有功能可用：节点管理、组过滤、实时刷新（WS）、图表、徽章生成、登录/管理
- `npm run build` 通过，`cargo build` 嵌入成功，端到端可跑
- 双语切换正常，中文字体无回退到系统字体

## 遗留问题（实现期决定）

- 各贴图具体清单与噪声参数（地基 ticket 内定）
- 像素图表坐标轴/刻度的具体表达
- splash 黄色标语不做（无标题画面）
- 旧路由的兼容策略（建议直接移除，不做重定向）
