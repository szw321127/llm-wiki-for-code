# Interactive Practice Knowledge Graph Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade the current knowledge graph reader from a relationship board into an interactive force-directed graph canvas while preserving Markdown as the only source of truth.

**Architecture:** Keep the existing Markdown ingestion and scoring pipeline, add a small amount of graph-runtime metadata to generated JSON, and replace the current center-panel layout with an SVG force graph plus a detail drawer. The first screen still shows only `Practice + recommended Option`, and interaction progressively reveals related nodes through highlighting rather than full expansion.

**Tech Stack:** Node.js ESM scripts, native `node:test`, static HTML/CSS/JavaScript, SVG, browser-side force simulation without framework integration.

---

### Task 1: Freeze the Runtime Contract

**Files:**
- Modify: `<repo-root>\knowledge\tools\graph-lib.mjs`
- Test: `<repo-root>\knowledge\tests\build-graph-data.test.mjs`

**Step 1: Write the failing test**

Add assertions that generated nodes include:

- `label`
- `neighbor_ids`
- `node_group`

And that `Practice` nodes include:

- `ranked_option_ids`

**Step 2: Run test to verify it fails**

Run:

```bash
node --experimental-test-isolation=none --test <repo-root>\knowledge\tests\build-graph-data.test.mjs
```

Expected: FAIL because runtime fields are not present yet.

**Step 3: Write minimal implementation**

Update `graph-lib.mjs` so generated graph data includes the new front-end runtime fields.

**Step 4: Run test to verify it passes**

Run the same test command and confirm PASS.

**Step 5: Commit**

```bash
git add knowledge/tools/graph-lib.mjs knowledge/tests/build-graph-data.test.mjs
git commit -m "feat: enrich graph runtime data for interactive canvas"
```

### Task 2: Add Front-End Graph State Helpers

**Files:**
- Create: `<repo-root>\knowledge\tests\graph-runtime.test.mjs`
- Modify: `<repo-root>\knowledge\graph\knowledge-graph.js`

**Step 1: Write the failing test**

Add tests for pure helper behavior:

- current-view recommended option selection
- neighbor lookup
- search filtering

**Step 2: Run test to verify it fails**

Run:

```bash
node --experimental-test-isolation=none --test <repo-root>\knowledge\tests\graph-runtime.test.mjs
```

Expected: FAIL because helpers do not exist yet.

**Step 3: Write minimal implementation**

Extract graph runtime helpers into exportable functions inside `knowledge-graph.js` or a small adjacent helper module.

**Step 4: Run test to verify it passes**

Run the same command and confirm PASS.

**Step 5: Commit**

```bash
git add knowledge/graph/knowledge-graph.js knowledge/tests/graph-runtime.test.mjs
git commit -m "test: cover interactive graph runtime helpers"
```

### Task 3: Replace the Relationship Board With a Canvas Layout

**Files:**
- Modify: `<repo-root>\knowledge\graph\knowledge-graph.html`
- Modify: `<repo-root>\knowledge\graph\knowledge-graph.css`

**Step 1: Write the failing test**

Add a structure assertion in a front-end fixture or HTML smoke test that expects:

- a toolbar
- an SVG graph canvas
- a right-side detail drawer

**Step 2: Run test to verify it fails**

Use either a string-based HTML assertion or a runtime smoke test.

**Step 3: Write minimal implementation**

Update the HTML/CSS skeleton to include:

- top toolbar
- central graph SVG container
- right-side drawer

Remove the current row-by-row relationship board layout.

**Step 4: Run the test to verify it passes**

Confirm expected structure exists.

**Step 5: Commit**

```bash
git add knowledge/graph/knowledge-graph.html knowledge/graph/knowledge-graph.css
git commit -m "feat: replace board layout with graph canvas shell"
```

### Task 4: Implement Interactive Graph Rendering

**Files:**
- Modify: `<repo-root>\knowledge\graph\knowledge-graph.js`

**Step 1: Write the failing test**

Add a focused helper test for:

- visible node set based on filters
- selected-node neighbor emphasis state

**Step 2: Run test to verify it fails**

Run:

