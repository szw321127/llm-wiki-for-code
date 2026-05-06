# Project Graph Canvas Focus Filter Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Collapse the page into a graph-first two-column layout, move search into the graph header, and replace top filter controls with node-driven focus filtering inside the canvas.

**Architecture:** Keep the existing static HTML/CSS/JS page and refactor in three layers. First, lock the new shell structure with failing tests so the topbar and filter controls cannot survive. Then update runtime snapshot logic to introduce `focusedNodeId` and focus-scoped search without changing the graph data model. Finally, wire the browser interactions so node clicks focus the canvas, blank-canvas clicks clear focus, and the right detail panel remains stable.

**Tech Stack:** Static HTML, CSS, browser-side JavaScript, Node test runner

**Repo Note:** This workspace has no `.git` directory, so execute in place and skip commit steps.

---

### Task 1: Lock the graph-first shell with a failing test

**Files:**
- Modify: `tests/project-graph-shell.test.mjs`
- Modify later: `assets/graph/knowledge-graph.html`
- Modify later: `assets/graph/knowledge-graph.css`

**Step 1: Write the failing test**

Update `tests/project-graph-shell.test.mjs` so the shell now requires:

- no `.topbar` markup
- no `project-view`, `context-filter`, `constraint-filter`, `type-filters`, `incubating-toggle`, `adopted-toggle`, `reset-filters`, `filter-toggle`, or `filter-panel`
- search input rendered inside `.graph-panel-head`
- detail panel still using the unified single-column block structure

**Step 2: Run test to verify it fails**

Run: `node --experimental-test-isolation=none --test <repo-root>\tests\project-graph-shell.test.mjs`
Expected: FAIL because the current shell still contains the topbar and filter controls.

**Step 3: Write minimal HTML/CSS changes**

Update `assets/graph/knowledge-graph.html` and `assets/graph/knowledge-graph.css` to:

- remove the topbar block entirely
- place the search field inside the graph panel header
- keep the graph legend, summary, node count, and detail drawer structure intact

**Step 4: Run test to verify it passes**

Run: `node --experimental-test-isolation=none --test <repo-root>\tests\project-graph-shell.test.mjs`
Expected: PASS

### Task 2: Lock focus-filter snapshot behavior with failing runtime tests

**Files:**
- Modify: `tests/project-graph-shell.test.mjs`
- Modify later: `assets/graph/graph-runtime.mjs`

**Step 1: Write the failing test**

Extend `tests/project-graph-shell.test.mjs` with focused snapshot assertions covering:

- default snapshot includes `project_profile`, every `practice`, and each `practice` recommended `option`
- focusing a `practice` keeps only that node and its first-degree neighbors
- focusing an `option` preserves the owning `practice`
- focusing `project_profile` preserves directly connected project nodes
- search only filters within the active snapshot

**Step 2: Run test to verify it fails**

Run: `node --experimental-test-isolation=none --test <repo-root>\tests\project-graph-shell.test.mjs`
Expected: FAIL because `buildCanvasSnapshot` still depends on the removed top filters and does not support `focusedNodeId`.

**Step 3: Write minimal runtime implementation**

Refactor `assets/graph/graph-runtime.mjs` to:

- derive a default canvas snapshot independent of top filter controls
- accept `focusedNodeId`
- compute the focus subgraph from first-degree neighbors
- preserve required owning links for `option` and `project_profile`
- apply search only inside the active snapshot

**Step 4: Run test to verify it passes**

Run: `node --experimental-test-isolation=none --test <repo-root>\tests\project-graph-shell.test.mjs`
Expected: PASS

### Task 3: Wire focus state and blank-canvas clearing with failing interaction-hook tests

**Files:**
- Modify: `tests/project-graph-shell.test.mjs`
- Modify later: `assets/graph/knowledge-graph.js`

**Step 1: Write the failing test**

Add shell-level JS assertions for:

- `focusedNodeId` in state
- node clicks setting focus
- detail relation clicks setting focus
- blank canvas clicks clearing `focusedNodeId` without clearing `selectedNodeId`
- graph summary copy reflecting default vs focused reading modes

**Step 2: Run test to verify it fails**

Run: `node --experimental-test-isolation=none --test <repo-root>\tests\project-graph-shell.test.mjs`
Expected: FAIL because the current JS still uses the old filter state model and blank canvas clicks do not clear focus.

**Step 3: Write minimal browser implementation**

Update `assets/graph/knowledge-graph.js` to:

- remove obsolete top-filter state and DOM hooks
- introduce `focusedNodeId`
- use the new runtime snapshot API
- keep `selectedNodeId` for details
- preserve last detail content when blank canvas clears focus

**Step 4: Run test to verify it passes**

Run: `node --experimental-test-isolation=none --test <repo-root>\tests\project-graph-shell.test.mjs`
Expected: PASS

### Task 4: Clean up styles for the reduced layout

**Files:**
- Modify: `assets/graph/knowledge-graph.css`
- Modify: `assets/graph/knowledge-graph.html`

**Step 1: Write the failing test**

Extend shell assertions to require:

- graph header search styling hooks
- no stale `.topbar`, `.toolbar-*`, `.filter-panel`, `.field-toggle`, or `.type-toggle-*` selectors that belong only to the removed top controls

**Step 2: Run test to verify it fails**

Run: `node --experimental-test-isolation=none --test <repo-root>\tests\project-graph-shell.test.mjs`
Expected: FAIL because stale top-control selectors still exist in CSS.

**Step 3: Write minimal style cleanup**

Refactor CSS to:

- style the compact graph header with inline search
- preserve canvas and drawer appearance
- remove obsolete top-control selector blocks without changing unrelated surfaces

**Step 4: Run test to verify it passes**

Run: `node --experimental-test-isolation=none --test <repo-root>\tests\project-graph-shell.test.mjs`
Expected: PASS

### Task 5: Final verification and local preview

**Files:**
- Verify only

**Step 1: Run targeted shell/runtime regression**

Run: `node --experimental-test-isolation=none --test <repo-root>\tests\project-graph-shell.test.mjs`
Expected: PASS

**Step 2: Run graph build regression**

Run: `node --experimental-test-isolation=none --test <repo-root>\tests\graph-build.test.mjs`
Expected: PASS

**Step 3: Run full project tests**

Run: `npm --prefix <repo-root> test`
Expected: PASS

**Step 4: Validate the actual page locally**

Open: `http://127.0.0.1:8124/graph/knowledge-graph.html`

Verify:

- 页面没有顶部知识图谱区域
- 搜索框位于 `交互式图谱画布` 标题右侧
- 点击节点后画布只保留该节点与一阶邻居
- 点击空白画布后恢复默认快照
- 右侧详情面板在清除聚焦后仍保留上次节点详情

**Step 5: Record remaining risks**

List only concrete residual risks from the new focus-filter interaction, if any remain after local validation.

