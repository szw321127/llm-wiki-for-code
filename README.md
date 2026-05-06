# Project Knowledge

Project Knowledge 是一套面向 Codex 与 Claude Code 的项目知识沉淀工具。它把长期项目里的代码实践、推荐方案、会话结论和证据关系保存到项目自己的 `.project-knowledge/` 目录中，让后续对话可以先查已有实践，再决定是否扫描项目代码。

它的目标不是替代代码仓库，也不是保存完整代码片段，而是让 AI 在多轮任务中逐步形成“这个项目通常怎么做”的可检索知识库。

## 解决的问题

长期项目里，AI 协作常见几个问题：

- 每次对话都像第一次看项目，重复翻同一批代码。
- 同一类场景会出现多个实现，缺少稳定推荐。
- 任务结束后的决策没有沉淀，下次无法复用。
- 知识库越来越大后，直接塞进上下文会浪费 token。
- 临时计划文件、worktree 文件和会被删除的文档容易污染长期证据。

Project Knowledge 的做法是：

- 任务开始前用 `pk:pk-preflight` 查已有实践和推荐方案。
- 任务结束后用 `pk:pk-auto-crystallize` 自动记录采纳和孵化知识。
- 用采纳次数、分数和治理规则维护推荐池。
- 每个实践最多保留 3 个推荐方案，其余退回孵化或等待处理。
- 只返回 Top-K 实践和 evidence 预览，避免把整个知识库放进上下文。

## 核心模型

`.project-knowledge/` 是项目级知识库，也是 Markdown 事实源。图谱、索引、Obsidian 视图都是从这些 Markdown 文件生成出来的。

主要节点类型：

- `project_profile`：项目画像，记录技术栈、默认规则和偏好方案。
- `practice`：可复用实践，例如“HTTP 调用应统一封装”。
- `option`：实践下的候选方案，例如“统一 client”或“直接调用”。
- `rule`：约束性规则。
- `context` / `constraint`：适用场景和限制条件。
- `session`：一次任务的历史记录。

知识生命周期：

- 新知识默认进入 `incubating`。
- 多次被采纳后成为转正候选。
- 推荐池最多保留 3 个方案。
- 被淘汰或人工打回的方案不会直接删除，会退回孵化区并标记状态。

## 证据规则

`source_evidence` 只应该指向长期存在的项目源码相对路径，例如：

```text
src/api/client.ts
src/runtime/scheduler.ts
```

这些路径不会作为长期证据：

- `.worktrees/`
- `.project-knowledge/`
- `.agents/`
- `.codex/`
- `node_modules/`
- `docs/`
- `task_plan.md`
- `findings.md`
- `progress.md`

原因是这些内容经常是临时计划、协作过程文件、生成物或后续可能被清理的文档。它们可以帮助当前对话理解上下文，但不能支撑长期推荐实践。

项目也不保存完整代码片段作为主证据。推荐的证据形态是：

- 稳定源码相对路径
- 实践摘要
- 方案摘要
- 采纳次数
- 必要时由后续版本扩展 symbol、hash 或短摘要

## 安装

### 1. 获取仓库并安装依赖

```bash
git clone <repository-url>
cd <repository-directory>
```

安装后可以先运行测试确认环境可用：

```bash
npm test
```

### 2. 作为普通 CLI 使用

不安装 Codex plugin 也可以直接通过 npm 脚本使用：

```bash
npm run pk:init -- <project-root>
npm run pk:preflight -- <project-root> "实现 HTTP 调用"
npm run pk:auto-crystallize -- <project-root> <auto-crystallize-input.json>
```

这种方式适合手动执行脚本，或者在其它自动化流程里调用。

### 3. 安装为 Codex 技能包

如果希望在 Codex 对话中直接使用 `pk:*` 技能，执行：

```bash
npm run codex:install
```

该命令会：

- 在 `~/plugins/pk` 创建指向当前仓库 `plugins/pk/` 的本地插件链接。
- 在 `~/.agents/plugins/marketplace.json` 写入 `pk` marketplace 条目。
- 使用 `INSTALLED_BY_DEFAULT`，让 Codex 启动时自动发现技能包。

