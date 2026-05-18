# Compound Engineering PK Wiki Governance Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Strengthen LLM Wiki for Code so it acts as the Compound Engineering knowledge-compounding layer: task-start retrieval, task-end crystallization, evidence-backed wiki governance, and safe lifecycle maintenance.

**Architecture:** Keep `.project-knowledge/` Markdown as the only fact source. Extend the existing `pk-preflight`, `pk-auto-crystallize`, `pk-lint`, and `pk-govern` pipeline rather than adding a separate workflow framework. Add richer metadata, task-scoped evidence collection, wiki quality linting, stale knowledge detection, and safer governance defaults.

**Tech Stack:** Node.js ESM scripts, Node native test runner, Markdown frontmatter documents, existing PK plugin wrappers under `plugins/pk/`, and generated graph/Obsidian artifacts.

---

## Context

Compound Engineering can be summarized as `Plan -> Work -> Review -> Compound -> Repeat`. PK should own the `Compound` layer, not replace or depend on Trellis, AGENTS.md, or any project-specific workflow tool.

Current PK strengths:

- `.project-knowledge/` is project-local Markdown, not opaque memory.
- `practice / option / rule / context / constraint / session` already models reusable engineering knowledge.
- `pk-preflight` retrieves matching practices before implementation.
- `pk-auto-crystallize` records sessions and inferred candidates after tasks.
- `incubating` prevents new knowledge from immediately becoming stable guidance.
- `pk-lint` and `pk-govern` already cover recommendation pool lifecycle, duplicate candidates, evidence checks, promotion, demotion, and rejection.

Main gap:

- PK has lifecycle governance, but not full wiki governance. It does not yet govern page quality, stale evidence, orphan nodes, broken links, scope boundaries, ownership, audit completeness, or whether a knowledge node is actually retrievable and useful.

---

### Task 1: Make Task-Scoped Evidence Explicit

**Files:**
- Modify: `scripts/auto-crystallize-session.mjs`
- Modify: `plugins/pk/scripts/auto-crystallize-session.mjs`
- Modify: `templates/auto-crystallize-input-template.json`
- Modify: `plugins/pk/templates/auto-crystallize-input-template.json`
- Test: `tests/auto-crystallize.test.mjs`
- Docs: `README.md`, `README_EN.md`, `SKILL.md`, `plugins/pk/skills/pk-auto-crystallize/SKILL.md`

**Problem:**

`auto-crystallize` currently falls back to `git status --porcelain -uall` when `input.touchedFiles` is missing. In dirty worktrees this can attach unrelated user edits as source evidence.

**Design:**

Add explicit input fields:

```json
{
  "taskId": "05-14-tiktok-opportunity-products",
  "taskDir": ".tasks/05-14-tiktok-opportunity-products",
  "touchedFiles": [],
  "evidenceSource": "explicit | task-context | git-status",
  "allowGitStatusFallback": false
}
```

Evidence priority:

1. `touchedFiles` from input.
2. Files inferred from supported task/process metadata when `taskId` or `taskDir` is present.
3. `git status` only when `allowGitStatusFallback === true`.

Result should expose:

```json
{
  "auto": {
    "evidenceSource": "explicit",
    "evidenceConfidence": "high | medium | low",
    "touchedFiles": []
  }
}
```

**Steps:**

1. Add failing tests for explicit touched files producing `evidenceSource: explicit` and `evidenceConfidence: high`.
2. Add failing tests for missing touched files with `allowGitStatusFallback: false` producing no auto evidence and no generated incubating nodes.
3. Add failing tests for git fallback producing `evidenceSource: git-status` and `evidenceConfidence: low`.
4. Implement evidence source resolution in `resolveTouchedFiles`.
5. Update templates and skill docs to recommend explicit touched files.
6. Run `node --test tests/auto-crystallize.test.mjs`.

---

### Task 2: Add Generic Task Context Adapter

