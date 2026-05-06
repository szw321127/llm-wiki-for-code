# 展示型信息画布 UI 重构 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 把交互式知识图谱阅读层重构成展示型信息画布，同时保留现有图谱交互和知识模型。

**Architecture:** 只调整 `knowledge-graph.html`、`knowledge-graph.css` 和 `knowledge-graph.js` 的阅读层结构与渲染语法，不修改 Markdown 事实源和图谱生成逻辑。先通过最小页面结构测试锁定新骨架，再以最小 JS 变更对齐新的节点类型视觉语法与详情抽屉分区。

**Tech Stack:** 原生 HTML / CSS / JavaScript、Node.js 原生测试、Chrome DevTools 烟测

---

### Task 1: 锁定新的页面骨架测试

**Files:**
- Modify: `<repo-root>\knowledge\tests\graph-shell.test.mjs`
- Test: `<repo-root>\knowledge\tests\graph-shell.test.mjs`

**Step 1: Write the failing test**

- 为新 UI 骨架增加断言：
  - `class="toolbar toolbar-primary"`
  - `class="toolbar toolbar-secondary"`
  - `class="type-toggle-group"`
  - `class="detail-stage"`
  - `class="detail-structure"`

**Step 2: Run test to verify it fails**

Run: `node --experimental-test-isolation=none --test knowledge/tests/graph-shell.test.mjs`
Expected: FAIL，提示新类名或新结构缺失

**Step 3: Write minimal implementation**

- 在 `knowledge/graph/knowledge-graph.html` 中重组顶部和抽屉骨架

**Step 4: Run test to verify it passes**

Run: `node --experimental-test-isolation=none --test knowledge/tests/graph-shell.test.mjs`
Expected: PASS

**Step 5: Commit**

```bash
git add knowledge/tests/graph-shell.test.mjs knowledge/graph/knowledge-graph.html
git commit -m "test: lock exhibition graph shell structure"
```

### Task 2: 重构顶部工具带和节点类型筛选器

**Files:**
- Modify: `<repo-root>\knowledge\graph\knowledge-graph.html`
- Modify: `<repo-root>\knowledge\graph\knowledge-graph.css`
- Modify: `<repo-root>\knowledge\graph\knowledge-graph.js`
- Test: `<repo-root>\knowledge\tests\graph-shell.test.mjs`

**Step 1: Write the failing test**

- 让 `graph-shell.test.mjs` 校验新筛选区的 `type-toggle` 语义类和工具带分区类

**Step 2: Run test to verify it fails**

Run: `node --experimental-test-isolation=none --test knowledge/tests/graph-shell.test.mjs`
Expected: FAIL

**Step 3: Write minimal implementation**

- HTML:
  - 把顶部控件改成主控制带 + 次级筛选带
  - 将节点类型复选块重构为紧凑切换项
- CSS:
  - 收紧标题区和工具带密度
  - 用 segmented / pill 风格重做节点类型筛选器
- JS:
  - 保持现有行为，只适配新的 DOM 结构

**Step 4: Run test to verify it passes**

Run: `node --experimental-test-isolation=none --test knowledge/tests/graph-shell.test.mjs`
Expected: PASS

**Step 5: Commit**

```bash
git add knowledge/graph/knowledge-graph.html knowledge/graph/knowledge-graph.css knowledge/graph/knowledge-graph.js knowledge/tests/graph-shell.test.mjs
git commit -m "feat: restyle graph toolbar and node type toggles"
```

### Task 3: 重构节点卡片和徽章型节点语法

**Files:**
- Modify: `<repo-root>\knowledge\graph\knowledge-graph.css`
- Modify: `<repo-root>\knowledge\graph\knowledge-graph.js`

**Step 1: Write the failing test**

- 用 `graph-shell.test.mjs` 追加 CSS 类断言：
  - `.node-badge`
  - `.node-option-recommended`
  - `.node-practice-card`

**Step 2: Run test to verify it fails**

