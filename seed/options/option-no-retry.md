---
id: option-no-retry
type: option
title: 明确不重试
practice: practice-retry-strategy
base_score: 66
score_breakdown:
  consistency: 11
  efficiency: 20
  maintainability: 12
  extensibility: 7
  risk: 16
tech: [fail-fast]
constraints: []
alternatives: [option-exponential-backoff]
recommended: false
status: active
---

## Summary

失败立即返回，不为调用增加自动重试逻辑。

## Advantages

- 实现最简单
- 行为边界清晰

## Risks

- 对瞬时失败容忍度低
- 用户体验和成功率可能更差

## When To Use

- 非幂等操作
- 失败成本高于偶发成功率损失

## Notes

- 适合明确禁止重试的敏感流程
