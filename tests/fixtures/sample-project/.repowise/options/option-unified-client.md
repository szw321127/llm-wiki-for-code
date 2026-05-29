---
id: option-unified-client
type: option
title: 统一调用封装层
summary: 通过统一 client 承载调用治理逻辑。
practice: practice-http-client
base_score: 89
score_breakdown:
  consistency: 18
  efficiency: 18
  maintainability: 18
  extensibility: 18
  risk: 17
constraints: [constraint-backward-compatibility]
alternatives: [option-direct-call]
keywords: [client]
status: active
maturity: stable
source_evidence: [src/api/client.ts]
session_refs: []
---

## Summary

通过统一 client 承载调用治理逻辑。
