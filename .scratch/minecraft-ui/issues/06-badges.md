# 06 徽章生成器：设置屏风格表单

Status: ready-for-agent
Blocked by: 01
Spec: ../spec.md

## 目标

`/badges` 实现为 MC 选项页风格表单 + 实时预览。

## 范围

1. MC 表单控件补全：`McInput`、`McSelect`、`McToggle`（若 01 未做则在此补齐）
2. Badge 参数表单：节点选择、类型（状态/人数/延迟/在线率）、样式参数
3. 实时预览（`<img src="/api/badge/...">`，后端不动）+ 复制链接（Markdown/HTML/纯链接）
4. react-hook-form + zod 校验

## 验收

- 浏览器冒烟：改参数 → 预览实时更新，三种格式复制正确
- 表单校验错误以 MC 风格提示
- 双语词条完整
