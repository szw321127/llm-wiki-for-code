# 评分规则

评分仍以人工维护的 `base_score` 和项目画像调节为主，但会叠加使用统计，让真实采纳次数逐步影响推荐池排序。

## 公式

```text
final_score = base_score + project_adjustment
usage_adjustment = min(adopted_count * 3 + session_mentions, 15)
effective_score = final_score + usage_adjustment
```

- `base_score`：通用工程评价
- `project_adjustment`：某个项目画像对方案的加减分
- `final_score`：人工分和项目调节后的分数
- `usage_adjustment`：由 `state/usage-index.json` 派生的使用加权
- `effective_score`：当前项目视角下用于排序的最终推荐分

## 评分维度

| 维度 | 含义 | 分值范围 |
| --- | --- | --- |
| 一致性 | 是否符合通用或项目规则 | 0-20 |
| 开发效率 | 是否容易快速落地 | 0-20 |
| 可维护性 | 后续维护和排错成本 | 0-20 |
| 扩展性 | 面对变化时的演进能力 | 0-20 |
| 风险 | 实现分叉、缺陷、隐性成本风险控制水平 | 0-20 |

## 维护要求

- `score_breakdown` 五项之和必须等于 `base_score`
- `preferred_options` 只表达项目调节值，不重复维护总分
- 项目视角切换时只变更 `project_adjustment`、`final_score` 和 `effective_score`
- 没有项目偏好时，默认 `project_adjustment = 0`
- `usage_adjustment` 由采纳与提及统计自动派生，不手写进 Markdown

## 推荐策略

- 全局视角：按 `base_score + usage_adjustment` 排序
- 项目视角：按 `effective_score` 排序
- stable 方案优先于 incubating 方案
- 每个 `Practice` 在每个视角下生成最多 3 个 `recommendation_pools`
- `recommended_options` 取推荐池第一名
