---
id: option-structured-logging
type: option
title: 结构化日志
practice: practice-logging
base_score: 90
score_breakdown:
  consistency: 20
  efficiency: 15
  maintainability: 19
  extensibility: 18
  risk: 18
tech: [json, fields, trace]
constraints: [constraint-auditability, constraint-low-operational-complexity]
alternatives: [option-plain-logging]
recommended: true
status: active
---

## Summary

以稳定字段、上下文和事件名记录日志，便于检索、聚合、审计和告警。

## Advantages

- 易于机器处理和统计
- 更适合跨团队、跨环境排障

## Risks

- 需要建立字段命名规范

## When To Use

- 需要审计、检索和趋势分析
- 需要统一观察多个系统

## Notes

- 日志字段模型应与错误模型和任务状态模型联动
