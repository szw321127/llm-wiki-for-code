# LLM Wiki for Code

Persistent codebase wiki for Codex and Claude Code.

LLM Wiki for Code is a local wiki and knowledge-graph workflow that stores durable codebase practices, candidate options, decisions, session records, and evidence relationships in a project-owned `.repowise/` directory. Later AI coding sessions can check existing conventions before scanning the same code again.

<p align="center">
  <a href="#verification"><img src="https://img.shields.io/badge/tests-node%20test-0f766e" alt="Tests"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="License"></a>
</p>
<p align="center">
  [中文文档](README.md) | English
</p>

The repository name is `llm-wiki-for-code`. The user-facing CLI is `repowise`; the current assistant plugin keeps the short name `pk` as a compatibility entrypoint.

## 30-Second Tour

```bash
npm install -g repowise
cd <project-root>
repowise init
```

What happens:

- `repowise init` creates `.repowise/` as a Markdown knowledge base.
- `repowise init` installs Repowise skills into Codex and Claude user-level and project-level skill directories.
- After that, agents can use `repowise-init` / `repowise-preflight` skills, while this repository can still use the `pk:*` development scripts.
- `.repowise/open-graph.cmd` opens a local graph for practices, options, rules, contexts, constraints, sessions, and source evidence.

## Who It Is For

- Developers using Codex, Claude Code, or similar coding agents across long-running repositories.
- Teams that want agent decisions to become reviewable project knowledge instead of disappearing into chat history.
- Maintainers who prefer local Markdown, explicit evidence, and reversible governance over opaque memory stores.

## Why Not Just `AGENTS.md` or `CLAUDE.md`?

`AGENTS.md` and `CLAUDE.md` are good instruction files. LLM Wiki for Code is a structured memory layer beside them:

| Need | Instruction file | LLM Wiki for Code |
| --- | --- | --- |
| Tell an agent current rules | Yes | Yes |
| Track candidate practices and alternatives | Manual | Built in |
| Link recommendations to stable source evidence | Manual | Built in |
| Record adoption history across sessions | No | Built in |
| Keep recommendation pools small and governed | No | Built in |
| Browse relationships as an Obsidian vault or graph | No | Built in |

Use instruction files for current operating rules. Use LLM Wiki for Code for practices, options, evidence, and decisions that should evolve over time.

## What It Solves

Long-running AI-assisted projects often accumulate repeated context work:

- Every new session starts by reading the same files again.
- Similar implementation scenarios drift into multiple inconsistent solutions.
- Task decisions disappear after the conversation ends.
- Large knowledge stores waste context if they are pasted wholesale into the model.
- Temporary plans, worktree files, and generated docs can pollute long-term evidence.

LLM Wiki for Code addresses this by:

- Running `pk-preflight` before a task to retrieve matching practices and recommendations.
- Running `pk-auto-crystallize` after a task to record adopted or incubating knowledge.
- Maintaining recommendation pools with adoption counts, scores, and governance rules.
- Keeping at most 3 recommended options for each practice.
- Returning only Top-K practices and evidence previews instead of loading the full knowledge base.

## Core Model

`.repowise/` is the project-level knowledge base and the Markdown source of truth. Graph data, indexes, Obsidian views, and the browser graph are generated from those Markdown files.

Main node types:

- `project_profile`: project-level profile, including stack, default rules, and preferred options.
- `practice`: reusable engineering practice, such as "route HTTP calls through a shared client".
- `option`: candidate implementation option under a practice.
- `rule`: binding or strongly preferred constraint.
- `context` / `constraint`: applicability and limitation nodes.
- `session`: a record of one task or conversation.

Knowledge lifecycle:

- New knowledge normally starts in `incubating`.
- Repeated adoption can make a node eligible for promotion.
- Each practice keeps a recommendation pool with at most 3 options.
- Demoted, rejected, or duplicate options are moved back to incubation instead of being physically deleted.

## Evidence Rules

`source_evidence` should point to stable project-relative paths, for example:

```text
src/api/client.ts
src/runtime/scheduler.ts
```

It can also be upgraded gradually to structured evidence records; old string paths remain compatible:

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

Graph nodes still normalize `source_evidence` to a path array while preserving `symbol`, `reason`, `observed_pattern`, `stability`, and `last_verified_at` in `evidence_records`. Structured evidence on stable nodes should include `reason`; otherwise `pk-lint` reports `wiki-evidence-record-missing-reason`.

The default policy filters common temporary files, local tool state, generated output, and process documents. The README is not the complete hardcoded rule list. Each knowledge base can tune the policy with `.repowise/evidence-policy.json`:

