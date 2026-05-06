---
id: project-example-enterprise-web
type: project_profile
title: 示例企业 Web 项目
tech: [typescript, vue, node, rest, ci]
adopted_rules:
  - rule-use-unified-client
  - rule-shared-status-first
  - rule-structured-log-first
  - rule-centralized-config-default
preferred_options:
  option-unified-client: 10
  option-direct-call: -12
  option-shared-status-layer: 8
  option-local-status-handling: -8
  option-centralized-error-handler: 10
  option-inline-error-handler: -6
  option-structured-logging: 12
  option-plain-logging: -10
  option-exponential-backoff: 4
  option-no-retry: -6
  option-centralized-config: 9
  option-inline-config: -10
keywords: [enterprise, web, governance]
status: active
---

## Summary

用于演示典型企业 Web 项目如何在通用知识上叠加自己的治理偏好，而不污染核心知识模型。

## Recommended Defaults

- 倾向统一调用封装、共享状态层、结构化日志和集中配置
- 对直接调用、纯文本日志和内联配置做负向调整

## Constraints

- 同时需要顾及前端交互体验、后端稳定性和工程治理可审计性
