# Project Graph Interaction Refresh Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor the project knowledge graph page so the canvas becomes the primary interaction surface, the project profile is represented inside the graph, and the right drawer uses a cleaner single-column information design.

**Architecture:** Update the static graph shell in three layers. First, adjust HTML structure to remove the standalone project summary strip and introduce a compact toolbar plus collapsible filters. Then update the runtime JS to support the new filter toggle behavior, integrate project profile node emphasis in the canvas, and simplify detail rendering. Finally, rewrite CSS so the new layout and drawer use one consistent visual language.

**Tech Stack:** Static HTML, CSS, browser-side JavaScript, Node test runner

---

### Task 1: Lock the new shell structure with failing tests

**Files:**
- Modify: `tests/project-graph-shell.test.mjs`
- Modify: `assets/graph/knowledge-graph.html`
- Modify: `assets/graph/knowledge-graph.css`

**Step 1: Write the failing test**

Change shell assertions to require:

- no `project-summary-strip`
- a compact filter toggle control
- a collapsible filter panel container
- drawer markup that reflects a simplified single-column structure

**Step 2: Run test to verify it fails**

Run: `node --test tests/project-graph-shell.test.mjs`
Expected: FAIL because the current shell still contains `project-summary-strip` and lacks the new filter panel structure.

**Step 3: Write minimal HTML/CSS changes**

Update the graph shell markup and baseline styles to satisfy the new structure without yet finishing all runtime behavior.

**Step 4: Run test to verify it passes**

Run: `node --test tests/project-graph-shell.test.mjs`
Expected: PASS

### Task 2: Add compact toolbar and collapsible filters behavior

**Files:**
- Modify: `assets/graph/knowledge-graph.js`
- Modify: `assets/graph/knowledge-graph.html`
- Modify: `assets/graph/knowledge-graph.css`

**Step 1: Write the failing test**

Extend shell assertions to require stable IDs/classes for:

- filter toggle button
- collapsible filters panel
- expanded/collapsed state hook

**Step 2: Run test to verify it fails**

Run: `node --test tests/project-graph-shell.test.mjs`
Expected: FAIL because the runtime hook markers are incomplete.

**Step 3: Write minimal implementation**

Implement:

- filter panel toggle state in JS
- reset behavior that also collapses or normalizes the panel
- compact toolbar wiring

**Step 4: Run test to verify it passes**

Run: `node --test tests/project-graph-shell.test.mjs`
Expected: PASS

### Task 3: Integrate project profile into the graph-first reading model

**Files:**
- Modify: `assets/graph/knowledge-graph.js`
- Modify: `assets/graph/knowledge-graph.css`
- Test: `tests/project-graph-shell.test.mjs`

**Step 1: Write the failing test**

Add assertions that the graph shell and runtime expose project-profile-specific presentation markers rather than relying on an external summary strip.

**Step 2: Run test to verify it fails**

Run: `node --test tests/project-graph-shell.test.mjs`
Expected: FAIL because current code still uses external project summary rendering.

**Step 3: Write minimal implementation**

Update JS/CSS so:

- project profile is emphasized as an in-canvas node
- external summary rendering is removed
- graph summary copy matches the new graph-first mental model

**Step 4: Run test to verify it passes**

Run: `node --test tests/project-graph-shell.test.mjs`
Expected: PASS

### Task 4: Simplify the detail drawer visual system

**Files:**
- Modify: `assets/graph/knowledge-graph.js`
- Modify: `assets/graph/knowledge-graph.css`
- Test: `tests/project-graph-shell.test.mjs`

**Step 1: Write the failing test**

Add assertions for the new simplified drawer structure markers and remove assertions that depend on old visual patterns.

**Step 2: Run test to verify it fails**

Run: `node --test tests/project-graph-shell.test.mjs`
Expected: FAIL because the current drawer still uses the old multi-pattern structure.

**Step 3: Write minimal implementation**

Refactor drawer rendering so all node types use:

- unified header block
- unified fact block
- unified relations block
- unified body block
- unified evidence block

**Step 4: Run test to verify it passes**

Run: `node --test tests/project-graph-shell.test.mjs`
Expected: PASS

### Task 5: Full regression verification

**Files:**
- Verify only

**Step 1: Run targeted shell tests**

Run: `node --test tests/project-graph-shell.test.mjs`
Expected: PASS

**Step 2: Run broader graph tests**

Run: `node --test tests/graph-build.test.mjs`
Expected: PASS

**Step 3: Run full suite**

Run: `npm test`
Expected: PASS

**Step 4: Regenerate and manually preview**

Run:

- `npm run pk:graph -- <project-root>`
- `npm run pk:serve -- <project-root> 8124`

Expected:

- graph page opens successfully
- no external project summary strip remains
- filter panel expands/collapses
- detail drawer renders with a consistent single-column UI