```json
{
  "useDefaultIgnores": true,
  "ignoredPrefixes": ["generated/"],
  "ignoredBasenames": ["local-note.md"],
  "allowedPrefixes": ["docs/adr/"],
  "allowAbsolutePaths": false
}
```

Fields:

- `useDefaultIgnores`: enables the built-in default filters.
- `ignoredPrefixes`: adds path prefixes to filter.
- `ignoredBasenames`: adds temporary filenames to filter.
- `allowedPrefixes`: allows stable subpaths that would otherwise match a default filter, such as `docs/adr/`.
- `allowAbsolutePaths`: keeps absolute local paths out of project knowledge by default.

The policy affects evidence previews in `pk-preflight`, touched files in `pk-auto-crystallize`, `source_evidence` written by `pk-crystallize`, and volatile evidence checks in `pk-lint`.

`pk-lint` also checks whether non-volatile `source_evidence` paths still exist in the project. Broken paths are reported as `node-missing-evidence-path`, with `repair_candidates` when same-basename files can be found. `pk-preflight` does not return missing evidence paths to the AI, and `verifyKnowledgeNode` refuses to refresh `last_verified_at` for nodes with broken evidence by default.

LLM Wiki for Code avoids storing complete code snippets as primary evidence. Preferred evidence is:

- Stable source-relative paths
- Practice summaries
- Option summaries
- Adoption counts
- Future-friendly metadata such as symbols, reasons, observed patterns, hashes, or short summaries when needed

## Requirements

- Node.js with native ESM support.
- npm for installing and running the CLI.
- Codex or Claude Code only if you want to install Repowise skills into those assistants; `repowise init` can target either one with flags.

This repository currently relies on Node's built-in test runner and local scripts.

## Installation

### 1. Install Globally

```bash
npm install -g repowise
```

Then run this from a target project root:

```bash
repowise init
```

You can also pass the target project explicitly:

```bash
repowise init E:\path\to\project
```

`repowise init` does three things:

- Creates the project knowledge base at `.repowise/`.
- Installs Codex skills at user level `%USERPROFILE%\.agents\skills\repowise-*` and project level `<project>/.agents/skills/repowise-*`.
- Installs Claude Code skills at user level `%USERPROFILE%\.claude\skills\repowise-*` and project level `<project>/.claude/skills/repowise-*`.

By default it installs both Codex and Claude Code skills. Common flags:

```bash
repowise init --codex
repowise init --claude
repowise init --no-global
repowise init --no-project-skills
repowise init --migrate
repowise init --force
```

- `--codex`: install Codex skills only.
- `--claude`: install Claude Code skills only.
- `--no-global`: skip user-level skills and write only project-level skills.
- `--no-project-skills`: skip project-level skills and write only user-level skills.
- `--migrate`: rename an existing `.project-knowledge/` vault to `.repowise/`.
- `--force`: overwrite generated Repowise skill/runtime files.

Fully restart Codex / Claude Code after installing or updating skills so the clients refresh their skill indexes.

### 2. Develop This Repository

When changing Repowise itself, clone the repository and run tests:

```bash
git clone <repository-url>
cd <repository-directory>
npm test
```

Development scripts still keep the `pk:*` names as internal compatibility entrypoints:

```bash
npm run pk:init -- <project-root>
npm run pk:preflight -- <project-root> "implement HTTP calls"
npm run pk:auto-crystallize -- <project-root> <auto-crystallize-input.json>
```

Regular users should prefer `repowise init`; the old `pk` plugin marketplace is no longer the recommended install path.

## Quick Start

```bash
npm install -g repowise
cd <project-root>
repowise init
```

Initialization creates `.repowise/` in the target project. Projects without this directory return `mode: no-knowledge` and skip project-knowledge workflows.

Agents can then use `repowise-preflight`, `repowise-status`, `repowise-graph`, and related skills. Repository development or CI can still use the local npm scripts:

```bash
npm test
npm run pk:status -- <project-root>
npm run pk:preflight -- <project-root> "implement HTTP calls"
npm run pk:auto-crystallize -- <project-root> <auto-crystallize-input.json>
npm run pk:lint -- <project-root>
npm run pk:govern -- <project-root>
npm run pk:graph -- <project-root>
npm run pk:serve -- <project-root> 8124
```

If `<project-root>` is omitted, scripts use the current working directory.

## Skill Entry Points

`repowise init` installs the same skill set into Codex and Claude Code according to the selected flags. Skill names are the same in both clients:

```text
repowise-init
repowise-preflight
repowise-status
repowise-graph
repowise-crystallize
repowise-auto-crystallize
repowise-lint
repowise-govern
repowise-serve
```

The old `plugins/pk/skills` bundle remains the source skill bundle during this migration; installation copies and rewrites it to `repowise-*` names.

## Common Workflows

### Initialize a Knowledge Base

