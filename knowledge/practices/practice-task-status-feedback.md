---
id: practice-task-status-feedback
type: practice
title: 任务状态反馈实践
contexts: [context-frontend-crud, context-backend-api, context-engineering-workflow]
constraints: [constraint-no-extra-runtime, constraint-low-operational-complexity]
tech: [ui, workflow, async]
rules: [rule-shared-status-first]
keywords: [loading, progress, status, feedback]
status: active
---

## Summary

对用户可见或跨步骤的任务执行，应统一表达开始、进行中、成功、失败和可重试状态。

## Decision

默认推荐共享状态层来表达任务进度；单点局部流程才适合局部状态处理。

## When To Use

- 前端页面需要统一 loading、empty、error 反馈
- 后端异步流程需要统一任务状态
- 工程流程需要给出明确的阶段反馈

## Tradeoffs

- 共享状态层便于跨模块协调，但需要收敛命名和事件边界
- 局部状态处理简单直接，但很难支撑复杂流程复用

## Evidence

- 一旦任务状态跨页面、跨步骤扩散，零散局部状态会迅速降低可观察性
