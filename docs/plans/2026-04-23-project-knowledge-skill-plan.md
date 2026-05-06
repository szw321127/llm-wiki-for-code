# Project Knowledge Skill Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reframe the current universal knowledge graph prototype into a project-serving skill that initializes, grows, and renders a `.project-knowledge/` knowledge base for the current project.

**Architecture:** Keep the existing Markdown graph generation and reading-layer assets, but move product ownership to a skill workflow centered on `.project-knowledge/`. Add `/pk-init`, `/pk-status`, `/pk-graph`, and `/pk-crystallize` pipelines, demote current universal knowledge content into seed references, and keep graph output as a derived project-specific reading surface.

**Tech Stack:** Node.js ESM scripts, native `node:test`, static HTML/CSS/JavaScript assets, Markdown frontmatter parsing, filesystem-based project scanning.

---

### Task 1: Reframe the Repository as a Skill Package

**Files:**
- Create: `<repo-root>\SKILL.md`
- Create: `<repo-root>\templates\project-profile-template.md`
- Create: `<repo-root>\templates\practice-template.md`
- Create: `<repo-root>\templates\option-template.md`
- Create: `<repo-root>\templates\rule-template.md`
- Create: `<repo-root>\templates\constraint-template.md`
- Create: `<repo-root>\templates\context-template.md`
- Create: `<repo-root>\templates\session-template.md`
- Modify: `<repo-root>\package.json`
- Test: `<repo-root>\tests\skill-shell.test.mjs`

**Step 1: Write the failing test**

Add a repository-shell test that expects:

- root `SKILL.md`
- root `templates/`
- root-level skill scripts exposed by `package.json`

**Step 2: Run test to verify it fails**

Run:

```bash
node --test <repo-root>\tests\skill-shell.test.mjs
```

Expected: FAIL because the skill shell does not exist yet.

**Step 3: Write minimal implementation**

Create the root skill scaffold and update `package.json` scripts to reflect skill-centric commands.

**Step 4: Run test to verify it passes**

Run the same command and confirm PASS.

**Step 5: Commit**

```bash
git add SKILL.md templates package.json tests/skill-shell.test.mjs
git commit -m "feat: scaffold project knowledge skill shell"
```

### Task 2: Extract Reusable Core Library and Seed Content

