# MotdTracker React Frontend

这是 MotdTracker 的 React 前端实现。

## 技术栈

- **React 18** - UI 框架
- **TypeScript** - 类型安全
- **Vite** - 构建工具
- **React Router** - 路由管理
- **Chart.js** - 图表库
- **Socket.IO Client** - WebSocket 实时通信
- **Axios** - HTTP 客户端

## 开发

### 安装依赖

```bash
cd frontend
npm install
```

### 开发服务器

```bash
npm run dev
```

访问 http://localhost:3000

开发服务器会自动代理 API 请求到后端 (http://localhost:5011)

### 构建生产版本

```bash
npm run build
```

构建产物会输出到 `../static/dist/` 目录

## 项目结构

```
frontend/
├── src/
│   ├── components/     # 可复用组件
│   │   ├── Layout.tsx
│   │   └── Sidebar.tsx
│   ├── pages/          # 页面组件
│   │   ├── ServerPage.tsx
│   │   ├── NodesPage.tsx
│   │   ├── PlayersPage.tsx
│   │   └── BadgesPage.tsx
│   ├── hooks/          # 自定义 Hooks
│   │   └── useWebSocket.ts
│   ├── services/       # API 服务
│   │   └── api.ts
│   ├── App.tsx         # 主应用组件
│   ├── main.tsx        # 入口文件
│   └── index.css       # 全局样式
├── package.json
├── vite.config.ts
└── tsconfig.json
```

## 特性

- 🎨 现代化 UI 设计（深色主题）
- 📊 实时数据更新（WebSocket）
- 📱 响应式布局
- ⚡ 快速构建（Vite）
- 🔐 TypeScript 类型安全
- 🎯 组件化架构

## API 集成

前端通过以下 API 与后端通信：

- `GET /api/server/nodes` - 获取节点列表
- `GET /api/server/stats` - 获取服务器统计
- `GET /api/player/list` - 获取玩家列表
- WebSocket `/socket.io` - 实时更新

## 环境变量

开发环境会自动配置 API 代理到 `http://localhost:5011`

如需修改后端地址，编辑 `vite.config.ts` 中的 `server.proxy` 配置。

## 部署

### 静态部署

构建后的文件会输出到 `../static/dist/`，可以直接被 Rust 后端的静态文件服务提供。

### 独立部署

也可以将构建产物部署到 CDN 或静态托管服务（如 Vercel、Netlify），只需配置正确的 API 地址。
