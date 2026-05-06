---
id: option-direct-call
type: option
title: 直接原生调用
practice: practice-http-client
base_score: 68
score_breakdown:
  consistency: 11
  efficiency: 18
  maintainability: 12
  extensibility: 10
  risk: 17
tech: [fetch, axios, requests]
constraints: []
alternatives: [option-unified-client]
recommended: false
status: active
---

## Summary

每个模块直接使用语言或库提供的原生调用能力，不额外建设统一封装层。

## Advantages

- 启动快
- 局部实验成本低

## Risks

- 易导致鉴权、日志和错误处理分叉
- 后续统一治理成本高

## When To Use

- 一次性脚本
- 生命周期极短且调用面极小的场景

## Notes

- 不适合作为长期默认方案
