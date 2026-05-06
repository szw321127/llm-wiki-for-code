---
id: practice-config-management
type: practice
title: 配置管理实践
contexts: [context-frontend-crud, context-backend-api, context-automation-script, context-engineering-workflow]
constraints: [constraint-auditability, constraint-no-extra-runtime]
tech: [config, environment, deployment]
rules: [rule-centralized-config-default]
keywords: [config, environment, secrets, defaults]
status: active
---

## Summary

配置应有清晰的集中入口、命名规则和优先级，不应依赖多处内联常量拼接出运行行为。

## Decision

默认推荐集中配置管理；只在真正一次性、无复用的局部逻辑中接受内联配置。

## When To Use

- 项目存在多环境、多部署目标
- 脚本需要复用参数和默认值
- 工程流程需要追踪配置来源

## Tradeoffs

- 集中配置更利于治理和审计，但需要统一约定命名和覆盖顺序
- 内联配置改动快，但容易让真实运行参数失去可见性

## Evidence

- 随着环境和模块增多，配置入口不集中通常会成为稳定性和审计的隐患
