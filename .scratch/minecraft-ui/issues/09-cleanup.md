# 09 收尾：旧路由清理 + 端到端验收

Status: ready-for-agent
Blocked by: 02, 03, 04, 05, 06, 07, 08
Spec: ../spec.md

## 目标

全站收口，达到"完整可用、像在游戏里"的交付状态。

## 范围

1. 旧路由处理：`/server`、`/nodes`（列表）、`/monitor` 移除或重定向到新路由
2. 全站走查：每页对照 spec 页面映射表验收；视觉一致性（间距、边框、字体渲染）
3. i18n 补漏：扫描硬编码字符串，补全 zh-CN/en 词条
4. 死代码清理：未用组件/资产/依赖删除
5. **端到端验收**：`npm run build` + `cargo build` + 真实数据全页面浏览器冒烟
6. 更新 `.github/copilot-instructions.md` 中前端架构描述（栈/组件/路由已变）

## 验收

- 所有 spec 功能可用；无任何旧 UI 残留
- 构建全绿；copilot-instructions.md 与新架构一致
