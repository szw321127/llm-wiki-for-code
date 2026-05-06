---
id: practice-error-handling
type: practice
title: 错误处理策略实践
contexts: [context-frontend-crud, context-backend-api, context-automation-script, context-engineering-workflow]
constraints: [constraint-auditability, constraint-low-operational-complexity]
tech: [error, exception, recovery]
rules: [rule-structured-log-first]
keywords: [error, exception, recovery, fallback]
status: active
---

## Summary

错误处理不应只停留在 `catch`，而应统一定义分类、映射、日志和用户反馈方式。

## Decision

默认推荐集中式错误处理入口，统一完成分类、记录、转换与反馈；仅在非常局部的场景使用内联处理。

## When To Use

- 需要区分业务错误、系统错误和可恢复错误
- 需要统一对外文案和告警行为
- 需要让脚本和工程流程在失败时保持可解释

## Tradeoffs

- 集中式入口更利于治理和复盘，但需要建立错误模型
- 内联处理更快开始，却容易造成同类错误被不同方式处理

## Evidence

- 可审计项目里，错误分类和日志上下文不统一通常会直接抬高排障成本
