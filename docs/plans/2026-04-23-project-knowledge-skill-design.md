# 项目服务型知识库 Skill 设计

**日期**: 2026-04-23  
**范围**: 把当前“通用实践知识图谱 MVP”重定义为一个为当前项目服务的 skill，并以 `.project-knowledge/` 作为项目内知识事实源。  
**非目标**: 不做自动学习评分、不做联网分析、不读 `git log`、不自动修改业务代码、不实现复杂图数据库或多平台完整适配矩阵。

---

## 1. 背景

当前实现更接近一个独立的通用知识图谱原型，具备：

- 结构化 Markdown 事实源
- 图谱数据生成脚本
- 静态交互式图谱阅读页
- 通用 `practice / option / context / constraint / rule / project_profile` 模型

但用户真实目标并不是“独立知识站”，而是“为某个项目持续服务的 skill”：

- 需要一个 `skill`
- 至少包含一个 `/pk-init` 命令
- `/pk-init` 要分析当前项目并构建知识库
- 每次对话结束后，需要判断是否形成稳定知识，并在必要时沉淀到项目知识库中

因此，当前仓库应从“产品本体是图谱页”转向“产品本体是项目知识工作流 skill，图谱页只是阅读层”。

---

## 2. 核心目标

新的产品形态应满足以下目标：

- 为“当前项目”服务，而不是抽象服务于所有项目
- 通过 `/pk-init` 对当前项目做本地分析，生成首版知识库
- 把项目知识库存放在项目根目录下 `.project-knowledge/`
- 保持结构化 Markdown 为唯一事实源
- 每轮对话结束后执行一次轻量结晶判断
- 新知识可以直接入库，但先进入低分孵化区
- 图谱继续作为主阅读入口，但只作为 `.project-knowledge/` 的阅读层

---

## 3. 总体架构

最终系统分成两层：

### 3.1 Skill 层

`project-knowledge-skill` 是能力包，负责：

- 工作流约束
- 命令约定
- 项目扫描
- 结晶沉淀
- 图谱构建
- 模板与种子知识

### 3.2 Project Knowledge 层

每个项目根目录下的 `.project-knowledge/` 是当前项目自己的知识仓库，负责：

- 当前项目画像
- 当前项目沉淀出的知识节点
- 每轮对话的 session 记录
- 使用统计与运行态 state
- 当前项目图谱派生产物

边界必须固定：

- `skill` 不保存某个项目的事实
- `.project-knowledge/` 不保存 skill 的实现逻辑

---

## 4. `.project-knowledge/` 目录模型

项目内知识库建议固定为：

```text
.project-knowledge/
├── README.md
├── project-profile.md
├── overview.md
├── workflow.md
├── scoring.md
├── practices/
├── options/
├── contexts/
├── constraints/
├── rules/
├── incubating/
│   ├── practices/
│   ├── options/
│   ├── rules/
│   └── constraints/
├── sessions/
├── graph/
├── state/
└── templates/
```

其中：

- 正式知识放在正式目录
- 新沉淀但未稳定的知识进入 `incubating/`
- `sessions/` 记录每轮任务结晶
- `graph/` 保存派生产物
- `state/` 保存使用统计和运行态

---

## 5. 命令模型

MVP 只保留 4 个命令：

- `/pk-init`
- `/pk-status`
- `/pk-graph`
- `/pk-crystallize`

### 5.1 `/pk-init`

职责：

- 扫描当前项目本地代码与文档
- 创建 `.project-knowledge/`
- 生成项目画像、首批正式知识和孵化知识
- 生成首版图谱数据和阅读页

### 5.2 `/pk-status`

职责：

- 汇总当前项目知识库状态
- 展示正式区 / 孵化区 / 最近 session / 图谱状态

### 5.3 `/pk-graph`

职责：

- 从 `.project-knowledge/**/*.md` 重建图谱数据与静态阅读页

### 5.4 `/pk-crystallize`

职责：

- 把最近一轮或最近几轮对话结晶为 session 和知识节点

---

## 6. `/pk-init` 扫描边界与首版知识生成

`/pk-init` 只看本地代码与本地文档，不读历史提交，不联网。

### 6.1 扫描范围

优先读取高信号文件和目录：

- `package.json`
- 锁文件
- `tsconfig.json` / `jsconfig.json`
- 构建配置
- `Dockerfile`
- `.env.example`
- `README*`
- `docs/**`
- `scripts/**`
- 常见代码目录，如 `src/`、`server/`、`api/`、`services/`

### 6.2 提炼主题

MVP 只识别少量高价值主题：

- 请求调用
- 错误处理
- 配置管理
- 日志记录
- 重试机制
- 任务状态反馈

### 6.3 正式区 / 孵化区分流

