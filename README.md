# Project Knowledge

Project Knowledge is a local knowledge-base and knowledge-graph workflow for Codex and Claude Code. It stores durable project practices, candidate options, decisions, session records, and evidence relationships in a project-owned `.project-knowledge/` directory so later AI sessions can check existing conventions before scanning the same code again.

The npm package name is currently `llm-wiki-for-code`, while the user-facing tool and plugin are named Project Knowledge / `pk`.

Chinese documentation: [READE_CN.md](READE_CN.md)

## What It Solves

Long-running AI-assisted projects often accumulate repeated context work:

- Every new session starts by reading the same files again.
- Similar implementation scenarios drift into multiple inconsistent solutions.
- Task decisions disappear after the conversation ends.
- Large knowledge stores waste context if they are pasted wholesale into the model.
- Temporary plans, worktree files, and generated docs can pollute long-term evidence.

Project Knowledge addresses this by:

- Running `pk-preflight` before a task to retrieve matching practices and recommendations.
- Running `pk-auto-crystallize` after a task to record adopted or incubating knowledge.
- Maintaining recommendation pools with adoption counts, scores, and governance rules.
- Keeping at most 3 recommended options for each practice.
- Returning only Top-K practices and evidence previews instead of loading the full knowledge base.

## Core Model

`.project-knowledge/` is the project-level knowledge base and the Markdown source of truth. Graph data, indexes, Obsidian views, and the browser graph are generated from those Markdown files.

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

`source_evidence` should point only to stable project source paths, for example:

```text
src/api/client.ts
src/runtime/scheduler.ts
```

These paths are intentionally excluded as long-term evidence:

- `.worktrees/`
- `.project-knowledge/`
- `.agents/`
- `.codex/`
- `node_modules/`
- `docs/`
- `task_plan.md`
- `findings.md`
- `progress.md`

The reason is that these files are often plans, collaboration artifacts, generated output, local tool state, or documents that may be cleaned up later. They can help the current session, but they should not justify long-term project recommendations.

Project Knowledge also avoids storing complete code snippets as primary evidence. Preferred evidence is:

- Stable source-relative paths
- Practice summaries
- Option summaries
- Adoption counts
- Future-friendly metadata such as symbols, hashes, or short summaries when needed

## Requirements

- Node.js with native ESM support.
- npm for running the bundled scripts.
- Codex or Claude Code only if you want to install the `pk` skills as an assistant plugin.

This repository currently relies on Node's built-in test runner and local scripts.

## Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd <repository-directory>
```

Run the test suite to confirm the local environment:

```bash
npm test
```

### 2. Use as a Plain CLI

The scripts can be used directly without installing any assistant plugin:

```bash
npm run pk:init -- <project-root>
npm run pk:preflight -- <project-root> "implement HTTP calls"
npm run pk:auto-crystallize -- <project-root> <auto-crystallize-input.json>
```

This mode is useful for manual use, CI jobs, or other automation.

### 3. Install for Codex

To use the `pk:*` skills directly inside Codex:

```bash
npm run codex:install
```

The installer:

- Creates a local plugin link from the current repository's `plugins/pk/` directory.
- Writes a `local-project-knowledge` marketplace entry under the user's `.agents/plugins/marketplace.json`.
- Marks the plugin as `INSTALLED_BY_DEFAULT`.

Fully restart Codex after installation. The skill list should then include:

```text
pk-init
pk-preflight
pk-status
pk-graph
pk-crystallize
pk-auto-crystallize
pk-lint
pk-govern
pk-serve
```

After updating this repository, run the installer again:

```bash
npm run codex:install
```

Uninstall:

```bash
npm run codex:uninstall
```

### 4. Install for Claude Code

Use Claude Code's standard plugin commands:

```bash
/plugin marketplace add <repository-root>
/plugin install pk@local-project-knowledge
```

Example:

```bash
/plugin marketplace add /path/to/universal-practice-knowledge-graph
/plugin install pk@local-project-knowledge
```

This registers the `local-project-knowledge` marketplace and installs the `pk` plugin from `plugins/pk/`.

Fully restart Claude Code after installation. The skill list should include:

```text
pk-init
pk-preflight
pk-status
pk-graph
pk-crystallize
pk-auto-crystallize
pk-lint
pk-govern
pk-serve
```

Update:

```bash
/plugin update pk@local-project-knowledge
```

Uninstall:

```bash
/plugin uninstall pk@local-project-knowledge
```

### 5. Initialize a Target Project

After installing or cloning the tool, opt a target project into the workflow:

```bash
npm run pk:init -- <project-root>
```

Or from Codex:

```text
pk-init
```

Initialization creates `.project-knowledge/` in the target project. Projects without this directory return `mode: no-knowledge` and skip project-knowledge workflows.

## Quick Start

```bash
npm test
npm run pk:init -- <project-root>
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

