---
id: option-centralized-config
type: option
title: 集中配置入口
practice: practice-config-management
base_score: 88
score_breakdown:
  consistency: 19
  efficiency: 16
  maintainability: 19
  extensibility: 18
  risk: 16
tech: [env, config-file, schema]
constraints: [constraint-auditability, constraint-no-extra-runtime]
alternatives: [option-inline-config]
recommended: true
status: active
---

## Summary

通过统一配置模块、配置文件或环境变量入口管理默认值和覆盖顺序。

## Advantages

- 配置来源清晰
- 更容易做审计和环境对比

## Risks

- 需要约定命名、优先级和校验策略

## When To Use

- 项目存在多环境或多部署目标
- 需要复用配置和默认值

## Notes

- 应避免把业务分支逻辑隐式藏在配置解析中
