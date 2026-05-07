# 自动知识治理实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 实现自动知识治理入口和图谱页面人工打回能力。

**Architecture:** 新增 `govern-project-knowledge.mjs` 作为写入层，消费 `lintProjectKnowledge` 与图谱数据，执行节点移动和 frontmatter 更新。`pk:serve` 增加本地 POST API，图谱前端只调用服务端 API，不直接写文件。

**Tech Stack:** Node.js ESM、Markdown frontmatter、原生 HTTP server、静态 HTML/CSS/JS、Node test runner。

---

### Task 1: 自动治理脚本

**Files:**
- Create: `scripts/govern-project-knowledge.mjs`
- Test: `tests/governance.test.mjs`

**Steps:**
1. 写失败测试：孵化 option 达到采纳阈值后执行治理，应移动到 `options/` 并改为 `maturity: stable`。
2. 写失败测试：推荐池排位外 stable option 应退回 `incubating/options/`。
3. 写失败测试：被打回的 promotion candidate 不应自动转正。
4. 实现节点路径解析、frontmatter 重写、移动文件、日志记录、图谱重建。
5. 跑 `node --test tests\\governance.test.mjs`。

### Task 2: lint 与图谱字段补充

**Files:**
- Modify: `scripts/knowledge-lib.mjs`
- Modify: `scripts/lint-project-knowledge.mjs`
- Test: `tests/knowledge-lib.test.mjs`
- Test: `tests/lint.test.mjs`

**Steps:**
1. 写失败测试：`review_status: rejected` 节点不进入推荐池 tier。
2. 写失败测试：lint issue 暴露 `node_id` 和可执行 action 所需信息。
3. 实现最小字段读取与过滤。
4. 跑目标测试。

### Task 3: 服务端打回 API

**Files:**
- Modify: `scripts/serve-project-knowledge.mjs`
- Test: `tests/governance-api.test.mjs`

**Steps:**
1. 写失败测试：`POST /api/governance/reject` 打回节点并返回 JSON。
2. 写失败测试：非法 nodeId 或非 POST 不写文件。
3. 复用治理脚本的 `rejectKnowledgeNode`。
4. 跑 API 测试。

### Task 4: 图谱页面打回入口

**Files:**
- Modify: `assets/graph/knowledge-graph.js`
- Modify: `assets/graph/knowledge-graph.css`
- Test: `tests/project-graph-shell.test.mjs`

**Steps:**
1. 写失败测试：详情抽屉包含治理动作容器和 `data-governance-action`。
2. 实现按钮渲染、点击请求 API、成功后重新加载 `graph-data.json`。
3. 跑图谱页面测试。

### Task 5: 插件、文档和安装

**Files:**
- Modify: `package.json`
- Modify: `README.md`
- Modify: `SKILL.md`
- Modify: `plugins/pk/.codex-plugin/plugin.json`
- Create: `plugins/pk/skills/pk-govern/SKILL.md`
- Copy: root scripts to `plugins/pk/scripts/`
- Test: `tests/plugin-command-shell.test.mjs`

**Steps:**
1. 加 `pk:govern` npm script 和 `pk-govern` skill。
2. 更新 manifest 版本。
3. 同步插件脚本副本。
4. 跑完整 `npm test`。
5. 执行 `npm run codex:install` 并核对安装版本。