Run: `node --experimental-test-isolation=none --test knowledge/tests/graph-shell.test.mjs`
Expected: FAIL

**Step 3: Write minimal implementation**

- JS:
  - 为 Practice / Option / 徽章节点输出更明确的结构类
  - 为推荐 Option 增加专用视觉类
- CSS:
  - 重做 Practice / Option 卡片样式
  - 把 Context / Constraint / Rule / ProjectProfile 调整为徽章型节点
  - 调整连线层级与节点高亮

**Step 4: Run test to verify it passes**

Run: `node --experimental-test-isolation=none --test knowledge/tests/graph-shell.test.mjs`
Expected: PASS

**Step 5: Commit**

```bash
git add knowledge/graph/knowledge-graph.css knowledge/graph/knowledge-graph.js knowledge/tests/graph-shell.test.mjs
git commit -m "feat: introduce exhibition node visual grammar"
```

### Task 4: 重构详情抽屉为展陈区和结构区

**Files:**
- Modify: `<repo-root>\knowledge\graph\knowledge-graph.css`
- Modify: `<repo-root>\knowledge\graph\knowledge-graph.js`
- Modify: `<repo-root>\knowledge\graph\knowledge-graph.html`
- Test: `<repo-root>\knowledge\tests\graph-shell.test.mjs`

**Step 1: Write the failing test**

- 为抽屉结构断言：
  - `detail-stage`
  - `detail-score-hero`
  - `relation-group`
  - `markdown-body`

**Step 2: Run test to verify it fails**

Run: `node --experimental-test-isolation=none --test knowledge/tests/graph-shell.test.mjs`
Expected: FAIL

**Step 3: Write minimal implementation**

- JS:
  - 详情头部拆为展陈区
  - 评分区重排为 `final_score` 主指标 + 次级指标
  - 关系按类别分组输出
- CSS:
  - 抽屉头部强化标题、摘要和状态
  - 结构区按分区和阅读密度重排

**Step 4: Run test to verify it passes**

Run: `node --experimental-test-isolation=none --test knowledge/tests/graph-shell.test.mjs`
Expected: PASS

**Step 5: Commit**

```bash
git add knowledge/graph/knowledge-graph.html knowledge/graph/knowledge-graph.css knowledge/graph/knowledge-graph.js knowledge/tests/graph-shell.test.mjs
git commit -m "feat: restructure graph detail drawer"
```

### Task 5: 完整回归与浏览器烟测

**Files:**
- Modify: `<repo-root>\knowledge\README.md`
- Modify: `<repo-root>\knowledge\workflow.md`
- Test: `<repo-root>\knowledge\tests\build-graph-data.test.mjs`
- Test: `<repo-root>\knowledge\tests\graph-runtime.test.mjs`
- Test: `<repo-root>\knowledge\tests\graph-shell.test.mjs`
- Test: `<repo-root>\knowledge\tests\serve-knowledge.test.mjs`

**Step 1: Write the failing test**

- 如文档说明与实际 UI 能力不一致，先补断言或更新文案检查点

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: 若有不一致则 FAIL；否则继续文档对齐

**Step 3: Write minimal implementation**

- 更新 README / workflow 中对展示型信息画布、工具带和详情抽屉的描述
- 重新生成图谱数据

**Step 4: Run test to verify it passes**

Run:
- `npm test`
- `node knowledge/tools/build-graph-data.mjs`
- `node knowledge/tools/serve-knowledge.mjs 8125`

Expected:
- 自动化测试全绿
- 浏览器烟测通过：
  - 节点点击
  - 搜索与筛选
  - 项目视角切换
  - 详情抽屉阅读层级改善
  - 拖拽 / 缩放 / 平移仍正常

**Step 5: Commit**

```bash
git add knowledge/README.md knowledge/workflow.md knowledge/graph/knowledge-graph.html knowledge/graph/knowledge-graph.css knowledge/graph/knowledge-graph.js knowledge/tests/graph-shell.test.mjs
git commit -m "feat: polish exhibition graph reading layer"
```