安装后需要完全重启 Codex。重启后在技能列表中应该能看到：

```text
pk:pk-init
pk:pk-preflight
pk:pk-status
pk:pk-graph
pk:pk-crystallize
pk:pk-auto-crystallize
pk:pk-lint
pk:pk-govern
pk:pk-serve
```

升级当前仓库后，可以重新执行：

```bash
npm run codex:install
```

卸载：

```bash
npm run codex:uninstall
```

### 4. 安装为 Claude Code 插件

在 Claude Code 对话中直接使用 pk 技能：

```bash
/plugin marketplace add <repository-root>
/plugin install pk@local-project-knowledge
```

例如：

```bash
/plugin marketplace add /path/to/llm-wiki-for-code
/plugin install pk@local-project-knowledge
```

该命令会：

- 注册 `local-project-knowledge` marketplace。
- 从 marketplace 安装 `pk` 插件。
- 在 `~/.claude/plugins/installed_plugins.json` 注册 pk 插件。
- 在 `~/.claude/settings.json` 的 `enabledPlugins` 中启用 pk 插件。

安装后需要**完全重启 Claude Code**，让插件在启动时被加载。重启后在技能列表中应该能看到：

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

升级当前仓库后，重新执行：

```bash
/plugin update pk@local-project-knowledge
```

卸载：

```bash
/plugin uninstall pk@local-project-knowledge
```

### 5. 初始化目标项目

安装工具后，还需要对目标项目执行初始化：

```bash
npm run pk:init -- <project-root>
```

或者在 Codex 中使用：

```text
pk:pk-init
```

初始化后，目标项目根目录会出现 `.project-knowledge/`。只有存在这个目录的项目才会进入知识库流程；未初始化项目会返回 `mode: no-knowledge` 并跳过扫描和沉淀。

## 快速开始

初始化后，可以直接用 npm 脚本操作：

```bash
npm test
npm run pk:init -- <project-root>
npm run pk:preflight -- <project-root> "实现 HTTP 调用"
npm run pk:auto-crystallize -- <project-root> <auto-crystallize-input.json>
npm run pk:lint -- <project-root>
npm run pk:govern -- <project-root>
npm run pk:serve -- <project-root> 8124
```

如果命令不传 `<project-root>`，脚本会使用当前工作目录。

## 技能包

仓库同时内置 Codex plugin 技能包与 Claude Code 技能包。

### Codex 技能

技能名如下：

```text
pk:pk-init
pk:pk-preflight
pk:pk-status
pk:pk-graph
pk:pk-crystallize
pk:pk-auto-crystallize
pk:pk-lint
pk:pk-govern
pk:pk-serve
```

推荐安装方式：

```bash
npm run codex:install
```

它会把 `plugins/pk/` 接入 Codex 的插件发现路径，并写入 marketplace 配置。安装后需要完全重启 Codex，技能列表中才会出现 `pk:*` 技能。

卸载：

```bash
npm run codex:uninstall
```

### Claude Code 插件

技能名如下：

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

推荐安装方式：

```bash
/plugin marketplace add <repository-root>
/plugin install pk@local-project-knowledge
```

安装后需要**完全重启 Claude Code**。

卸载：

```bash
/plugin uninstall pk@local-project-knowledge
```

## 常用流程

### 1. 初始化项目知识库

```bash
npm run pk:init -- <project-root>
```

会在目标项目中创建 `.project-knowledge/`，包括：

- `project-profile.md`
- `practices/`
- `options/`
- `rules/`
- `incubating/`
- `sessions/`
- `state/`
- `graph/`
- `_views/`
- `.obsidian/`
- `open-graph.cmd`

如果项目没有初始化，`pk:preflight` 和 `pk:auto-crystallize` 会返回 `mode: no-knowledge`，不会扫描代码，也不会创建知识库。

### 2. 任务开始前预检

```bash
npm run pk:preflight -- <project-root> "实现 HTTP 调用"
```

预检会优先查 `.project-knowledge/`：

