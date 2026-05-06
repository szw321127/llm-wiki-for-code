---
id: option-inline-config
type: option
title: 内联配置
practice: practice-config-management
base_score: 64
score_breakdown:
  consistency: 10
  efficiency: 19
  maintainability: 12
  extensibility: 9
  risk: 14
tech: [literal, local-const]
constraints: []
alternatives: [option-centralized-config]
recommended: false
status: active
---

## Summary

将参数、开关和默认值直接写在业务模块内，不经过统一配置入口。

## Advantages

- 改动快
- 很小的脚本可以少写一层封装

## Risks

- 配置来源不透明
- 环境差异和默认值容易失控

## When To Use

- 一次性脚本或非常短生命周期的实验代码

## Notes

- 随着模块增多，通常需要迁移到集中配置入口
