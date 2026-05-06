# 项目实践推荐闭环设计

**日期**: 2026-04-28
**范围**: 把现有项目知识库 MVP 重构为“任务前推荐、任务后结晶、采纳驱动晋升”的项目实践推荐闭环。
**非目标**: 不引入数据库、向量检索、联网分析或自动修改业务代码；不做跨项目云端同步。

---

## 1. 目标

当前系统已经有 `.project-knowledge/`、结构化 Markdown、图谱阅读层、session 结晶和 `usage-index.json`。本次重构把这些能力串成闭环：

- 任务开始前先查项目知识库，优先返回已有最佳实践
- 没有命中时，扫描本地项目代码，给 agent 提供候选证据路径
- 任务结束时强制写 session，记录本轮采用、提及或新增的实践
- 新知识默认进入 `incubating/`
- `adopted_count` 参与评分和推荐排序
- 每个 practice 的推荐池最多保留 3 个 option
- 超出推荐池的候选保留为孵化或普通候选，不抢默认推荐位

这对应 Karpathy LLM Wiki 的三段式：

- Query: 会话开始查 wiki
- Ingest: 新证据和新实践写入 wiki
- Lint: 周期性整理推荐池、孵化区和使用统计

---

## 2. 数据模型调整

继续使用 Markdown 作为唯一事实源，`state/usage-index.json` 保存动态使用统计。

### 2.1 Option 排序字段

`option` 仍保留：

```yaml
base_score:
score_breakdown:
maturity: incubating | stable
source_evidence: []
session_refs: []
```

图谱构建时派生：

- `usage_stats.adopted_count`
- `usage_stats.session_mentions`
- `usage_adjustment`
- `effective_scores`
- `recommendation_pool`
- `recommended_options`

### 2.2 评分公式

项目视角下：

```text
effective_score = base_score + project_adjustment + usage_adjustment
usage_adjustment = min(adopted_count * 3 + session_mentions, 15)
```

含义：

- 人工分仍是主导，避免一次采用把低质量方案推上去
- 采纳次数能稳定加权，让真实使用逐步影响排序
- 上限 15 分，防止历史惯性压过明显更好的实践

### 2.3 推荐池

每个 practice 在每个视角下生成：

- `ranked_option_ids`: 全量排序
- `recommendation_pools[viewId]`: 最多 3 个推荐候选
- `recommended_options[viewId]`: 默认推荐，取推荐池第一名

推荐池策略：

- stable option 优先进入池
- incubating option 只有分数高于最低 stable 候选，或没有 stable 候选时才进入池
- 超过 3 个时截断
- 未入池的 incubating 继续保留，不删除

---

## 3. 会话开始 Preflight

新增 `pk:preflight`，职责是任务开始前读取最小知识上下文：

- `project-profile.md`
- `graph-index.json`
- `graph-data.json`
- `usage-index.json`
- 最近 session

输入是任务描述。输出是 JSON：

```json
{
  "mode": "knowledge-hit | needs-project-scan | no-knowledge",
  "matchedPractices": [],
  "recommendedOptions": [],
  "incubatingCandidates": [],
  "evidenceHints": []
}
```

行为：

- 有 `.project-knowledge/` 且命中关键词：返回实践、推荐池和证据
- 有 `.project-knowledge/` 但无命中：扫描本地代码，返回候选证据路径
- 没有 `.project-knowledge/`：提示先运行 `pk:init`

这一步不写文件，只做任务前上下文准备。

---

## 4. 会话结束 Crystallize

`pk:crystallize` 保持现有能力，但语义调整为“每次任务后都可以调用”：

- 默认写 session
- 有采用的实践时更新 `adopted_count`
- 有新实践时写入 `incubating/`
- 有稳定结论时更新 stable 节点
- 只要知识或采用状态变化，就刷新图谱

本次实现不做 LLM 自动判断内容质量；agent 仍负责把 `incubatingNodes`、`stableUpdates`、`adoptedNodeIds` 传给脚本。

---

## 5. Lint / 推荐池整理

新增 `pk:lint` 的最小版本，职责：

- 重建图谱
- 输出每个 practice 的推荐池
- 标记推荐池外的 incubating option
- 发现无 evidence 的节点、无 practice 的 option、空推荐池 practice

本次 lint 只报告，不自动删除文件。

---

## 6. 测试策略

新增或调整 Node 原生测试：

- 推荐排序包含 `usage_adjustment`
- 每个 practice 推荐池最多 3 个 option
- adopted_count 增长会影响推荐顺序
- `pk:preflight` 命中已有知识时返回推荐实践
- `pk:preflight` 无命中时返回本地代码证据 hint
- `pk:lint` 能报告推荐池和孤立/缺证据问题

---

## 7. 迁移兼容

现有 `.project-knowledge/` 不需要迁移：

- 缺少 `usage-index.json` 时按空统计处理
- 老图谱字段继续保留
- 新字段都是派生字段
- `pk:status` 可以继续显示稳定/孵化数量和推荐项