满足以下条件的高置信结论可以直接进入正式区：

- 有明确文档说明
- 有稳定目录或集中模块承载
- 在多个文件中重复出现
- 边界和命名足够清晰

只有弱证据、局部落地或仍在演进中的结论，进入 `incubating/`。

---

## 7. 每轮对话后的结晶机制

每轮对话结束后，系统都做一次“结晶判断”，而不是每轮都强制写知识。

### 7.1 固定流程

1. 总是生成一条 `session`
2. 判断是否形成稳定知识
3. 没有稳定知识时，只保留 session
4. 有稳定知识时，新增或更新知识节点
5. 默认新知识先进孵化区
6. 只有知识或采用状态变化时才刷新图谱

### 7.2 稳定知识判定

MVP 采用保守规则：

- 能被命名成稳定主题
- 有本地代码或文档证据
- 不是一次性实现细节
- 后续类似任务中大概率仍成立

### 7.3 低分孵化区

用户要求新知识“先打到低分区，后续通过分数和运用次数来提升排名”。

因此：

- 新沉淀知识默认进入 `incubating/`
- 初始分数较低
- 默认不占据主推荐位
- 后续可通过人工调分和 `adopted_count` 提升

---

## 8. 最小数据模型

### 8.1 统一节点 schema

正式节点和孵化节点使用同一套 frontmatter，只通过目录位置和 `maturity` 区分阶段。

共用基础字段：

```yaml
id:
type:
title:
summary:
keywords: []
status: active
maturity: incubating | stable
source_evidence: []
session_refs: []
```

### 8.2 关键对象

- `practice`
- `option`
- `context`
- `constraint`
- `rule`
- `project_profile`
- `session`

### 8.3 使用统计

使用统计不写入正文，放在：

```text
.project-knowledge/state/usage-index.json
```

MVP 最小字段：

- `session_mentions`
- `adopted_count`
- `last_used_at`
- `last_session_id`

排序策略：

```text
项目分数优先 + adopted_count 辅助
```

---

## 9. 图谱阅读层定位

图谱仍然保留，但定位调整为“当前项目知识库的主阅读入口”，不再是产品本体。

### 9.1 默认首屏

默认只展示：

- 稳定 `practice`
- 每个 `practice` 当前推荐的稳定 `option`

### 9.2 孵化知识

孵化知识默认不抢主视图，但用户可通过开关显式显示。

### 9.3 Session

`session` 不进入主图谱，只在详情区作为证据和演进来源显示。

### 9.4 详情抽屉

详情应展示：

- 节点身份
- 推荐与评分
- 采用与证据
- 关系与正文

---

## 10. Skill 包结构

Skill 本体建议组织为：

```text
project-knowledge-skill/
├── SKILL.md
├── scripts/
├── templates/
├── seed/
├── assets/
├── tests/
└── platforms/
```

其中：

- `scripts/` 放工作流脚本
- `templates/` 放项目知识模板
- `seed/` 放通用实践种子，只用于冷启动
- `assets/` 放图谱阅读层模板
- `tests/` 放 skill 逻辑与 fixture 测试

当前仓库已有的通用知识图谱资产应当被重定义为：

- `seed/` 的基础实践种子
- `assets/` 的图谱阅读层模板

而不再作为最终产品本体。

---

## 11. 自动工作流

### 11.1 会话开始

若检测到 `.project-knowledge/`，则只读取最小项目摘要：

- `project-profile.md`
- `overview.md`
- 最近 session
- `usage-index.json`
- `graph-index.json`

若未检测到，则只提示可以执行 `/pk-init`。

### 11.2 会话结束

在输出最终答复前执行一次轻量结晶判断。

允许的结果只有 4 种：

- `no-op`
- `session-only`
- `session + incubating`
- `session + stable-update`

### 11.3 图谱刷新

仅在知识节点或采用状态变化时刷新图谱，不因普通对话或纯 session 记录而频繁重建。

---

## 12. 迁移策略

从当前原型迁移到项目服务型 skill 时，建议分三步：

1. 保留现有图谱构建与阅读层能力
2. 把通用知识内容降级为 `seed/`
3. 以 `.project-knowledge/` 为中心重写 `/pk-init`、`/pk-status`、`/pk-graph`、`/pk-crystallize`

这样可以最大化复用已有成果，同时修正产品方向偏差。

---

## 13. 最终结论

新的正确产品定义不是“通用实践知识图谱网站”，而是：

> 一个为当前项目服务的知识沉淀与阅读 skill。

其中：

- `skill` 负责流程和能力
- `.project-knowledge/` 负责项目事实
- 图谱负责阅读
- 每轮对话负责持续结晶

这才符合“围绕当前项目持续生长”的初衷。

