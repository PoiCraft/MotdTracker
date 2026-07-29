# 01 地基：清场 + 应用壳 + MC 视觉基座

Status: ready-for-agent
Blocked by: —
Spec: ../spec.md

## 目标

清空 `frontend/src`，重建全部基础设施，产出"可构建、可路由、有 MC 视觉基座"的空壳应用。

## 范围

1. **清场**：删除 `frontend/src` 全部内容；清理 `package.json`（删 Tailwind/Radix/recharts/lucide/next-themes/cmdk/CVA/tailwind-merge；保留 react-router v7、react-query、i18next、zod、react-hook-form）
2. **字体**：接入开源像素字体（拉丁 MC 复刻 + OFL 中文像素字体），woff2 自托管，`@font-face` + 全局字体栈
3. **贴图生成脚本**：`frontend/scripts/` 下程序化生成泥土/石头/木板/黑曜石/GUI 边框 PNG，产物入 `src/assets/textures/` 并提交
4. **全局 CSS**：CSS 变量（MC 调色板、昼夜系数变量）、像素渲染规则、泥土平铺背景
5. **应用壳重建**：路由骨架（所有路由占位页）、AuthProvider（token 管理）、WebSocketProvider、QueryProvider、i18n（zh-CN/en 词条框架，先建 key 结构）
6. **MC 组件库第一批**：`McButton`（三态+按压动画，音效接口预留）、`McPanel`、`McSlot`
7. **API 层**：按后端契约重建 `api/types.ts` + `api/endpoints.ts`（参考旧代码或后端 `src/api/`）

## 验收

- `npm run build` 通过，`cargo build` 嵌入 `frontend/dist` 成功
- 浏览器打开 `/` 显示泥土背景 + MC 面板占位，字体为像素字体（中文也是）
- 路由可切换占位页；登录态 token 机制可用
- 无 Tailwind/Radix 残留依赖