```bash
repowise init <project-root>
```

This creates `.repowise/` with:

- `project-profile.md`
- `practices/`
- `options/`
- `rules/`
- `contexts/`
- `constraints/`
- `incubating/`
- `sessions/`
- `state/`
- `graph/`
- `_views/`
- `.obsidian/`
- `open-graph.cmd`

If a project is not initialized, `pk:preflight` and `pk:auto-crystallize` return `mode: no-knowledge`; they do not scan code or create a knowledge base.

### Inspect Current Status

```bash
npm run pk:status -- <project-root>
```

Status summarizes the current `.repowise/` state, including node counts and health signals.

### Preflight Before a Task

```bash
npm run pk:preflight -- <project-root> "implement HTTP calls"
```

Preflight reads `.repowise/` first:

- `mode: knowledge-hit` when existing practices match.
- `mode: needs-project-scan` when the project is initialized but knowledge is missing.
- `mode: no-knowledge` when the project is not initialized.

To control context size, default output is limited to:

- Top 5 practices
- Up to 5 evidence previews per node
- Up to 5 scan hints per category

Beyond keywords, titles, and summaries, preflight also extracts local task intent:

- `taskKinds`: such as `frontend-page`, `crud-list`, `api-client`, `config`, `test`, and `governance`.
- `technologies`: such as `vue`, `react`, `node`, and `typescript`.
- `pathHints`: for example `src/views/users/UserList.vue` can match a `src/views` prefix.
- `operationHints`: such as `create`, `modify`, `review`, and `debug`.

Knowledge nodes can use `applies_when` and `does_not_apply_when` to tune applicability. Matched practices include `matchReasons`, such as `task-kind:frontend-page` or `path-prefix:src/views`.

By default `pk-preflight` is read-only. To record hits in `state/usage-index.json`, explicitly run `npm run pk:preflight -- <project-root> --record-hits "implement HTTP calls"`; this increments `preflight_hits` and updates `last_hit_at`.

### Simulate Whether PK Helps AI

```bash
npm run pk:benchmark -- <project-root> <benchmark-samples.json> --k 3
```

The benchmark does not call an AI model. It runs `pk-preflight` against labeled task samples and reports:

- `recallAtK`: whether expected knowledge appears in the top K results.
- `precisionAtK`: how many top K results are expected or allowed relevant knowledge.
- `falsePositiveRate`: how often samples marked with `expectedNoMatches: true` still retrieve knowledge.
- `noiseRate`: how much unrelated knowledge appears in the top K results.
- `pass`: whether the sample file thresholds were met.

See `tests/fixtures/pk-benchmark/preflight-samples.json` for the sample format. This validates retrieval quality first; full AI usefulness should still be measured with task-level A/B runs.

### Auto-Crystallize After a Task

```bash
npm run pk:auto-crystallize -- <project-root> <auto-crystallize-input.json>
```

Input example:

```json
{
  "sessionId": "session-YYYY-MM-DD-topic",
  "title": "Task title",
  "topic": "Task topic",
  "taskText": "Task description",
  "decisionSummary": "One-sentence summary of the key decision.",
  "touchedFiles": ["src/example.ts"]
}
```

Behavior:

- If the task matches an existing practice, the selected recommendation is recorded as adopted.
- If no match exists and stable source files changed, an incubating practice and option may be created.
- If only temporary files, docs, or worktree files changed, only the session is recorded.
- Explicit `adoptedNodeIds`, `rejectedNodeIds`, `incubatingNodes`, or `stableUpdates` take precedence over inference.
- `taskId` or `taskDir` can load generic task/process context; `.tasks/<taskId>` and `tasks/<taskId>` are supported by default, with `.trellis/tasks/<taskId>` kept as compatibility for external workflow layouts. Process files are treated as `processSources` and task text, not long-term `source_evidence` by default; PK does not depend on Trellis.
- Dirty git status is not used as evidence by default; it is used as low-confidence evidence only when `allowGitStatusFallback: true`.

### Manually Crystallize Knowledge

```bash
npm run pk:crystallize -- <project-root> <crystallize-input.json>
```

Use manual crystallization when you already know which node should be adopted, rejected after preflight, created, or updated. `rejectedNodeIds` increments `rejected_after_hit_count`, which helps find knowledge that is often retrieved but rejected.

Templates:

```text
templates/crystallize-input-template.json
templates/auto-crystallize-input-template.json
```

### Lint Knowledge Health

```bash
npm run pk:lint -- <project-root>
```

The linter reports:

