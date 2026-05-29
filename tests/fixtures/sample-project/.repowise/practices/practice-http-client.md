---
id: practice-http-client
type: practice
title: HTTP 调用封装实践
summary: 当前项目中的远程调用应优先通过统一封装层收敛。
contexts: [context-frontend-page]
constraints: [constraint-backward-compatibility]
rules: [rule-use-unified-client]
option_ids: [option-unified-client, option-direct-call]
keywords: [http, request]
status: active
maturity: stable
source_evidence: [src/api/client.ts, docs/engineering.md]
session_refs: []
---

## Summary

当前项目中的远程调用应优先通过统一封装层收敛。
