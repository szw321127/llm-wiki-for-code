---
id: option-plain-logging
type: option
title: 纯文本日志
practice: practice-logging
base_score: 62
score_breakdown:
  consistency: 10
  efficiency: 18
  maintainability: 11
  extensibility: 8
  risk: 15
tech: [console, stdout, print]
constraints: []
alternatives: [option-structured-logging]
recommended: false
status: active
---

## Summary

只输出纯文本消息，不约束结构化字段和统一事件模型。

## Advantages

- 上手快
- 一次性脚本可直接使用

## Risks

- 聚合、检索和告警能力较弱
- 长期维护时缺乏稳定上下文

## When To Use

- 很短生命周期的本地调试

## Notes

- 适合作为临时补充，不适合作为默认策略
