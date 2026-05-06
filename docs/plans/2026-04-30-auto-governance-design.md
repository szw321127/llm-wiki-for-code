# 自动知识治理设计

## 目标

把 `pk:pk-lint` 发现的治理候选转成可执行流程，减少人工移动 Markdown 文件的成本，同时保留可逆性和人工打回入口。

## 范围

- 新增自动治理入口 `pk:pk-govern` / `npm run pk:govern`
- 自动处理孵化转正、推荐池淘汰、强重复节点
- 图谱详情页展示治理状态，并提供人工打回按钮
- `pk:serve` 增加受限本地写入 API，允许图谱页打回节点

## 处理策略

自动治理只做可回退操作，不物理删除知识文件。

- 孵化转正：达到采纳阈值、未被打回、没有强重复冲突时，从 `incubating/<type>s/` 移入稳定目录，并把 `maturity` 改为 `stable`。
- 推荐池淘汰：稳定节点退回 `incubating/`；孵化节点保留在孵化区并标记 `review_status: rejected`。
- 强重复：只处理标题或摘要完全相同的重复节点。保留采纳次数、证据数量、分数更高的一方，另一方标记 `review_status: rejected` 并记录 `duplicate_of`。
- 模糊重复：继续只在 lint 中提示，不自动合并。

## 图谱打回

图谱页通过 `pk:serve` 的本地 API 写回 `.project-knowledge/`：

- `POST /api/governance/reject` 接收 `{ nodeId, reason }`
- 服务端只允许操作 `.project-knowledge/` 内已存在的节点 Markdown
- 打回后节点标记 `review_status: rejected`，并在必要时移动回 `incubating/`
- API 执行后重建图谱与 Obsidian 视图，页面重新加载数据

## 安全边界

- 不自动物理删除文件
- 不修改业务代码
- 写入路径必须限制在 `.project-knowledge/`
- 所有自动治理和打回都追加 `log.md`
- 默认执行真实治理；后续可扩展 `dryRun`，但当前 MVP 先服务实际落地


