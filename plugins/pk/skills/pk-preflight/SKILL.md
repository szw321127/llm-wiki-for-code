---
name: pk-preflight
description: Use when the user wants to inspect project knowledge before starting a task and retrieve matching practices or local evidence hints.
---

# PK Preflight

Treat this skill as the project-knowledge entrypoint before implementation work starts.

## Required Behavior

- Accept a project root or `.project-knowledge/` directory plus a task description.
- Resolve `../../scripts/pk-preflight.mjs` relative to this `SKILL.md` file.
- The wrapper delegates to `preflight-session.mjs`.
- Report the result in Chinese, including whether existing knowledge was hit, which practices/options were recommended, or which local evidence paths should be inspected.
- If `.project-knowledge/project-profile.md` is missing, report `mode: no-knowledge` and do not scan local code or evidence; suggest `pk:pk-init` only if the user wants this project to opt in.
- Treat the output as a context-budgeted summary: by default only the top matching practices are returned, `source_evidence` is a preview, and `source_evidence_count` / `source_evidence_truncated` indicate whether more evidence exists.
- If `evidenceHintsTruncated` is true, inspect the referenced Markdown node or source files only when the current task needs deeper verification.
