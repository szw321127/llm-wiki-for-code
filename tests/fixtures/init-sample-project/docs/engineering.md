# 工程约定

## 调用约定

- 前端请求默认走 `src/api/client.ts`
- 页面层不要直接内联公共鉴权逻辑

## 配置约定

- 统一通过 `src/config/env.ts` 读取配置
