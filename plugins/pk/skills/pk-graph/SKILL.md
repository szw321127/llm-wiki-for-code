---
name: pk-graph
description: Use when the user wants to rebuild graph artifacts from `.repowise/`.
---

# PK Graph

Treat this skill as the primary plugin entrypoint for graph rebuilding.

## Required Behavior

- Accept either a project root or a `.repowise/` directory.
- Resolve `../../scripts/pk-graph.mjs` relative to this `SKILL.md` file.
- The wrapper delegates to `build-project-graph-data.mjs`.
- Report the generated files in Chinese, especially `graph-data.json`, `graph-index.json`, `knowledge-graph.html`, and refreshed Obsidian files under `index.md` and `_views/`.
