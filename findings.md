# 发现记录

## 2026-04-22

- 参考设计已明确知识模型、目录结构、评分公式、首屏展示策略和 MVP 数量要求。
- 第二份参考文档已经给出了可执行的实现任务顺序，可直接映射到当前独立目录。
- 为避免和某个业务项目强绑定，项目画像会实现为：
  - `project-global`
  - `project-example-enterprise-web`
- 需要时可在说明文档中解释：参考文档里的项目专属画像在独立版 MVP 中被替换成通用示例画像。
- 图谱页由于需要 `fetch` JSON，实际预览方式必须使用本地静态服务器；因此补充了 `serve-knowledge.mjs` 作为最小合理调整。

## 2026-04-22 交互式图谱补充调研

- 外部参考图谱不是列表式关系板，而是 D3 驱动的交互式画布。
- 关键形态包括：
  - SVG 画布
  - force simulation
  - 缩放/拖拽/平移
  - 搜索联动
  - 节点详情抽屉
  - 邻居区和 insights 区
  - minimap
  - community/cluster 视觉分组
- 参考实现通过 `build-graph-html.sh` 把 `graph-data.json` 内嵌进 `<script id="graph-data" type="application/json">`，因此支持离线双击 HTML。
- 用户这次反馈的关键不是“样式像”，而是“交互式知识图谱像”。
- 用户已明确选择最低必要改造层级：`MVP 交互画布`，不追求一步到位复刻参考实现的全部高级能力。

## 2026-04-28 自动结晶补充

- 当前 Codex skill 机制不能在没有任何入口调用的情况下强制每轮任务自动运行，但可以提供任务结束后的优先入口，并在插件默认提示中要求使用。
- `pk:auto-crystallize` 复用现有 `pk:preflight` 和 `pk:crystallize`，避免形成第二套知识写入路径。
- 自动推断策略保持保守：命中已有 practice 时只记录推荐 option 的 adopted；未命中且有 touched files 时才生成孵化 practice + candidate option。
