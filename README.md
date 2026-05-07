# LLM Wiki for Code

面向 Codex 与 Claude Code 的持久代码库 wiki。

LLM Wiki for Code 是一套本地代码库 wiki 和知识图谱工具。它把长期项目里的代码实践、推荐方案、任务决策、会话记录和证据关系保存到项目自己的 `.project-knowledge/` 目录中，让后续 AI 编码对话可以先查已有约定，再决定是否扫描项目代码。

[![Tests](https://img.shields.io/badge/tests-node%20test-0f766e)](#验证)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

仓库名和包名是 `llm-wiki-for-code`。助手插件保留短名 `pk`。

[英文文档](README_EN.md)

## 30 秒看懂

```bash
npm run pk:init -- <project-root>
npm run pk:preflight -- <project-root> "实现 HTTP 调用"
npm run pk:auto-crystallize -- <project-root> <auto-crystallize-input.json>
npm run pk:serve -- <project-root> 8124
```

执行后：

- `pk-init` 创建 `.project-knowledge/`，作为 Markdown 知识库。
- `pk-preflight` 在 AI 编码任务开始前返回匹配实践、推荐池和 evidence 预览。
- `pk-auto-crystallize` 在任务结束后记录 session，并推断已采纳或待孵化知识。
- `pk-serve` 打开本地图谱，查看 practice、option、rule、context、constraint、session 和 source evidence。

## 适合谁

- 在长期代码仓库中使用 Codex、Claude Code 或类似 coding agent 的开发者。
- 希望把 agent 决策沉淀为可审查项目知识，而不是留在聊天记录里的团队。
- 偏好本地 Markdown、显式 evidence 和可逆治理，而不是黑盒记忆存储的维护者。

## 为什么不只用 `AGENTS.md` 或 `CLAUDE.md`？

`AGENTS.md` 和 `CLAUDE.md` 很适合保存当前指令。LLM Wiki for Code 则是它们旁边的结构化记忆层：

| 需求 | 指令文件 | LLM Wiki for Code |
| --- | --- | --- |
| 告诉 agent 当前规则 | 支持 | 支持 |
| 记录候选实践和替代方案 | 手动维护 | 内置 |
| 把推荐方案关联到稳定源码 evidence | 手动维护 | 内置 |
| 跨 session 记录采纳历史 | 不支持 | 内置 |
| 控制推荐池大小并治理 | 不支持 | 内置 |
| 用 Obsidian vault 或图谱浏览关系 | 不支持 | 内置 |

指令文件适合保存当前操作规则。LLM Wiki for Code 适合保存会随时间演进的实践、方案、证据和决策。

## 解决的问题

长期项目里，AI 协作常见几个问题：

- 每次新对话都像第一次看项目，重复读取同一批文件。
- 同一类实现会逐渐分叉成多个不一致方案。
- 任务结束后的关键决策没有沉淀，下次无法复用。
- 知识库变大后，如果整库塞进上下文，会浪费 token。
- 临时计划、worktree 文件和生成文档容易污染长期证据。

LLM Wiki for Code 的做法是：

- 任务开始前用 `pk-preflight` 查询已有实践和推荐方案。
- 任务结束后用 `pk-auto-crystallize` 记录已采纳或待孵化知识。
- 用采纳次数、分数和治理规则维护推荐池。
- 每个实践最多保留 3 个推荐方案。
- 只返回 Top-K 实践和 evidence 预览，避免把整个知识库放进上下文。

## 核心模型

`.project-knowledge/` 是项目级知识库，也是 Markdown 事实源。图谱、索引、Obsidian 视图和浏览器图谱页面都从这些 Markdown 文件生成。

主要节点类型：

- `project_profile`：项目画像，记录技术栈、默认规则和偏好方案。
- `practice`：可复用实践，例如“HTTP 调用应统一走共享 client”。
- `option`：实践下的候选实现方案。
- `rule`：约束性规则或强偏好规则。
- `context` / `constraint`：适用场景和限制条件。
- `session`：一次任务或对话的记录。

知识生命周期：

- 新知识通常先进入 `incubating`。
- 多次被采纳后成为转正候选。
- 每个实践的推荐池最多保留 3 个方案。
- 被淘汰、打回或判定重复的方案不会被物理删除，而是退回孵化区并标记状态。

## 证据规则

`source_evidence` 应指向长期存在的项目相对路径，例如：

```text
src/api/client.ts
src/runtime/scheduler.ts
```

默认策略会过滤常见的临时文件、工具状态、生成物和过程文档；它不是写死在 README 里的完整清单。每个知识库都可以通过 `.project-knowledge/evidence-policy.json` 调整：

```json
{
  "useDefaultIgnores": true,
  "ignoredPrefixes": ["generated/"],
  "ignoredBasenames": ["local-note.md"],
  "allowedPrefixes": ["docs/adr/"],
  "allowAbsolutePaths": false
}
```

字段含义：

- `useDefaultIgnores`：是否启用内置默认过滤规则。
- `ignoredPrefixes`：追加按路径前缀过滤的目录或文件。
- `ignoredBasenames`：追加按文件名过滤的临时文件。
- `allowedPrefixes`：从默认过滤规则中放行稳定子路径，例如 `docs/adr/`。
- `allowAbsolutePaths`：默认禁止绝对路径，避免把本机路径写进项目知识。

这些规则会同时影响 `pk-preflight` 的 evidence 预览、`pk-auto-crystallize` 的 touched files、`pk-crystallize` 写入的 `source_evidence`，以及 `pk-lint` 的 volatile evidence 检查。

项目不把完整代码片段作为主证据保存。推荐的证据形态是：

- 稳定源码相对路径
- 实践摘要
- 方案摘要
- 采纳次数
- 必要时扩展 symbol、hash 或短摘要等元数据

## 环境要求

- 支持原生 ESM 的 Node.js。
- 用于运行脚本的 npm。
- 只有在需要把 `pk` 技能安装进 Codex 或 Claude Code 时，才需要对应 AI 编程助手。

当前仓库主要依赖 Node 内置 test runner 和本地脚本。

## 安装

### 1. 克隆仓库

```bash
git clone <repository-url>
cd <repository-directory>
```

运行测试确认本地环境可用：

```bash
npm test
```

### 2. 作为普通 CLI 使用

不安装任何助手插件，也可以直接通过 npm 脚本使用：

```bash
npm run pk:init -- <project-root>
npm run pk:preflight -- <project-root> "实现 HTTP 调用"
npm run pk:auto-crystallize -- <project-root> <auto-crystallize-input.json>
```

这种方式适合手动执行、CI 或其它自动化流程。

### 3. 安装到 Codex

如果希望在 Codex 对话中直接使用 `pk:*` 技能：

```bash
npm run codex:install
```

安装脚本会：

- 从当前仓库的 `plugins/pk/` 创建本地插件链接。
- 在用户目录的 `.agents/plugins/marketplace.json` 写入 `local-project-knowledge` marketplace 条目。
- 将插件策略标记为 `INSTALLED_BY_DEFAULT`。

安装后需要完全重启 Codex。重启后技能列表中应该能看到：

```text
pk-init
pk-preflight
pk-status
pk-graph
pk-crystallize
pk-auto-crystallize
pk-lint
pk-govern
pk-serve
```

升级当前仓库后，重新执行安装命令并完全重启 Codex。本地安装可能会让 `~/plugins/pk` 指向当前仓库，但运行中的客户端仍可能使用启动时读取的 plugin 缓存：

```bash
npm run codex:install
```

卸载：

```bash
npm run codex:uninstall
```

### 4. 安装到 Claude Code

使用 Claude Code 的标准插件命令：

```bash
/plugin marketplace add <repository-root>
/plugin install pk@local-project-knowledge
```

例如：

```bash
/plugin marketplace add /path/to/universal-practice-knowledge-graph
/plugin install pk@local-project-knowledge
```

这会注册 `local-project-knowledge` marketplace，并从 `plugins/pk/` 安装 `pk` 插件。

安装后需要完全重启 Claude Code。重启后技能列表中应该能看到：

```text
pk-init
pk-preflight
pk-status
pk-graph
pk-crystallize
pk-auto-crystallize
pk-lint
pk-govern
pk-serve
```

修改或拉取当前仓库后，更新这个插件并完全重启 Claude Code。Claude Code 会把插件复制到 `.claude/plugins/cache/...`，所以已经安装的插件不会自动反映仓库里的新改动：

```bash
/plugin update pk@local-project-knowledge
```

卸载：

```bash
/plugin uninstall pk@local-project-knowledge
```

### 5. 初始化目标项目

安装或克隆工具后，还需要让目标项目进入知识库流程：

```bash
npm run pk:init -- <project-root>
```

或者在 Codex 中使用：

```text
pk-init
```

初始化后，目标项目根目录会出现 `.project-knowledge/`。没有这个目录的项目会返回 `mode: no-knowledge`，并跳过项目知识流程。

## 快速开始

```bash
npm test
npm run pk:init -- <project-root>
npm run pk:status -- <project-root>
npm run pk:preflight -- <project-root> "实现 HTTP 调用"
npm run pk:auto-crystallize -- <project-root> <auto-crystallize-input.json>
npm run pk:lint -- <project-root>
npm run pk:govern -- <project-root>
npm run pk:graph -- <project-root>
npm run pk:serve -- <project-root> 8124
```

如果不传 `<project-root>`，脚本会使用当前工作目录。

## 技能入口

仓库同时内置 Codex 插件和 Claude Code 插件。

Codex 技能名：

```text
pk-init
pk-preflight
pk-status
pk-graph
pk-crystallize
pk-auto-crystallize
pk-lint
pk-govern
pk-serve
```

Claude Code 技能名：

```text
pk-init
pk-preflight
pk-status
pk-graph
pk-crystallize
pk-auto-crystallize
pk-lint
pk-govern
pk-serve
```

## 常用流程

### 初始化知识库

```bash
npm run pk:init -- <project-root>
```

会在目标项目中创建 `.project-knowledge/`，包括：

- `project-profile.md`
- `practices/`
- `options/`
- `rules/`
- `contexts/`
- `constraints/`
- `incubating/`
- `sessions/`
- `state/`
- `graph/`
- `_views/`
- `.obsidian/`
- `open-graph.cmd`

如果项目没有初始化，`pk:preflight` 和 `pk:auto-crystallize` 会返回 `mode: no-knowledge`，不会扫描代码，也不会创建知识库。

### 查看当前状态

```bash
npm run pk:status -- <project-root>
```

状态报告会汇总当前 `.project-knowledge/` 的节点数量和健康信号。

### 任务开始前预检

```bash
npm run pk:preflight -- <project-root> "实现 HTTP 调用"
```

预检会优先读取 `.project-knowledge/`：

- 命中已有实践时返回 `mode: knowledge-hit`。
- 项目已初始化但知识不足时返回 `mode: needs-project-scan`。
- 项目未初始化时返回 `mode: no-knowledge`。

为了控制上下文大小，默认只返回：

- Top 5 practices
- 每个节点最多 5 条 evidence 预览
- 每类扫描 hint 最多 5 条

### 任务结束后自动沉淀

```bash
npm run pk:auto-crystallize -- <project-root> <auto-crystallize-input.json>
```

输入示例：

```json
{
  "sessionId": "session-YYYY-MM-DD-topic",
  "title": "本轮任务标题",
  "topic": "本轮任务主题",
  "taskText": "本轮任务描述",
  "decisionSummary": "一句话总结本轮关键决策。",
  "touchedFiles": ["src/example.ts"]
}
```

行为：

- 命中已有实践时，自动记录推荐方案被采纳。
- 未命中且存在有效源码变更时，可能生成孵化中的 practice 和 option。
- 只有临时文件、文档或 worktree 变更时，只记录 session。
- 显式传入 `adoptedNodeIds`、`incubatingNodes` 或 `stableUpdates` 时，优先使用显式输入。

### 手动结晶

```bash
npm run pk:crystallize -- <project-root> <crystallize-input.json>
```

当你已经明确知道要采纳哪个节点、创建哪个候选节点或更新哪条稳定知识时，使用手动结晶。

模板位于：

```text
templates/crystallize-input-template.json
templates/auto-crystallize-input-template.json
```

### 检查知识库健康

```bash
npm run pk:lint -- <project-root>
```

lint 会报告：

- `node-missing-evidence`：节点缺少证据。
- `node-volatile-evidence`：节点引用了临时或不稳定 evidence。
- `option-missing-practice`：方案没有有效实践归属。
- `practice-empty-recommendation-pool`：实践没有可推荐方案。
- `incubating-promotion-candidate`：孵化节点达到转正阈值。
- `recommendation-pool-eviction-candidate`：推荐池超过 3 个方案。
- `possible-duplicate-node`：疑似重复知识节点。

### 执行可逆治理

```bash
npm run pk:govern -- <project-root>
```

治理只做可逆操作：

- 提升达到条件的孵化节点。
- 将推荐池 Top 3 之外的方案退回孵化区。
- 将强重复节点标记为 rejected 并移入孵化区。
- 不会物理删除知识文件。

### 构建或查看图谱

```bash
npm run pk:graph -- <project-root>
npm run pk:serve -- <project-root> 8124
```

在 Windows 上，初始化后的项目也可以运行：

```text
.project-knowledge/open-graph.cmd
```

图谱页支持：

- 查看 practice、option、rule、context、constraint 之间的关系。
- 查看推荐池和 evidence。
- 从图谱界面打回不合适的孵化节点。

## Obsidian 兼容

`.project-knowledge/` 可以直接作为 Obsidian vault 打开。系统会维护：

- `index.md`：知识库入口。
- `log.md`：操作日志。
- `_views/practices.md`：按实践聚合推荐池。
- `_views/incubating.md`：孵化知识入口。
- `_views/sessions.md`：会话记录入口。
- `.obsidian/app.json`
- `.obsidian/graph.json`

知识节点会生成 `Links` 区，使用 `[[node-id]]` 连接相关 practice、option、rule、context 和 constraint。

## 仓库结构

```text
.
|-- .agents/                       # Codex 本地 marketplace 元数据
|-- .github/                       # GitHub issue 和 PR 模板
|-- .claude-plugin/                # Claude Code marketplace 元数据
|-- assets/                        # 项目图谱前端资产
|-- docs/                          # 设计和实现计划
|-- knowledge/                     # 通用图谱原型和回归验证资产
|-- plugins/pk/                    # Codex 和 Claude Code 插件包
|   |-- .codex-plugin/             # Codex plugin 配置
|   |-- .claude-plugin/            # Claude Code plugin 配置
|   |-- assets/                    # 插件图谱资产
|   |-- scripts/                   # 插件命令包装和共享脚本
|   `-- skills/                    # 技能定义
|-- scripts/                       # npm 脚本实现
|-- seed/                          # 初始化基线知识
|-- templates/                     # Markdown 和 JSON 模板
|-- tests/                         # Node 测试套件
|-- CONTRIBUTING.md                # 贡献指南
|-- README.md                      # 中文文档
`-- README_EN.md                   # 英文文档
```

## 验证

运行完整测试：

```bash
npm test
```

当前测试覆盖初始化、预检上下文预算、结晶、自动结晶、证据过滤、推荐池治理、Obsidian 输出、图谱生成、图谱运行时行为、插件命令外壳，以及 Codex 本地插件安装。

发布前建议执行：

```bash
npm test
```