**Files:**
- Create: `<repo-root>\scripts\knowledge-lib.mjs`
- Create: `<repo-root>\seed\practices\`
- Create: `<repo-root>\seed\options\`
- Create: `<repo-root>\seed\rules\`
- Modify: `<repo-root>\knowledge\tools\graph-lib.mjs`
- Test: `<repo-root>\tests\knowledge-lib.test.mjs`

**Step 1: Write the failing test**

Add tests for shared parsing and graph-building helpers that will be reused by `/pk-init`, `/pk-graph`, and `/pk-crystallize`.

**Step 2: Run test to verify it fails**

Run:

```bash
node --test <repo-root>\tests\knowledge-lib.test.mjs
```

Expected: FAIL because the shared library does not exist yet.

**Step 3: Write minimal implementation**

Extract the stable Markdown/frontmatter/graph helpers into `scripts/knowledge-lib.mjs` and copy the current universal baseline knowledge into `seed/` as initialization references.

**Step 4: Run test to verify it passes**

Run the same command and confirm PASS.

**Step 5: Commit**

```bash
git add scripts/knowledge-lib.mjs seed tests/knowledge-lib.test.mjs knowledge/tools/graph-lib.mjs
git commit -m "refactor: extract reusable knowledge core and seed content"
```

### Task 3: Implement `/pk-init` Project Scanning and Bootstrap

**Files:**
- Create: `<repo-root>\scripts\scan-project.mjs`
- Create: `<repo-root>\scripts\init-project-knowledge.mjs`
- Create: `<repo-root>\tests\init.test.mjs`
- Create: `<repo-root>\tests\fixtures\sample-project\`
- Modify: `<repo-root>\package.json`

**Step 1: Write the failing test**

Add a fixture-driven test that initializes a sample project and asserts:

- `.project-knowledge/` is created
- `project-profile.md` exists
- stable and incubating nodes are generated
- first graph build is requested

**Step 2: Run test to verify it fails**

Run:

```bash
node --test <repo-root>\tests\init.test.mjs
```

Expected: FAIL because `/pk-init` is not implemented yet.

**Step 3: Write minimal implementation**

Implement project scanning that only reads local code and docs, builds the initial `.project-knowledge/` tree, and writes a conservative first-pass project profile plus stable/incubating nodes.

**Step 4: Run test to verify it passes**

Run the same command and confirm PASS.

**Step 5: Commit**

```bash
git add scripts/scan-project.mjs scripts/init-project-knowledge.mjs tests/init.test.mjs tests/fixtures/sample-project package.json
git commit -m "feat: add project knowledge init pipeline"
```

### Task 4: Implement `/pk-graph` for `.project-knowledge`

**Files:**
- Create: `<repo-root>\scripts\build-project-graph-data.mjs`
- Create: `<repo-root>\scripts\build-project-graph-page.mjs`
- Create: `<repo-root>\assets\graph\knowledge-graph.html`
- Create: `<repo-root>\assets\graph\knowledge-graph.css`
- Create: `<repo-root>\assets\graph\knowledge-graph.js`
- Test: `<repo-root>\tests\graph-build.test.mjs`

**Step 1: Write the failing test**

Add a test that builds graph outputs from a fixture `.project-knowledge/` directory and asserts:

- `graph-data.json`
- `graph-index.json`
- `knowledge-graph.html`

are generated in `.project-knowledge/graph/`.

**Step 2: Run test to verify it fails**

Run:

```bash
node --test <repo-root>\tests\graph-build.test.mjs
```

Expected: FAIL because the project-oriented graph build scripts do not exist yet.

**Step 3: Write minimal implementation**

Wrap the current graph generation pipeline so it reads `.project-knowledge/` and writes project-local graph outputs using reusable assets from `assets/graph/`.

**Step 4: Run test to verify it passes**

Run the same command and confirm PASS.

**Step 5: Commit**

```bash
git add scripts/build-project-graph-data.mjs scripts/build-project-graph-page.mjs assets/graph tests/graph-build.test.mjs
git commit -m "feat: build project-local knowledge graph outputs"
```

### Task 5: Implement `/pk-status` and Runtime State

**Files:**
- Create: `<repo-root>\scripts\status-report.mjs`
- Create: `<repo-root>\tests\status.test.mjs`
- Modify: `<repo-root>\templates\overview-template.md`
- Modify: `<repo-root>\templates\workflow-template.md`

**Step 1: Write the failing test**

Add a status test that expects the report to summarize:

- project profile
- stable/incubating counts
- recent sessions
- graph freshness

**Step 2: Run test to verify it fails**

Run:

```bash
node --test <repo-root>\tests\status.test.mjs
```

Expected: FAIL because the status reporter does not exist yet.

**Step 3: Write minimal implementation**

Implement a read-only status command and ensure `.project-knowledge/state/runtime-state.json` is populated with graph freshness and crystallization metadata.

**Step 4: Run test to verify it passes**

Run the same command and confirm PASS.

**Step 5: Commit**

```bash
git add scripts/status-report.mjs templates/overview-template.md templates/workflow-template.md tests/status.test.mjs
git commit -m "feat: add project knowledge status reporting"
```

### Task 6: Implement `/pk-crystallize` and Session Persistence

**Files:**
- Create: `<repo-root>\scripts\crystallize-session.mjs`
- Create: `<repo-root>\tests\crystallize.test.mjs`
- Modify: `<repo-root>\templates\session-template.md`
- Modify: `<repo-root>\scripts\knowledge-lib.mjs`

**Step 1: Write the failing test**

Add tests that cover 4 outcomes:

- `no-op`
- `session-only`
- `session + incubating`
- `session + stable-update`

**Step 2: Run test to verify it fails**

Run:

```bash
node --test <repo-root>\tests\crystallize.test.mjs
```

Expected: FAIL because crystallization behavior does not exist yet.

**Step 3: Write minimal implementation**

Implement session writing, stable-knowledge judgment, incubating-node creation, stable-node updates, and usage-index bookkeeping.

**Step 4: Run test to verify it passes**

Run the same command and confirm PASS.

**Step 5: Commit**

```bash
git add scripts/crystallize-session.mjs scripts/knowledge-lib.mjs templates/session-template.md tests/crystallize.test.mjs
git commit -m "feat: add session crystallization workflow"
```

### Task 7: Adapt the Existing Reader to Project Signals

**Files:**
- Modify: `<repo-root>\knowledge\graph\knowledge-graph.html`
- Modify: `<repo-root>\knowledge\graph\knowledge-graph.css`
- Modify: `<repo-root>\knowledge\graph\knowledge-graph.js`
- Test: `<repo-root>\knowledge\tests\graph-shell.test.mjs`

**Step 1: Write the failing test**

Extend the graph shell test to assert support for:

- incubating visibility toggle
- evidence/adoption section in the drawer
- project summary strip

**Step 2: Run test to verify it fails**

Run:

```bash
node --experimental-test-isolation=none --test <repo-root>\knowledge\tests\graph-shell.test.mjs
```

Expected: FAIL because the current reader only reflects the universal prototype state.

**Step 3: Write minimal implementation**

Update the reader so it behaves as a project-serving graph view, including stable/incubating differentiation, project summary, and evidence/adoption rendering.

**Step 4: Run test to verify it passes**

Run the same command and confirm PASS.

**Step 5: Commit**

```bash
git add knowledge/graph/knowledge-graph.html knowledge/graph/knowledge-graph.css knowledge/graph/knowledge-graph.js knowledge/tests/graph-shell.test.mjs
git commit -m "feat: adapt graph reader to project knowledge signals"
```

### Task 8: Wire Command Scripts and Documentation

**Files:**
- Modify: `<repo-root>\package.json`
- Modify: `<repo-root>\knowledge\README.md`
- Modify: `<repo-root>\knowledge\workflow.md`
- Modify: `<repo-root>\knowledge\scoring.md`
- Create: `<repo-root>\README.md`

**Step 1: Write the failing test**

Extend the shell/documentation test to assert:

- `/pk-init`, `/pk-status`, `/pk-graph`, `/pk-crystallize` scripts are exposed
- docs describe `.project-knowledge/` as the fact source

**Step 2: Run test to verify it fails**

Run:

```bash
node --test <repo-root>\tests\skill-shell.test.mjs
```

Expected: FAIL because the docs and script surface are still prototype-oriented.

**Step 3: Write minimal implementation**

Finalize package scripts and rewrite docs so the repository clearly describes the skill workflow and the project-local knowledge directory.

**Step 4: Run test to verify it passes**

Run the same command and confirm PASS.

**Step 5: Commit**

```bash
git add package.json README.md knowledge/README.md knowledge/workflow.md knowledge/scoring.md tests/skill-shell.test.mjs
git commit -m "docs: document project knowledge skill workflow"
```

### Task 9: Final Verification

**Files:**
- Verify only

**Step 1: Run the full test suite**

Run:

```bash
npm test
```

Expected: PASS.

**Step 2: Smoke-test `/pk-init` against a fixture project**

Run:

```bash
node <repo-root>\scripts\init-project-knowledge.mjs <repo-root>\tests\fixtures\sample-project
```

Expected: `.project-knowledge/` is created with stable/incubating content and graph outputs.

**Step 3: Smoke-test `/pk-status`**

Run:

```bash
node <repo-root>\scripts\status-report.mjs <repo-root>\tests\fixtures\sample-project
```

Expected: prints project knowledge summary without errors.

**Step 4: Smoke-test `/pk-graph` rebuild**

Run:

```bash
node <repo-root>\scripts\build-project-graph-data.mjs <repo-root>\tests\fixtures\sample-project\.project-knowledge
```

Expected: graph outputs rebuild without errors.

**Step 5: Syntax-check scripts**

Run:

```bash
node --check <repo-root>\scripts\init-project-knowledge.mjs
node --check <repo-root>\scripts\crystallize-session.mjs
node --check <repo-root>\scripts\status-report.mjs
```

Expected: PASS.

**Step 6: Commit**

```bash
git add .
git commit -m "feat: deliver project knowledge skill mvp"
```

---

Plan complete and saved to `docs/plans/2026-04-23-project-knowledge-skill-plan.md`.

Two execution options:

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach?**

