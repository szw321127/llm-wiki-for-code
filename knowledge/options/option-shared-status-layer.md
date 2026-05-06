---
id: option-shared-status-layer
type: option
title: 共享任务状态层
practice: practice-task-status-feedback
base_score: 86
score_breakdown:
  consistency: 18
  efficiency: 16
  maintainability: 18
  extensibility: 17
  risk: 17
tech: [ui-state, event, workflow]
constraints: [constraint-low-operational-complexity]
alternatives: [option-local-status-handling]
recommended: true
status: active
---

## Summary

用共享状态容器、事件总线或统一任务模型表达流程状态，而不是让每个局部自行管理。

## Advantages

- 跨页面、跨步骤状态一致
- 容易统一 loading、progress、success、error 表达

## Risks

- 命名和边界设计需要提前约束

## When To Use

- 一个任务会影响多个模块
- 需要统一反馈复杂流程状态

## Notes

- 对企业 Web 和流程型系统尤其有效
