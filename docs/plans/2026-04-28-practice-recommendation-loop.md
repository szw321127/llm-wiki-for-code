# Practice Recommendation Loop Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the first closed-loop project practice recommender: preflight query, adoption-weighted ranking, capped recommendation pools, and lint reporting.

**Architecture:** Keep Markdown as the fact source and graph JSON as the derived read model. Add a small preflight module for task-start lookup, extend graph building with usage-aware ranking and recommendation pools, and add a read-only lint command for recommendation health.

**Tech Stack:** Node.js ESM scripts, Node native test runner, structured Markdown frontmatter parser already present in `scripts/knowledge-lib.mjs`.

---

### Task 1: Usage-Aware Recommendation Ranking

**Files:**
- Modify: `scripts/knowledge-lib.mjs`
- Test: `tests/knowledge-lib.test.mjs`

**Step 1: Write failing tests**

Add tests that build a graph fixture with more than three options under one practice, with `usage-index.json` adoption counts. Assert:

- `usage_adjustment` exists on option nodes
- `effective_scores["project-current"]` includes usage bonus
- `recommendation_pools["project-current"]` has at most 3 IDs
- a frequently adopted option outranks a close competitor

**Step 2: Run test to verify it fails**

Run: `node --test tests/knowledge-lib.test.mjs`
Expected: FAIL because `usage_adjustment`, `effective_scores`, and `recommendation_pools` do not exist yet.

**Step 3: Implement minimal ranking changes**

In `buildProjectGraphFromDirectory`:

- load `usageIndex` before scoring
- attach `usage_stats` before option scoring
- compute `usage_adjustment = min(adopted_count * 3 + session_mentions, 15)`
- compute `effective_scores` for global and project views
- rank by stable status, then effective score, then title
- attach `recommendation_pools[viewId] = top 3`
- keep `recommended_options[viewId] = first pool item`

**Step 4: Run test to verify pass**

Run: `node --test tests/knowledge-lib.test.mjs`
Expected: PASS.

---

### Task 2: Preflight Query Command

**Files:**
- Create: `scripts/preflight-session.mjs`
- Modify: `package.json`
- Modify: `SKILL.md`
- Create or modify: `plugins/pk/scripts/pk-preflight.mjs`
- Create: `plugins/pk/skills/pk-preflight/SKILL.md`
- Test: `tests/preflight.test.mjs`

**Step 1: Write failing tests**

Add tests for:

- no `.project-knowledge/` returns `mode: "no-knowledge"`
- keyword match returns `mode: "knowledge-hit"` and recommended options
- no keyword match with project code returns `mode: "needs-project-scan"` and evidence hints

**Step 2: Run test to verify it fails**

Run: `node --test tests/preflight.test.mjs`
Expected: FAIL because the module does not exist.

**Step 3: Implement minimal preflight**

Implement exported `runPreflight(projectRootOrKnowledgeRoot, taskText)`:

- resolve project root and knowledge root
- if missing knowledge root, return no-knowledge
- build graph from `.project-knowledge/`
- tokenize task text and match against node `keywords`, `title`, `summary`
- return matched practices and their recommendation pools
- if no match, run existing `scanProject(projectRoot)` and return high-signal evidence hints

**Step 4: Wire command**

- add `pk:preflight` script
- add plugin wrapper
- add skill entry
- update root `SKILL.md`

**Step 5: Run test to verify pass**

Run: `node --test tests/preflight.test.mjs`
Expected: PASS.

---

### Task 3: Lint Command

**Files:**
- Create: `scripts/lint-project-knowledge.mjs`
- Modify: `package.json`
- Modify: `SKILL.md`
- Create or modify: `plugins/pk/scripts/pk-lint.mjs`
- Create: `plugins/pk/skills/pk-lint/SKILL.md`
- Test: `tests/lint.test.mjs`

**Step 1: Write failing tests**

Assert lint reports:

- recommendation pools per practice
- options without a valid practice
- nodes without evidence
- practices with no recommendation pool

**Step 2: Run test to verify it fails**

Run: `node --test tests/lint.test.mjs`
Expected: FAIL because the module does not exist.

**Step 3: Implement read-only lint**

Implement exported `lintProjectKnowledge(projectRootOrKnowledgeRoot)`:

- resolve `.project-knowledge/`
- build graph
- produce JSON report with `issues` and `recommendationPools`
- do not write or delete files

**Step 4: Wire command**

- add `pk:lint` script
- add plugin wrapper
- add skill entry
- update root `SKILL.md`

**Step 5: Run test to verify pass**

Run: `node --test tests/lint.test.mjs`
Expected: PASS.

---

### Task 4: Documentation and End-to-End Verification

**Files:**
- Modify: `README.md`
- Modify: `knowledge/scoring.md`
- Modify: `templates/option-template.md` if field descriptions need adjustment
- Test: full test suite

**Step 1: Update docs**

Document:

- `pk:preflight`
- `pk:lint`
- usage-aware scoring
- max 3 recommendation pool behavior
- task-start and task-end workflow

**Step 2: Run targeted tests**

Run:

```bash
node --test tests/knowledge-lib.test.mjs tests/preflight.test.mjs tests/lint.test.mjs
```

Expected: PASS.

**Step 3: Run full suite**

Run: `npm test`
Expected: PASS.