**Files:**
- Create: `scripts/task-adapters.mjs`
- Create: `plugins/pk/scripts/task-adapters.mjs`
- Modify: `scripts/auto-crystallize-session.mjs`
- Modify: `plugins/pk/scripts/auto-crystallize-session.mjs`
- Test: `tests/auto-crystallize.test.mjs`
- Docs: `README.md`, `README_EN.md`

**Goal:**

Let PK crystallize from generic task/process context without treating process documents as long-term source evidence.

**Design:**

Implement `loadTaskContext(projectRoot, input)` that supports:

- `taskDir`
- `taskId`
- `.tasks/<task>/prd.md`
- `.tasks/<task>/research/*.md`
- `.tasks/<task>/implement.jsonl`
- `.tasks/<task>/check.jsonl`
- `.tasks/<task>/task.json`
- `tasks/<task>/...` as a non-hidden equivalent
- `.trellis/tasks/<task>/...` only as compatibility with external workflow layouts

Use process files to build task text and session metadata, but do not add `.tasks/**`, `tasks/**`, or compatible workflow-process paths to `source_evidence` unless evidence policy explicitly allows them.

**Output shape:**

```json
{
  "title": "...",
  "topic": "...",
  "decisionSummary": "...",
  "candidateEvidenceHints": [],
  "processSources": [".tasks/.../prd.md"]
}
```

**Steps:**

1. Add fixture task under `tests/fixtures/task-context-sample/`.
2. Test that task text includes PRD title and relevant research summary.
3. Test that task/process files are recorded as process sources, not source evidence.
4. Merge adapter output into `autoCrystallizeSession` before preflight.
5. Run `node --test tests/auto-crystallize.test.mjs`.

---

### Task 3: Improve Preflight Matching Beyond Keywords

**Files:**
- Modify: `scripts/preflight-session.mjs`
- Modify: `plugins/pk/scripts/preflight-session.mjs`
- Modify: `scripts/scan-project.mjs` if directory hints are needed
- Test: `tests/preflight.test.mjs`
- Docs: `README.md`, `README_EN.md`

**Problem:**

Preflight currently matches task text against node id, title, summary, keywords, plus a hardcoded phrase list. This is acceptable for MVP but weak for large business repositories.

**Design:**

Add a small local intent extractor:

```js
{
  taskKinds: ["frontend-page", "crud-list", "api-client", "config", "test", "governance"],
  technologies: ["vue", "react", "node", "typescript"],
  pathHints: ["src/views", "src/api"],
  operationHints: ["create", "modify", "review", "debug"]
}
```

Extend node frontmatter with optional fields:

```yaml
applies_when:
  task_kinds: []
  technologies: []
  path_prefixes: []
does_not_apply_when:
  task_kinds: []
  path_prefixes: []
risk_if_misapplied: ""
```

**Steps:**

1. Add tests for a frontend CRUD task matching a practice via `applies_when.task_kinds`, even without exact keyword overlap.
2. Add tests for `does_not_apply_when` reducing or excluding a match.
3. Add `extractTaskIntent(taskText, options)` with deterministic rules only.
4. Include match reasons in preflight output:

```json
{
  "matchReasons": ["keyword:client", "task-kind:frontend-page", "path-prefix:src/views"]
}
```

5. Update docs and templates.
6. Run `node --test tests/preflight.test.mjs`.

---

### Task 4: Add Rich Evidence Metadata

**Files:**
- Modify: `scripts/knowledge-lib.mjs`
- Modify: `scripts/evidence-paths.mjs`
- Modify: `scripts/crystallize-session.mjs`
- Modify: `plugins/pk/scripts/knowledge-lib.mjs`
- Modify: `plugins/pk/scripts/evidence-paths.mjs`
- Modify: `plugins/pk/scripts/crystallize-session.mjs`
- Modify: `templates/practice-template.md`, `templates/option-template.md`, `templates/rule-template.md`
- Modify: matching plugin templates
- Test: `tests/knowledge-lib.test.mjs`, `tests/crystallize.test.mjs`, `tests/lint.test.mjs`

**Goal:**

Move from evidence paths only to auditable evidence records while keeping backward compatibility.

