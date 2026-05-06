---
id: option-local-status-handling
type: option
title: 局部状态处理
practice: practice-task-status-feedback
base_score: 72
score_breakdown:
  consistency: 12
  efficiency: 18
  maintainability: 14
  extensibility: 12
  risk: 16
tech: [component-state, local-var]
constraints: []
alternatives: [option-shared-status-layer]
recommended: false
status: active
---

## Summary

每个模块只管理自身的任务状态，不提供统一的共享状态抽象。

## Advantages

- 落地简单
- 小范围流程开发速度快

## Risks

- 复杂流程会出现反馈不一致和重复逻辑

## When To Use

- 单页面、单步骤、无跨模块协同的任务

## Notes

- 随着流程增长通常需要向共享状态层迁移
