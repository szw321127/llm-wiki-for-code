---
name: pk-govern
description: Use when the user wants to automatically apply reversible project knowledge governance actions.
---

# PK Govern

Treat this skill as the write-capable maintenance step after `pk:pk-lint`.

## Required Behavior

- Accept either a project root or a `.project-knowledge/` directory.
- Resolve `../../scripts/pk-govern.mjs` relative to this `SKILL.md` file.
- The wrapper delegates to `govern-project-knowledge.mjs`.
- Report the result in Chinese, including promoted, demoted, rejected, and duplicate-rejected nodes.
- Do not physically delete project knowledge files.
- Explain that actions are reversible because stable nodes are moved back to incubation or marked rejected.