**Supported input:**

```yaml
source_evidence:
  - src/api/client.ts
  - path: src/runtime/scheduler.ts
    symbol: createScheduler
    reason: Demonstrates project-wide scheduler boundary.
    observed_pattern: Scheduler starts after login/user readiness.
    stability: stable
    last_verified_at: 2026-05-15
```

**Normalized graph node:**

```js
source_evidence: ["src/api/client.ts"],
evidence_records: [
  {
    path: "src/runtime/scheduler.ts",
    symbol: "createScheduler",
    reason: "...",
    stability: "stable",
    last_verified_at: "2026-05-15"
  }
]
```

**Steps:**

1. Add tests that old string evidence still works.
2. Add tests that object evidence is normalized and filtered by path policy.
3. Add lint warning for evidence records missing `reason` on stable nodes.
4. Update crystallize writing to preserve object evidence when supplied.
5. Run targeted tests.

---

### Task 5: Add Wiki Quality Lint Checks

**Files:**
- Modify: `scripts/lint-project-knowledge.mjs`
- Modify: `plugins/pk/scripts/lint-project-knowledge.mjs`
- Test: `tests/lint.test.mjs`
- Docs: `README.md`, `README_EN.md`, `SKILL.md`, `plugins/pk/skills/pk-lint/SKILL.md`

**Add checks:**

```text
wiki-thin-page
wiki-oversized-page
wiki-missing-summary
wiki-missing-required-section
wiki-bad-title
wiki-bad-id
wiki-wrong-directory
wiki-broken-node-link
wiki-orphan-node
wiki-no-preflight-surface
wiki-missing-session-ref
wiki-missing-decision-reason
```

**Initial policy:**

- Stable `practice`, `option`, and `rule` nodes require `summary`.
- Stable `practice` nodes should have at least one option or an explicit `status: archived`.
- Non-profile stable nodes should have `source_evidence` or `evidence_records`.
- Non-rejected knowledge nodes should have at least one graph edge, session ref, or evidence record.
- Node ids should match the existing safe id rules.

**Steps:**

1. Add tests for each issue code using minimal fixtures.
2. Implement checks as read-only report entries.
3. Include `wikiQuality` summary in lint output.
4. Run `node --test tests/lint.test.mjs`.

---

### Task 6: Add Staleness and Verification Governance

**Files:**
- Modify: `scripts/lint-project-knowledge.mjs`
- Modify: `scripts/knowledge-lib.mjs`
- Modify: `plugins/pk/scripts/lint-project-knowledge.mjs`
- Modify: `plugins/pk/scripts/knowledge-lib.mjs`
- Modify: `templates/*-template.md`
- Test: `tests/lint.test.mjs`, `tests/knowledge-lib.test.mjs`

**Design:**

Support optional fields:

```yaml
last_verified_at: 2026-05-15
stale_after_days: 90
owner: frontend-platform
reviewers:
  - dxm-web-maintainers
```

Lint issue codes:

```text
wiki-stale-node
wiki-stale-evidence
wiki-high-rank-stale-recommendation
wiki-missing-owner-for-strong-rule
```

Rules:

- High-ranking stable options with stale verification are warnings.
- Strong rules without owner are warnings.
- Incubating nodes may omit owner.
- Missing `last_verified_at` on stable rules is an info-level issue at first, not an error.

**Steps:**

1. Add tests for stale dates using fixed clock injection.
2. Add date parsing helpers with invalid-date lint warning.
3. Add staleness summary to lint output.
4. Run targeted tests.

---

### Task 7: Make Governance Safe by Default

**Files:**
- Modify: `scripts/govern-project-knowledge.mjs`
- Modify: `plugins/pk/scripts/govern-project-knowledge.mjs`
- Modify: `plugins/pk/scripts/pk-govern.mjs`
- Modify: `plugins/pk/skills/pk-govern/SKILL.md`
- Test: `tests/governance.test.mjs`, `tests/plugin-command-shell.test.mjs`
- Docs: `README.md`, `README_EN.md`

