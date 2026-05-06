---
id: option-exponential-backoff
type: option
title: 指数退避重试
practice: practice-retry-strategy
base_score: 84
score_breakdown:
  consistency: 17
  efficiency: 15
  maintainability: 17
  extensibility: 17
  risk: 18
tech: [retry, timeout, jitter]
constraints: [constraint-backward-compatibility, constraint-low-operational-complexity]
alternatives: [option-no-retry]
recommended: true
status: active
---

## Summary

对满足幂等和暂时性失败前提的操作，采用带上限的指数退避重试。

## Advantages

- 能提升短暂故障下的成功率
- 可通过参数控制资源放大风险

## Risks

- 需要明确哪些错误和操作允许重试
- 需要避免对非幂等操作滥用

## When To Use

- 外部依赖偶发抖动
- 自动化任务可接受有限重试

## Notes

- 建议同时记录重试次数和最终失败原因
