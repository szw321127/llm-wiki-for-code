# 通用实践知识图谱

该目录承载一个自包含的工程实践知识系统，适用于前端、后端、脚本和工程规范类项目。

## 设计边界

- 图谱是主阅读入口
- 结构化 Markdown 是唯一事实源
- 基础评分人工维护，项目服务层可叠加使用统计
- 默认人工公式为 `base_score + project_adjustment = final_score`
- 项目差异通过 `ProjectProfile` 表达，不把某个业务仓库规则硬编码进核心模型

## 目录说明

- `practices/`：工程决策主题
- `options/`：某个实践下的候选方案
- `contexts/`：适用场景
- `constraints/`：硬约束
- `rules/`：组织或项目规则
- `projects/`：项目画像
- `templates/`：新文档模板
- `graph/`：生成后的图谱数据与静态阅读页
- `tools/`：本地生成脚本
- `tests/`：最小验证测试

## 使用顺序

1. 在对应目录新增或修改结构化 Markdown
2. 运行 `node knowledge/tools/build-graph-data.mjs`
3. 运行 `npm test`
4. 运行 `node knowledge/tools/serve-knowledge.mjs 8123`
5. 打开 `http://127.0.0.1:8123/knowledge/graph/knowledge-graph.html`

## 预览说明

- 图谱页会通过 `fetch` 读取 `graph-data.json`
- 图谱页是交互式 SVG 画布，当前阅读层采用“展示型信息画布”表达
- 节点类型采用混合语法：
  - `Practice / Option` 为主卡片
  - `Context / Constraint / Rule / ProjectProfile` 为徽章型节点
- 详情抽屉采用“展陈区 + 结构区”，先解释节点身份，再展示评分、关系和正文
- 页面支持节点点击、邻居高亮、节点拖拽、画布平移、滚轮缩放、搜索和项目视角切换
- 直接双击 `knowledge-graph.html` 时，浏览器通常会拦截本地 `file://` JSON 读取
- 因此建议始终通过本地静态服务器预览；MVP 已内置 `knowledge/tools/serve-knowledge.mjs`

## 非目标

- 不依赖任何框架路由
- 不依赖某个业务仓库构建体系
- 不引入模型自动学习评分；项目服务层只使用 `adopted_count` 做有限加权
- 不在 MVP 中引入复杂图数据库或可视化引擎
