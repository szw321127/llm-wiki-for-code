---
id: option-unified-client
type: option
title: 统一调用封装层
practice: practice-http-client
base_score: 89
score_breakdown:
  consistency: 20
  efficiency: 17
  maintainability: 19
  extensibility: 17
  risk: 16
tech: [typescript, java, python]
constraints: [constraint-backward-compatibility, constraint-no-extra-runtime]
alternatives: [option-direct-call]
recommended: true
status: active
---

## Summary

通过统一 API Client 或调用包装器承载鉴权、日志、错误映射、重试和观测逻辑。

## Advantages

- 一致性和治理能力强
- 便于集中扩展横切能力

## Risks

- 需要定义清晰的封装边界
- 初期需要整理既有调用方式

## When To Use

- 调用点数量会持续增加
- 需要统一治理跨模块请求行为

## Notes

- 适合作为长期默认方案
