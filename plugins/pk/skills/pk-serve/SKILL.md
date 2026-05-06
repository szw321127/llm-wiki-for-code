---
name: pk-serve
description: Use when the user wants a local preview server for the project knowledge graph.
---

# PK Serve

Treat this skill as the primary plugin entrypoint for local graph preview.

## Required Behavior

- Determine the target project root from an explicit path; otherwise use the current working directory.
- Resolve `../../scripts/pk-serve.mjs` relative to this `SKILL.md` file.
- The wrapper delegates to `serve-project-knowledge.mjs`.
- Report the preview URL in Chinese after the server starts.