- `node-missing-evidence`: a node has no evidence.
- `node-volatile-evidence`: a node references temporary or unstable evidence.
- `node-missing-evidence-path`: a node references evidence paths that no longer exist, with same-basename repair candidates when available.
- `option-missing-practice`: an option has no valid parent practice.
- `practice-empty-recommendation-pool`: a practice has no recommended option.
- `incubating-promotion-candidate`: an incubating node reached the promotion threshold.
- `recommendation-pool-eviction-candidate`: a practice has more than 3 recommended options.
- `possible-duplicate-node`: two nodes may represent duplicate knowledge.
- `wiki-thin-page` / `wiki-oversized-page`: a page is too thin or too large.
- `wiki-missing-summary` / `wiki-missing-required-section`: stable knowledge lacks an explicit summary or required section.
- `wiki-bad-title` / `wiki-bad-id` / `wiki-wrong-directory`: title, id, or directory placement violates wiki conventions.
- `wiki-broken-node-link` / `wiki-orphan-node`: a wiki link is broken, or a node has no graph edge, session ref, or evidence.
- `wiki-no-preflight-surface`: a node has no keywords, making later `pk-preflight` matching weak.
- `wiki-missing-session-ref` / `wiki-missing-decision-reason`: a stable option lacks a source session or adoption rationale.
- `wiki-stale-node` / `wiki-stale-evidence`: a node or its evidence is older than `stale_after_days`.
- `wiki-high-rank-stale-recommendation`: a high-ranking option in a recommendation pool is stale.
- `wiki-missing-owner-for-strong-rule` / `wiki-missing-verification-date` / `wiki-invalid-verification-date`: a strong rule lacks ownership or usable verification metadata.
- `wiki-never-hit` / `wiki-hit-but-never-adopted` / `wiki-frequently-rejected-after-hit`: knowledge was never hit by preflight, was hit repeatedly without adoption, or is often rejected after being hit.
- `wiki-active-conflicting-rules` / `wiki-superseded-node-still-recommended` / `wiki-duplicate-practice-scope`: active rules conflict, superseded nodes remain in a recommendation surface, or multiple practices claim the same scope.

### Apply Reversible Governance

```bash
npm run pk:govern -- <project-root>
```

By default this command previews governance actions only. To write changes, run `npm run pk:govern -- <project-root> --apply`. Governance performs only reversible changes:

- Promotes eligible incubating nodes.
- Demotes options outside the top 3 recommendation pool.
- Marks strong duplicates as rejected and moves them to incubation.
- Never physically deletes knowledge files.

### Build or Serve the Graph

```bash
npm run pk:graph -- <project-root>
npm run pk:serve -- <project-root> 8124
```

On Windows, initialized projects can also launch:

```text
.repowise/open-graph.cmd
```

The graph page supports:

- Browsing relationships among practices, options, rules, contexts, and constraints.
- Inspecting recommendation pools and evidence.
- Rejecting unsuitable incubating nodes from the graph UI.

## Obsidian Compatibility

`.repowise/` can be opened as an Obsidian vault. The workflow maintains:

- `index.md`: knowledge-base entry point.
- `log.md`: operation log.
- `_views/practices.md`: practice-centered recommendation pools.
- `_views/incubating.md`: incubating knowledge index.
- `_views/sessions.md`: session index.
- `.obsidian/app.json`
- `.obsidian/graph.json`

Knowledge node files include `Links` sections with `[[node-id]]` references between related practices, options, rules, contexts, and constraints.

## Repository Structure

```text
.
|-- .agents/                       # Legacy local marketplace metadata
|-- .github/                       # GitHub issue and pull request templates
|-- .claude-plugin/                # Legacy Claude Code plugin metadata
|-- assets/                        # Project graph frontend assets
|-- docs/                          # Design and implementation plans
|-- knowledge/                     # Prototype/global graph data and regression assets
|-- plugins/pk/                    # Legacy source skill bundle copied to repowise-* skills by repowise init
|   |-- .codex-plugin/             # Legacy Codex plugin manifest
|   |-- .claude-plugin/            # Legacy Claude Code plugin manifest
|   |-- assets/                    # Plugin graph assets
|   |-- scripts/                   # Plugin command wrappers and shared scripts
|   `-- skills/                    # Skill definitions
|-- scripts/                       # npm script implementations
|-- seed/                          # Baseline knowledge used during initialization
|-- templates/                     # Markdown and JSON templates
|-- tests/                         # Node test suite
|-- CONTRIBUTING.md                # Contribution guide
|-- README.md                      # Chinese documentation
`-- README_EN.md                   # English documentation
```

## Verification

Run the full test suite:

```bash
npm test
```

The current tests cover the `repowise init` CLI, initialization, preflight context budgeting, crystallization, auto-crystallization, evidence filtering, recommendation-pool governance, Obsidian output, graph generation, graph runtime behavior, compatibility plugin command shells, and legacy Codex local plugin installation logic.

Before publishing:

```bash
npm test
```


