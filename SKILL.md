---
name: llm-wiki-for-code
description: Build and maintain a project-serving knowledge base inside the current project's `.project-knowledge/` directory. Use when Codex should initialize a project knowledge base, inspect current project knowledge status, rebuild the project knowledge graph, or crystallize stable knowledge from the current task into project-local Markdown.
---

# LLM Wiki for Code Skill

Treat `.project-knowledge/` as the only fact source for a project's persisted knowledge.

## Core Rules

- Write project knowledge only under `.project-knowledge/`
- Read only local code and local docs for `pk-init`
- Do not read `git log` or browse the web for project analysis
- Do not modify business code as part of knowledge maintenance
- Keep Obsidian-facing files (`index.md`, `log.md`, `_views/`, `.obsidian/`) derived from Markdown knowledge
- Before finishing a task, do one lightweight crystallization judgment
- Prefer `pk-auto-crystallize` after task completion when touched files and a task summary are available; pass explicit `touchedFiles` when possible, and use git-status fallback only when explicitly intended
- `pk-auto-crystallize` may read generic `taskId` / `taskDir` process context from `.tasks/`, `tasks/`, or compatible external workflow layouts; process files are not durable source evidence by default
- If `.project-knowledge/project-profile.md` is missing, skip project knowledge workflows and suggest `pk-init` only when the user wants this project to opt in
- Use `pk-crystallize` with a JSON input file when recording hand-curated adopted nodes or stable updates

## Skill Entry Points

- `pk-init`: analyze the current project and bootstrap `.project-knowledge/`
- `pk-preflight`: inspect project knowledge before a task and return matching practices, match reasons, task intent, or local evidence hints
- `pk-status`: summarize current project knowledge state
- `pk-graph`: rebuild graph data and graph page from `.project-knowledge/`
- `pk-crystallize`: persist a session and, when justified, update stable or incubating knowledge
- `pk-auto-crystallize`: infer adopted recommendations or new incubating candidates from task text and touched files
- `pk-lint`: report recommendation-pool lifecycle governance, evidence health, wiki quality, stale verification, ownership, and possible duplicate knowledge without modifying files
- `pk-govern`: preview reversible governance actions by default; apply promotion, demotion, and strong duplicate rejection only when explicitly requested
- `pk-serve`: serve the project knowledge graph locally

## Knowledge Rules

- Markdown is the only fact source
- New stable insights should default into low-score incubating space unless they are already clearly project defaults
- `session` records are always allowed; knowledge nodes require stable evidence
- `source_evidence` may be a string path or a structured record with `path`, `symbol`, `reason`, `observed_pattern`, `stability`, and `last_verified_at`; stable structured records should include `reason`
- `.project-knowledge/` is an Obsidian-compatible vault; generated node bodies should keep `Links` sections useful for backlink navigation
- `pk-preflight` output is context-budgeted: load full node Markdown or source files only after a summarized match needs deeper verification
- `pk-preflight` matches through keywords plus deterministic task intent; use `applies_when` / `does_not_apply_when` for task kinds, technologies, and path prefixes when keywords are too weak
- `pk-preflight` remains read-only unless explicitly invoked with hit recording, which updates `preflight_hits` and `last_hit_at` in `state/usage-index.json`
- `pk-lint` governance findings are review prompts only: promotion candidates, eviction candidates, stale verification, wiki quality findings, and possible duplicates still require human judgment before moving or deleting files
- `pk-lint` also reports usefulness signals such as never-hit knowledge, hit-but-never-adopted knowledge, and recommendations frequently rejected after a hit
- `pk-lint` reports conflict signals including active conflicting rules, superseded nodes still exposed by recommendations, and duplicate practice scopes
- Stable `practice`, `option`, and `rule` nodes should have an explicit summary, useful keywords, durable evidence, and verification metadata; strong rules should have an owner
- Use `conflicts_with`, `supersedes`, `superseded_by`, and `scope` to make rule/practice conflicts explicit and auditable
- `pk-govern` may move Markdown nodes between stable and incubating directories, but it must not physically delete knowledge files

## Crystallization Input

`pk-auto-crystallize` accepts a JSON input file after the project path. Use it at task end when the task adopted existing recommendations or produced a new code practice that should start in incubation.

```json
{
  "sessionId": "session-YYYY-MM-DD-topic",
  "title": "本轮任务标题",
  "topic": "本轮任务主题",
  "taskText": "用于匹配已有实践的任务描述",
  "taskId": "",
  "taskDir": "",
  "decisionSummary": "一句话总结本轮关键决策。",
  "touchedFiles": [],
  "adoptedNodeIds": [],
  "rejectedNodeIds": [],
  "incubatingNodes": [],
  "stableUpdates": []
}
```

