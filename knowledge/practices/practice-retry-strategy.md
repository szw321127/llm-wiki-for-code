---
id: practice-retry-strategy
type: practice
title: 重试策略实践
contexts: [context-backend-api, context-automation-script, context-engineering-workflow]
constraints: [constraint-backward-compatibility, constraint-low-operational-complexity]
tech: [retry, resilience, network]
rules: []
keywords: [retry, backoff, resilience, timeout]
status: active
---

## Summary

重试是一种显式工程策略，而不是失败后随手再试一次；它需要边界、次数、退避和幂等前提。

## Decision

默认推荐指数退避重试，只对短暂性失败和幂等操作生效；对不可重试场景应明确选择不重试。

## When To Use

- 外部依赖偶发超时或抖动
- 自动化任务需要容忍瞬时故障
- 发布流程中存在可恢复的网络请求

## Tradeoffs

- 合理重试提升成功率，但错误的重试会放大事故和资源占用
- 不重试实现最简单，但成功率和体验常受损

## Evidence

- 未定义边界的重试常常比没有重试更危险，因此策略必须明确写入知识库
