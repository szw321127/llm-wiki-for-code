# 知识维护工作流

## 新增或调整知识

1. 选择合适的知识类型：`practice`、`option`、`context`、`constraint`、`rule`、`project_profile`
2. 从 `templates/` 复制模板，补齐 frontmatter 和正文
3. 确保所有关系字段都引用稳定 `id`
4. 对 `option` 维护完整的 `score_breakdown` 和 `base_score`
5. 对 `project_profile` 维护 `preferred_options`

## 更新图谱

运行：

```bash
node knowledge/tools/build-graph-data.mjs
```

生成结果：

- `knowledge/graph/graph-data.json`
- `knowledge/graph/graph-index.json`

## 验证

运行：

```bash
npm test
```

最小测试覆盖：

- frontmatter 解析
- 节点构建
- 边构建
- `final_score` 计算
- 交互页壳子结构
- 图谱运行时快照逻辑
- 本地预览服务器的模块脚本 MIME 类型

## 阅读方式

- 默认首屏只显示 `Practice + 推荐 Option`
- 切换项目视角后按 `final_score` 展示推荐
- 画布支持拖拽节点、滚轮缩放、拖动画布平移和邻居高亮
- 阅读层按“展示型信息画布”组织：
  - 顶部为轻量控制带
  - 中部为主图谱画布
  - 右侧为“展陈区 + 结构区”详情抽屉
- 深入细节时再从详情面板跳回原始 Markdown
- 建议使用本地静态服务器预览：

```bash
node knowledge/tools/serve-knowledge.mjs 8123
```

- 访问 `http://127.0.0.1:8123/knowledge/graph/knowledge-graph.html`