- 命中已有实践时返回 `mode: knowledge-hit`。
- 没命中但项目已初始化时返回 `mode: needs-project-scan`，并给出有限的源码 evidence hints。
- 项目未初始化时返回 `mode: no-knowledge`。

为了控制上下文大小，默认只返回：

- Top 5 practices
- 每个节点最多 5 条 evidence 预览
- 每类扫描 hint 最多 5 条

### 3. 任务结束后自动沉淀

```bash
npm run pk:auto-crystallize -- <project-root> <auto-crystallize-input.json>
```

输入示例：

```json
{
  "sessionId": "session-YYYY-MM-DD-topic",
  "title": "本轮任务标题",
  "topic": "任务主题",
  "taskText": "任务描述",
  "decisionSummary": "本轮关键决策。",
  "touchedFiles": ["src/example.ts"]
}
```

行为：

- 命中已有实践时，自动记录推荐方案被采纳。
- 未命中且存在有效源码变更时，生成孵化中的 practice 和 option。
- 只有临时文件、文档或 worktree 变更时，只记录 session，不生成孵化知识。
- 显式传入 `adoptedNodeIds` 或 `incubatingNodes` 时优先使用显式输入。

### 4. 手动结晶

```bash
npm run pk:crystallize -- <project-root> <crystallize-input.json>
```

模板位于：

```text
templates/crystallize-input-template.json
```

适合在你已经明确知道要采纳哪个节点、创建哪个候选节点、或更新稳定知识时使用。

### 5. 检查知识库健康

```bash
npm run pk:lint -- <project-root>
```

会报告：

- `node-missing-evidence`：节点缺少证据。
- `node-volatile-evidence`：节点引用了临时或不稳定 evidence。
- `option-missing-practice`：方案没有有效实践归属。
- `practice-empty-recommendation-pool`：实践没有可推荐方案。
- `incubating-promotion-candidate`：孵化节点达到转正阈值。
- `recommendation-pool-eviction-candidate`：推荐池超过 3 个方案。
- `possible-duplicate-node`：疑似重复知识节点。

### 6. 自动治理

```bash
npm run pk:govern -- <project-root>
```

自动治理只做可逆操作：

- 达到采纳阈值且未被打回的孵化节点会转入稳定区。
- 推荐池排位外的方案会退回孵化区并标记 rejected。
- 强重复节点会保留更强节点，另一个退回孵化区并标记 duplicate。
- 不会物理删除知识文件。

### 7. 查看图谱

```bash
npm run pk:serve -- <project-root> 8124
```

也可以在初始化后的项目里双击：

```text
.project-knowledge/open-graph.cmd
```

图谱页支持：

- 查看 practice、option、rule、context 的关系。
- 查看推荐池和 evidence。
- 对不合适的孵化节点执行打回。

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
├─ .agents/                       # 本地 marketplace 示例
├─ assets/                        # 项目图谱前端资产模板
├─ knowledge/                     # 通用图谱原型和回归验证资产
├─ plugins/pk/                    # Codex / Claude Code 技能包
│  ├─ .codex-plugin/              # Codex plugin 配置
│  ├─ .claude-plugin/             # Claude Code plugin 配置
│  ├─ skills/                     # 技能文件（Codex / Claude Code 共用）
│  └─ scripts/                    # 共享脚本实现
├─ scripts/                       # pk:* 脚本实现
├─ seed/                          # 初始化基线知识
├─ templates/                     # 知识节点和输入 JSON 模板
├─ tests/                         # Node test 回归测试
├─ SKILL.md                       # 根 skill 说明
└─ README.md
```

## 验证

```bash
npm test
```

当前测试覆盖：

- 初始化扫描
- 预检上下文预算
- 自动结晶
- 手动结晶
- 证据过滤
- 推荐池治理
- Obsidian 输出
- 图谱生成和前端行为
- Codex plugin 安装路径
- 发布内容净化

## 发布前检查

仓库包含 `tests/content-sanitization.test.mjs`，用于阻止本地绝对路径、用户名和项目业务残留进入发布内容。

推荐发布前执行：

```bash
npm test
```
