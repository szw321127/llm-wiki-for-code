---
name: pk-init
description: Use when the user wants to initialize `.project-knowledge/` for the current local project.
---

# PK Init

Treat this skill as the primary plugin entrypoint for project knowledge initialization.

## Required Behavior

- Determine the target project root from an explicit user path; otherwise use the current working directory.
- Read only local code and local docs.
- Do not modify business code while initializing knowledge.
- Resolve `../../scripts/pk-init.mjs` relative to this `SKILL.md` file, not relative to the target project.
- The wrapper delegates to `init-project-knowledge.mjs`.
- Report the result in Chinese and include the project root, the `.project-knowledge/` path, Obsidian entry files (`index.md`, `log.md`, `_views/`), and suggested next skills `pk-status` and `pk-graph`.
