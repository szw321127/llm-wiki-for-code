# Repowise Init Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add the `repowise init` CLI that initializes `.repowise/` and installs Repowise skills for Codex and Claude.

**Architecture:** Keep the existing project knowledge scripts as the core implementation, but centralize the knowledge directory name and add a new CLI orchestration layer. The CLI parses agent flags, delegates vault creation to `initializeProjectKnowledge()`, copies skill wrappers into user and project skill directories, and returns a structured summary.

**Tech Stack:** Node.js ESM, Node built-in test runner, npm `bin`, filesystem APIs.

---

### Task 1: Document the Public Contract

**Files:**
- Create: `docs/plans/2026-05-29-repowise-init-design.md`
- Create: `docs/plans/2026-05-29-repowise-init-implementation.md`

**Step 1: Write the design and plan**

Record the command semantics, target directories, migration behavior, and tests.

**Step 2: Commit**

Run:

```powershell
git add docs/plans/2026-05-29-repowise-init-design.md docs/plans/2026-05-29-repowise-init-implementation.md
git commit -m "docs: design repowise init"
```

### Task 2: Add Failing CLI Contract Tests

**Files:**
- Create: `tests/repowise-cli.test.mjs`
- Modify: `tests/skill-shell.test.mjs`

**Step 1: Write the failing tests**

Add tests that execute `bin/repowise.mjs init` against temporary projects and assert:

- `.repowise/project-profile.md` exists.
- `.project-knowledge/` is not created.
- `--codex` creates `.agents/skills/repowise-init` but not `.claude/skills/repowise-init`.
- `--claude` creates `.claude/skills/repowise-init` but not `.agents/skills/repowise-init`.
- `--no-global` avoids writes under a supplied test home directory.
- `--no-project-skills` avoids project-level skill writes.

Update package metadata tests to expect a `repowise` bin.

**Step 2: Verify RED**

Run:

```powershell
node --test tests/repowise-cli.test.mjs tests/skill-shell.test.mjs
```

Expected: FAIL because `bin/repowise.mjs` and the `bin.repowise` package field do not exist.

### Task 3: Centralize Knowledge Directory Resolution

**Files:**
- Create: `scripts/paths.mjs`
- Modify: `scripts/init-project-knowledge.mjs`
- Modify: `scripts/preflight-session.mjs`
- Modify: `scripts/status-report.mjs`
- Modify: `scripts/build-project-graph-data.mjs`
- Modify: `scripts/build-project-graph-page.mjs`
- Modify: `scripts/crystallize-session.mjs`
- Modify: `scripts/auto-crystallize-session.mjs`
- Modify: `scripts/lint-project-knowledge.mjs`
- Modify: `scripts/govern-project-knowledge.mjs`
- Modify: `scripts/serve-project-knowledge.mjs`
- Modify: `scripts/evidence-paths.mjs`
- Modify: `scripts/scan-project.mjs`

**Step 1: Write targeted failing tests**

Update existing init/preflight/status tests to use `.repowise/` and verify legacy `.project-knowledge/` is not created by init.

**Step 2: Verify RED**

Run:

```powershell
node --test tests/init.test.mjs tests/preflight.test.mjs tests/status.test.mjs
```

Expected: FAIL on `.repowise/` expectations.

**Step 3: Implement minimal path helpers**

Add helpers:

```js
export const knowledgeDirectoryName = ".repowise";
export const legacyKnowledgeDirectoryName = ".project-knowledge";
export function resolveProjectKnowledgeRoot(projectRoot) { ... }
export async function resolveKnowledgeRoot(targetPath) { ... }
```

Use them in scripts that currently hardcode `.project-knowledge`.

**Step 4: Verify GREEN**

Run the same focused tests.

### Task 4: Implement Repowise CLI and Skill Installer

**Files:**
- Create: `bin/repowise.mjs`
- Create: `scripts/repowise-init.mjs`
- Create: `scripts/install-repowise-skills.mjs`
- Modify: `package.json`

**Step 1: Implement minimal CLI**

Parse `init`, optional project path, and flags. Delegate to `initializeRepowiseProject()`.

**Step 2: Implement skill copy**

Copy `plugins/pk/skills/pk-*` to `repowise-*` target directories. Rewrite only the frontmatter `name:` and visible `pk-*` skill names needed for agent discovery.

**Step 3: Verify GREEN**

Run:

```powershell
node --test tests/repowise-cli.test.mjs tests/skill-shell.test.mjs
```

### Task 5: Sync Plugin and Fixture Expectations

**Files:**
- Modify: `plugins/pk/scripts/*`
- Modify: `plugins/pk/skills/*/SKILL.md`
- Modify: `tests/fixtures/sample-project`
- Modify: relevant tests using fixture knowledge roots

**Step 1: Sync scripts**

Mirror root script changes into `plugins/pk/scripts`.

**Step 2: Update fixture directory**

Move `tests/fixtures/sample-project/.project-knowledge` to `.repowise` and update tests.

**Step 3: Verify focused tests**

Run:

```powershell
node --test tests/plugin-command-shell.test.mjs tests/preflight.test.mjs tests/auto-crystallize.test.mjs
```

### Task 6: Documentation and Full Verification

**Files:**
- Modify: `README.md`
- Modify: `README_EN.md`
- Modify: `CONTRIBUTING.md`
- Modify: `SKILL.md`

**Step 1: Update docs**

Make `repowise init` and `.repowise/` the primary documented workflow. Mention `pk:*` scripts only as local development compatibility if retained.

**Step 2: Run verification**

Run:

```powershell
npm test
```

Expected: all tests pass.

**Step 3: Commit and push**

Run:

```powershell
git status --short
git add .
git commit -m "feat: add repowise init"
git push -u origin feature/repowise-init
```
