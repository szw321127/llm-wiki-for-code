# Project Graph Canvas Focus Filter Design

## Goal

把项目知识图谱页面进一步收缩为“画布 + 右侧详情”双栏结构，并把筛选行为收回到图谱画布内部，用节点点击完成焦点筛选，保留搜索作为唯一常驻显式筛选入口。

## Scope Guard

本轮只做以下范围：

- 移除整个顶部 `topbar` 区域，而不是只移除 `project-summary-strip`
- 保留 `交互式图谱画布` 与右侧统一单列详情面板
- 将搜索框移动到画布标题右侧
- 移除所有顶部筛选 UI 与对应交互：
  - `project-view`
  - `context-filter`
  - `constraint-filter`
  - `type-filters`
  - `incubating-toggle`
  - `adopted-toggle`
  - `reset-filters`
  - `filter-toggle`
  - 可展开筛选面板逻辑
- 用“点击节点聚焦筛选 / 点击空白画布清除聚焦”替代顶部筛选

明确不做：

- 多节点组合筛选
- 二阶展开
- 新的悬浮菜单、覆盖层或额外工具栏
- URL 状态同步
- 图数据模型改动

## Layout Design

### 页面结构

- 页面主体只保留一个 `main-grid`
- 左侧为图谱面板，右侧为详情面板
- 图谱面板头部保留两组信息：
  - 左侧：标题 `交互式图谱画布` 与简短摘要文案
  - 右侧：搜索框、图例、节点计数

### 搜索位置

- 搜索框放在 `交互式图谱画布` 标题右侧，同属画布头部
- 搜索是页面唯一保留的显式筛选输入
- 不再出现独立的顶部控制区

### 详情面板

- 延续上一轮已经统一的单列信息面板
- 不新增新的视觉层级，只保留统一 section block 结构

## Interaction Model

### 默认画布快照

默认画布只展示：

- `project_profile`
- 所有 `practice`
- 每个 `practice` 当前视角下的推荐 `option`

这是默认阅读路径，不再提供顶层类型/成熟度/场景/约束开关。

### 焦点筛选

点击任一节点时：

- 设置 `focusedNodeId`
- 同时设置 `selectedNodeId`
- 画布仅保留焦点节点与一阶邻居

补充规则：

- 聚焦 `option` 时，必须保留其所属 `practice`，即使该关系不是最显眼的主链路也不能丢
- 聚焦 `project_profile` 时，必须保留与项目画像直接关联的项目级链接节点

### 清除聚焦

点击空白画布时：

- 清空 `focusedNodeId`
- 恢复默认画布快照
- 不清空 `selectedNodeId`
- 右侧详情继续显示上一次选中的节点内容

### 搜索规则

- 无聚焦时：搜索作用于默认快照
- 有聚焦时：搜索只作用于当前聚焦子图
- 搜索不会额外引入默认快照之外的新节点

## State Model

保留：

- `query`
- `selectedNodeId`

新增或显式确立：

- `focusedNodeId`

职责分离：

- `focusedNodeId` 决定画布当前显示子图
- `selectedNodeId` 决定右侧详情内容

交互规则：

- 点击画布节点：`focusedNodeId = node.id`，`selectedNodeId = node.id`
- 点击详情中的关联节点按钮：行为与点击画布节点一致
- 点击空白画布：`focusedNodeId = null`，`selectedNodeId` 不变

## Rendering Rules

### 画布摘要文案

- 默认态说明默认阅读路径：项目画像、实践、推荐方案
- 聚焦态说明当前为节点邻域阅读，并提示点击空白区域可恢复默认视图

### 空状态

- 当默认快照或聚焦子图再叠加搜索后没有匹配节点时，画布显示空状态
- 详情面板不因为空状态而自动清空

## Testing Strategy

### Shell Structure Tests

覆盖以下结构断言：

- 不再存在 `topbar`
- 搜索框位于 `graph-panel-head` 内
- 不再存在顶部筛选控件与相关 DOM id
- 详情面板仍保持统一单列结构

### Runtime Snapshot Tests

覆盖以下行为断言：

- 默认快照包含 `project_profile`、所有 `practice`、各 `practice` 推荐 `option`
- 聚焦 `practice` 时只保留该节点与一阶邻居
- 聚焦 `option` 时保留该 `option` 与所属 `practice`
- 聚焦 `project_profile` 时保留项目直接关联节点
- 搜索在默认态与聚焦态下都只对当前快照生效

### Interaction Hook Tests

通过 shell 级断言锁定以下 JS 钩子：

- `focusedNodeId` 状态存在
- 空白画布点击会清空聚焦而不清空详情选择
- 节点点击与详情关联点击都会进入聚焦态

