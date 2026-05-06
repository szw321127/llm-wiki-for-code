---
id: practice-http-client
type: practice
title: HTTP 调用封装实践
contexts: [context-frontend-crud, context-backend-api, context-automation-script]
constraints: [constraint-auditability, constraint-backward-compatibility, constraint-no-extra-runtime]
tech: [http, rest, rpc]
rules: [rule-use-unified-client]
keywords: [api, client, request, http]
status: active
---

## Summary

在存在重复鉴权、重试、日志、错误映射或观测要求时，远程调用应优先收敛到统一封装层。

## Decision

默认推荐统一调用封装；只有在生命周期极短、调用点极少且无需治理时才考虑直接调用。

## When To Use

- 前端页面需要稳定复用请求行为
- 后端服务需要对外部调用做统一治理
- 自动化脚本需要共享鉴权和错误处理逻辑

## Tradeoffs

- 统一封装提升一致性和维护性，但需要预先设计调用边界
- 直接调用启动成本低，但长期容易散落和分叉

## Evidence

- 多项目经验表明，请求封装是日志、错误和重试策略复用的最佳落点之一
