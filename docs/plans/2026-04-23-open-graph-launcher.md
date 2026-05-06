# Open Graph Launcher Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Generate a clickable `open-graph.cmd` launcher during project knowledge initialization so users can open the graph preview without manually typing the serve command.

**Architecture:** Keep serving logic in the tool repository and emit a tiny Windows launcher into the target project's `.project-knowledge/` directory. The launcher will start the existing Node preview server in a separate PowerShell window and then open the graph URL in the browser.

**Tech Stack:** Node.js, Windows `.cmd`, PowerShell, native Node test runner

---

### Task 1: Add launcher generation coverage

**Files:**
- Modify: `tests/init.test.mjs`
- Modify: `scripts/init-project-knowledge.mjs`

**Step 1: Write the failing test**

Add assertions that `.project-knowledge/open-graph.cmd` exists after `initializeProjectKnowledge(projectRoot)` and that the file contains:

- `serve-project-knowledge.mjs`
- `127.0.0.1`
- `8124`

**Step 2: Run test to verify it fails**

Run: `node --test tests/init.test.mjs`
Expected: FAIL because `open-graph.cmd` is not created yet.

**Step 3: Write minimal implementation**

Add a helper in `scripts/init-project-knowledge.mjs` that writes `open-graph.cmd` after graph artifacts are generated. Use:

- `process.execPath` for the Node executable
- the absolute path to `scripts/serve-project-knowledge.mjs`
- project root resolved from the launcher location

**Step 4: Run test to verify it passes**

Run: `node --test tests/init.test.mjs`
Expected: PASS

**Step 5: Verify broader regression safety**

Run: `npm test`
Expected: PASS

**Step 6: Update user-facing docs**

Document that `pk:init` now generates `.project-knowledge/open-graph.cmd`.