**Problem:**

`pk-govern` currently applies real write actions by default. For wiki governance, preview-first is safer.

**Design:**

Change behavior:

- `governProjectKnowledge(target, { dryRun: true })` is the default.
- CLI requires `--apply` for file moves or frontmatter changes.
- Existing tests that expect writes should pass `{ dryRun: false }` or CLI `--apply`.

Dry-run output:

```json
{
  "mode": "dry-run",
  "planned_action_count": 3,
  "planned_actions": []
}
```

**Steps:**

1. Add test that default governance does not modify files.
2. Update existing write tests to call apply mode.
3. Add CLI parsing for `--apply` and `--dry-run`.
4. Update skill wording to say: run lint first, preview governance, apply only after review.
5. Run governance and plugin shell tests.

---

### Task 8: Track Knowledge Usefulness, Not Just Adoption

**Files:**
- Modify: `scripts/crystallize-session.mjs`
- Modify: `scripts/preflight-session.mjs`
- Modify: `scripts/knowledge-lib.mjs`
- Modify: plugin copies of the same scripts
- Test: `tests/preflight.test.mjs`, `tests/crystallize.test.mjs`, `tests/knowledge-lib.test.mjs`

**Goal:**

Avoid Compound Engineering failure mode where knowledge is stored but never useful.

**Design:**

Extend `state/usage-index.json` entries:

```json
{
  "node-id": {
    "session_mentions": 2,
    "preflight_hits": 5,
    "adopted_count": 3,
    "rejected_after_hit_count": 1,
    "last_hit_at": "2026-05-15",
    "last_used_at": "2026-05-15",
    "last_session_id": "session-..."
  }
}
```

Add lint issues:

```text
wiki-never-hit
wiki-hit-but-never-adopted
wiki-frequently-rejected-after-hit
```

**Steps:**

1. Add tests that preflight can optionally record hits when called with `{ recordHits: true }`.
2. Keep default preflight read-only unless CLI/skill opts into recording.
3. Update crystallize to support `rejectedNodeIds` from input.
4. Update ranking to consider adoption more strongly than hit count.
5. Add lint checks for low usefulness.

---

### Task 9: Add Conflict Detection Between Rules and Practices

**Files:**
- Modify: `scripts/lint-project-knowledge.mjs`
- Modify: `plugins/pk/scripts/lint-project-knowledge.mjs`
- Test: `tests/lint.test.mjs`
- Docs: templates and README files

**Design:**

Add optional frontmatter:

```yaml
conflicts_with:
  - rule-direct-fetch-allowed
supersedes:
  - rule-old-http-client
superseded_by: rule-use-unified-client
```

Lint issue codes:

```text
wiki-active-conflicting-rules
wiki-superseded-node-still-recommended
wiki-duplicate-practice-scope
```

**Steps:**

1. Test two active stable rules with mutual `conflicts_with` produce warning.
2. Test superseded option in a recommendation pool produces warning.
3. Test rejected/superseded nodes are ignored by recommendation ranking.
4. Run lint and knowledge-lib tests.

---

### Task 10: Improve Graph UI for Wiki Governance

**Files:**
- Modify: `assets/graph/knowledge-graph.js`
- Modify: `assets/graph/knowledge-graph.css`
- Modify: `plugins/pk/assets/graph/knowledge-graph.js`
- Modify: `plugins/pk/assets/graph/knowledge-graph.css`
- Modify: `scripts/serve-project-knowledge.mjs`
- Modify: `plugins/pk/scripts/serve-project-knowledge.mjs`
- Test: `tests/project-graph-shell.test.mjs`, `tests/governance-api.test.mjs`

**Design:**

Expose wiki governance state in the graph detail panel:

- Quality issues count.
- Staleness status.
- Evidence confidence.
- Owner/reviewer.
- Preflight hit/adoption counts.
- Buttons: reject, mark verified, archive, link duplicate.

API additions:

```text
POST /api/governance/reject
POST /api/governance/verify
POST /api/governance/archive
POST /api/governance/link-duplicate
```

