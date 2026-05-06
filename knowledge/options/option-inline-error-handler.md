---
id: option-inline-error-handler
type: option
title: 内联错误处理
practice: practice-error-handling
base_score: 70
score_breakdown:
  consistency: 12
  efficiency: 18
  maintainability: 14
  extensibility: 11
  risk: 15
tech: [try-catch, local-branch]
constraints: []
alternatives: [option-centralized-error-handler]
recommended: false
status: active
---

## Summary

每个模块自行捕获和处理错误，不借助共享错误模型和统一入口。

## Advantages

- 改造门槛低
- 局部逻辑上手快

## Risks

- 很容易出现同类错误不同处理方式
- 日志、告警和文案难以统一

## When To Use

- 原型验证或非常局部的一次性流程

## Notes

- 不建议作为默认长期方案
