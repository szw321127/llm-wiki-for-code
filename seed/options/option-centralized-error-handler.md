---
id: option-centralized-error-handler
type: option
title: 集中式错误处理入口
practice: practice-error-handling
base_score: 87
score_breakdown:
  consistency: 19
  efficiency: 16
  maintainability: 18
  extensibility: 17
  risk: 17
tech: [middleware, interceptor, wrapper]
constraints: [constraint-auditability]
alternatives: [option-inline-error-handler]
recommended: true
status: active
---

## Summary

通过统一错误入口完成分类、日志记录、错误映射和对外反馈。

## Advantages

- 同类错误处理方式一致
- 方便接入日志、告警和降级策略

## Risks

- 需要约定错误模型和边界

## When To Use

- 需要跨模块统一错误语义
- 需要稳定审计和复盘链路

## Notes

- 与统一调用封装层、结构化日志配合效果最好