All APIs must:

- Restrict writes to `.project-knowledge/`.
- Validate node ids.
- Append to `log.md`.
- Rebuild graph artifacts after writes.

**Steps:**

1. Add shell tests that UI contains governance sections and action attributes.
2. Add API tests for mark verified and archive.
3. Implement minimal APIs by reusing governance helpers.
4. Keep visual design dense and operational, not decorative.

---

### Task 11: Update Initialization and Templates

**Files:**
- Modify: `scripts/init-project-knowledge.mjs`
- Modify: `plugins/pk/scripts/init-project-knowledge.mjs`
- Modify: all root and plugin templates under `templates/`
- Test: `tests/init.test.mjs`
- Docs: `README.md`, `README_EN.md`

**Goal:**

New `.project-knowledge/` repositories should start with governance-ready documents.

**Template additions:**

```yaml
applies_when: {}
does_not_apply_when: {}
risk_if_misapplied: ""
owner: ""
reviewers: []
last_verified_at: ""
stale_after_days: 90
conflicts_with: []
supersedes: []
superseded_by: ""
```

**Steps:**

1. Update templates.
2. Update init output docs: `workflow.md`, `scoring.md`, `overview.md`.
3. Add tests that initialized project includes evidence policy and governance-ready templates.
4. Run `node --test tests/init.test.mjs`.

---

### Task 12: Documentation and Migration Guide

**Files:**
- Modify: `README.md`
- Modify: `README_EN.md`
- Modify: `SKILL.md`
- Modify: `plugins/pk/.codex-plugin/plugin.json`
- Modify: `plugins/pk/.claude-plugin/plugin.json`
- Modify: relevant plugin skill docs
- Create: `docs/wiki-governance.md`
- Create: `docs/compound-engineering-alignment.md`

**Docs should explain:**

- PK is the knowledge compounding layer, not a replacement for project workflow systems.
- Recommended loop:

```text
Plan/Work/Review in project workflow
pk-preflight before implementation
pk-auto-crystallize after verified completion
pk-lint regularly
pk-govern --dry-run by default
pk-govern --apply only after review
```

- Difference between lifecycle governance and wiki governance.
- How to migrate old `source_evidence` strings to evidence records over time.
- How to tune stale thresholds and evidence policy.

**Steps:**

1. Add docs pages.
2. Update README quickstart.
3. Update plugin descriptions to include wiki governance.
4. Run plugin shell tests.

---

## Suggested Implementation Order

1. Task 1: task-scoped evidence.
2. Task 7: governance dry-run by default.
3. Task 5: wiki quality lint.
4. Task 6: staleness and verification.
5. Task 3: stronger preflight matching.
6. Task 4: rich evidence metadata.
7. Task 8: usefulness metrics.
8. Task 2: generic task context adapter.
9. Task 9: conflict detection.
10. Task 10: graph UI governance actions.
11. Task 11: templates and init.
12. Task 12: documentation.

This order reduces the highest risks first: wrong evidence, unsafe governance writes, and unbounded wiki drift.

## Verification

Run targeted tests as each task lands. Before merging the full branch, run:

```bash
npm test
```

Also run at least one manual smoke test against a temporary project:

```bash
npm run pk:init -- <temp-project>
npm run pk:preflight -- <temp-project> "add frontend CRUD page"
npm run pk:auto-crystallize -- <temp-project> --input <input.json>
npm run pk:lint -- <temp-project>
npm run pk:govern -- <temp-project>
npm run pk:govern -- <temp-project> --apply
npm run pk:serve -- <temp-project> 8124
```

Expected results:

- Preflight returns bounded, reasoned matches.
- Auto-crystallize does not use dirty git status unless explicitly allowed.
- Lint reports wiki quality, lifecycle, evidence, stale, and usefulness issues.
- Governance preview does not write files.
- Governance apply performs reversible changes only inside `.project-knowledge/`.
- Graph UI shows governance state and can perform reviewed actions.