The repository ships both a Codex plugin and a Claude Code plugin.

Codex skill names:

```text
pk-init
pk-preflight
pk-status
pk-graph
pk-crystallize
pk-auto-crystallize
pk-lint
pk-govern
pk-serve
```

Claude Code skill names:

```text
pk-init
pk-preflight
pk-status
pk-graph
pk-crystallize
pk-auto-crystallize
pk-lint
pk-govern
pk-serve
```

## Common Workflows

### Initialize a Knowledge Base

```bash
npm run pk:init -- <project-root>
```

This creates `.project-knowledge/` with:

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

Status summarizes the current `.project-knowledge/` state, including node counts and health signals.

### Preflight Before a Task

```bash
npm run pk:preflight -- <project-root> "implement HTTP calls"
```

Preflight reads `.project-knowledge/` first:

- `mode: knowledge-hit` when existing practices match.
- `mode: needs-project-scan` when the project is initialized but knowledge is missing.
- `mode: no-knowledge` when the project is not initialized.

To control context size, default output is limited to:

- Top 5 practices
- Up to 5 evidence previews per node
- Up to 5 scan hints per category

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
- Explicit `adoptedNodeIds`, `incubatingNodes`, or `stableUpdates` take precedence over inference.

### Manually Crystallize Knowledge

```bash
npm run pk:crystallize -- <project-root> <crystallize-input.json>
```

Use manual crystallization when you already know which node should be adopted, created, or updated.

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
- `option-missing-practice`: an option has no valid parent practice.
- `practice-empty-recommendation-pool`: a practice has no recommended option.
- `incubating-promotion-candidate`: an incubating node reached the promotion threshold.
- `recommendation-pool-eviction-candidate`: a practice has more than 3 recommended options.
- `possible-duplicate-node`: two nodes may represent duplicate knowledge.

### Apply Reversible Governance

```bash
npm run pk:govern -- <project-root>
```

Governance performs only reversible changes:

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
.project-knowledge/open-graph.cmd
```

The graph page supports:

- Browsing relationships among practices, options, rules, contexts, and constraints.
- Inspecting recommendation pools and evidence.
- Rejecting unsuitable incubating nodes from the graph UI.

## Obsidian Compatibility

`.project-knowledge/` can be opened as an Obsidian vault. The workflow maintains:

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
|-- .agents/                       # Local Codex marketplace metadata
|-- .claude-plugin/                # Claude Code marketplace metadata
|-- assets/                        # Project graph frontend assets
|-- docs/                          # Design and implementation plans
|-- knowledge/                     # Prototype/global graph data and regression assets
|-- plugins/pk/                    # Codex and Claude Code plugin package
|   |-- .codex-plugin/             # Codex plugin manifest
|   |-- .claude-plugin/            # Claude Code plugin manifest
|   |-- assets/                    # Plugin graph assets
|   |-- scripts/                   # Plugin command wrappers and shared scripts
|   `-- skills/                    # Skill definitions
|-- scripts/                       # npm script implementations
|-- seed/                          # Baseline knowledge used during initialization
|-- templates/                     # Markdown and JSON templates
|-- tests/                         # Node test suite
|-- SKILL.md                       # Root skill definition
|-- README.md                      # English documentation
`-- READE_CN.md                    # Chinese documentation
```

## Verification

Run the full test suite:

```bash
npm test
```

The current tests cover initialization, preflight context budgeting, crystallization, auto-crystallization, evidence filtering, recommendation-pool governance, Obsidian output, graph generation, graph runtime behavior, plugin command shells, Codex local plugin installation, and publish-content sanitization.

## Release Check

The repository includes `tests/content-sanitization.test.mjs` to prevent local absolute paths, user names, and unrelated project residue from entering publishable content.

Before publishing:

```bash
npm test
```
