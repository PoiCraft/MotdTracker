# CSS 文件结构说明

## 概述

CSS代码已从单个1603行的 `style.css` 文件拆分为多个模块化文件，提高可维护性和可读性。

## 文件结构

### 主文件

- **style.css** (12行)
  - 主入口文件，包含所有模块的@import语句
  - 浏览器加载此文件时会自动加载所有子模块

### 核心模块

#### 1. variables.css (30行)

**用途**: 全局CSS变量和重置样式

- CSS变量定义（颜色、间距等）
- 全局重置（*, box-sizing等）
- body基础样式

#### 2. layout.css (170行)

**用途**: 页面布局结构

- 容器和主布局
- 侧边栏导航（sidebar）
- 固定头部（header）
- 移动菜单切换
- 侧边栏遮罩层

#### 3. components.css (408行)

**用途**: 可复用的UI组件

- 服务器卡片（server-card）
- 状态徽章（status-badge）
- 统计网格（stats-grid）
- 按钮和输入框
- 工具栏
- WebSocket状态指示器
- 时间范围选择器
- 信息列表

#### 4. charts.css (25行)

**用途**: 图表容器和基础样式

- chart-container
- chart-small, chart-tall
- 图表标题

#### 5. heatmap.css (197行)

**用途**: 热力图相关样式

- 24小时热力图
- 玩家活动热力图  
- 在线人数热力图
- 分钟级热力图
- 热力图单元格交互效果

#### 6. players.css (65行)

**用途**: 玩家列表页面特定样式

- 玩家列表容器
- 玩家卡片
- 玩家行样式
- 玩家元信息

#### 7. modals.css (135行)

**用途**: 弹窗和模态框

- 小时详情弹窗
- 下拉式弹窗
- 弹窗动画
- 关闭按钮

#### 8. spinners.css (37行)

**用途**: 加载动画

- 加载旋转器（loading-spinner）
- 卡片加载旋转器（card-spinner）
- 旋转动画关键帧

#### 9. pages.css (139行)

**用途**: 特定页面的专属样式

- Badges页面（badge-container, badge-toolbar等）
- Player Detail页面（player-heatmap）
- Nodes页面（node-stats, node-stat-*）
- 玩家状态颜色类

#### 10. responsive.css (189行)

**用途**: 响应式设计

- 平板设备适配（<1024px）
- 移动设备适配（<768px, <480px）
- 侧边栏折叠
- 网格布局调整
- 字体大小调整

## 加载顺序

文件按以下顺序加载（通过@import）：

1. variables.css - 首先加载变量
2. layout.css - 基础布局
3. components.css - 通用组件
4. charts.css - 图表
5. heatmap.css - 热力图
6. players.css - 玩家页面
7. modals.css - 弹窗
8. spinners.css - 加载动画
9. pages.css - 页面特定
10. responsive.css - 最后加载响应式（覆盖）

## 使用方法

HTML模板中只需引用主文件：

```html
<link rel="stylesheet" href="{{ url_for('static', filename='css/style.css') }}">
```

## 维护建议

- 修改全局颜色/变量: 编辑 `variables.css`
- 修改布局结构: 编辑 `layout.css`
- 添加新组件: 编辑 `components.css`
- 修改特定页面: 编辑对应的 `pages.css`
- 调整移动端样式: 编辑 `responsive.css`

## 统计信息

- 原始文件: 1603行
- 拆分后总计: 1407行（10个模块）
- 主文件: 12行
- 平均每个模块: ~140行

## 优势

✅ 模块化 - 职责清晰，易于定位
✅ 可维护性 - 修改不影响其他模块
✅ 可读性 - 每个文件专注特定功能
✅ 团队协作 - 减少代码冲突
✅ 性能 - 浏览器可并行加载（HTTP/2）
