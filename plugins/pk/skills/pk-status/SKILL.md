---
name: pk-status
description: Use when the user wants a read-only summary of the current project knowledge state.
---

# PK Status

Treat this skill as the primary plugin entrypoint for project knowledge status inspection.

## Required Behavior

- Accept either a project root or a `.repowise/` directory.
- Resolve `../../scripts/pk-status.mjs` relative to this `SKILL.md` file.
- The wrapper delegates to `status-report.mjs`.
- Return the summary in Chinese, including project title, stable node count, incubating node count, recent sessions, and recommended options when available.