```bash
node --experimental-test-isolation=none --test <repo-root>\knowledge\tests\graph-runtime.test.mjs
```

Expected: FAIL.

**Step 3: Write minimal implementation**

Implement:

- SVG node rendering
- SVG edge rendering
- force-style layout positions
- drag / zoom / pan
- node click selection
- neighbor highlighting

**Step 4: Run test to verify it passes**

Run the runtime helper test again and confirm PASS.

**Step 5: Commit**

```bash
git add knowledge/graph/knowledge-graph.js knowledge/tests/graph-runtime.test.mjs
git commit -m "feat: add interactive graph canvas behavior"
```

### Task 5: Rewire Detail Drawer and View Switching

**Files:**
- Modify: `<repo-root>\knowledge\graph\knowledge-graph.js`
- Modify: `<repo-root>\knowledge\graph\knowledge-graph.css`

**Step 1: Write the failing test**

Add assertions that:

- switching project view changes displayed recommendation
- selecting an option shows score breakdown fields

**Step 2: Run test to verify it fails**

Run the front-end runtime test and confirm FAIL.

**Step 3: Write minimal implementation**

Update the drawer rendering logic so it is driven by selected node plus current view state.

**Step 4: Run test to verify it passes**

Re-run the test command and confirm PASS.

**Step 5: Commit**

```bash
git add knowledge/graph/knowledge-graph.js knowledge/graph/knowledge-graph.css knowledge/tests/graph-runtime.test.mjs
git commit -m "feat: sync drawer details with graph selection and view state"
```

### Task 6: Rebuild Data and Refresh Documentation

**Files:**
- Modify: `<repo-root>\knowledge\README.md`
- Modify: `<repo-root>\knowledge\workflow.md`
- Modify: `<repo-root>\knowledge\graph\graph-data.json`
- Modify: `<repo-root>\knowledge\graph\graph-index.json`

**Step 1: Rebuild graph data**

Run:

```bash
node <repo-root>\knowledge\tools\build-graph-data.mjs
```

Expected: JSON outputs regenerate with runtime fields for the interactive canvas.

**Step 2: Update docs**

Document that the graph is now an interactive canvas rather than a relationship board.

**Step 3: Verify docs reference real commands**

Run:

```bash
rg -n "serve-knowledge|build-graph-data|interactive" <repo-root>\knowledge
```

Expected: docs match actual file layout and commands.

**Step 4: Commit**

```bash
git add knowledge/README.md knowledge/workflow.md knowledge/graph/graph-data.json knowledge/graph/graph-index.json
git commit -m "docs: align knowledge graph docs with interactive canvas"
```

### Task 7: Final Verification

**Files:**
- Verify only

**Step 1: Rebuild graph data**

Run:

```bash
node <repo-root>\knowledge\tools\build-graph-data.mjs
```

Expected: success.

**Step 2: Run all Node tests**

Run:

```bash
node --experimental-test-isolation=none --test <repo-root>\knowledge\tests\build-graph-data.test.mjs <repo-root>\knowledge\tests\graph-runtime.test.mjs
```

Expected: PASS.

**Step 3: Syntax-check browser scripts**

Run:

```bash
node --check <repo-root>\knowledge\graph\knowledge-graph.js
node --check <repo-root>\knowledge\tools\serve-knowledge.mjs
```

Expected: PASS.

**Step 4: Browser smoke-check**

Verify in browser:

- graph canvas renders
- drag / zoom / pan work
- clicking node opens drawer
- switching project view updates recommendation and scores
- search highlights matching nodes

**Step 5: Commit**

```bash
git add knowledge
git commit -m "feat: deliver interactive practice knowledge graph canvas"
```

---

Plan complete and saved to `docs/plans/2026-04-22-interactive-practice-knowledge-graph.md`.

Two execution options:

1. Subagent-Driven (this session) - I dispatch fresh subagent per task, review between tasks, fast iteration
2. Parallel Session (separate) - Open new session with executing-plans, batch execution with checkpoints

Given you already要求直接完成且除非阻塞不要停，我将按选项 1 的精神在当前会话继续执行，不额外停下来等选择。

