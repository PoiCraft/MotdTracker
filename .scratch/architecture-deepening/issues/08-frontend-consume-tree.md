# 08 — 前端消费嵌套树、删除分组代码

**What to build:** 前端改为直接消费服务端返回的组→服务器→节点嵌套树；五处自行分组的代码（含 `__ungrouped` 哨兵值）整体删除。Dashboard、Servers、Badges、Admin、Monitor 各页面渲染结果与迁移前一致。

**Blocked by:** 06 — servers/groups handler 迁移 + 嵌套树 JSON

**Status:** done

- [x] 五处分组 Map 构建与 `__ungrouped` 哨兵全部删除
- [x] 页面直接遍历嵌套树渲染，未分组节点的展示与之前一致
- [x] 组过滤、排序行为与迁移前一致
- [x] 前端构建通过，各页面人工冒烟
