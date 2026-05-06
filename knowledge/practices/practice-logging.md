---
id: practice-logging
type: practice
title: 日志记录策略实践
contexts: [context-frontend-crud, context-backend-api, context-automation-script, context-engineering-workflow]
constraints: [constraint-auditability, constraint-low-operational-complexity]
tech: [logging, observability, diagnostics]
rules: [rule-structured-log-first]
keywords: [logging, trace, observability, diagnostics]
status: active
---

## Summary

日志应优先服务于排障、追踪和审计，而不是仅供开发时临时查看。

## Decision

默认推荐结构化日志，保留稳定字段和上下文；纯文本日志只适合作为非常短生命周期的补充。

## When To Use

- 需要跨服务检索和聚合日志
- 需要脚本执行记录可以被审计
- 需要工程流程输出可用于回放和统计

## Tradeoffs

- 结构化日志前期需要定义字段规范
- 纯文本日志上手快，但后续很难稳定聚合和告警

## Evidence

- 一致的字段模型是跨环境定位问题和沉淀运营指标的基础
