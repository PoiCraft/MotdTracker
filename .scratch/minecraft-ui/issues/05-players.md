# 05 玩家：TAB 列表 + 玩家统计屏

Status: ready-for-agent
Blocked by: 01
Spec: ../spec.md

## 目标

`/players` 与 `/players/:playerName` 实现为游戏内 TAB 玩家列表与玩家统计屏。

## 范围

1. `/players`：悬浮面板式名单——像素字体名字网格，按节点分组；搜索过滤（MC 输入框）；点击进入玩家详情；无头像
2. `/players/:playerName`：该玩家的统计/成就式排版——总在线时长、首次/最后出现、常在线节点、会话历史表格（MC 风格）
3. 数据：`/api/player/*` + react-query

## 验收

- 浏览器冒烟：玩家列表与详情数据正确，搜索过滤生效
- 会话历史时间显示 UTC+8
- 双语词条完整
