---
name: pk-govern
description: Use when the user wants to automatically apply reversible project knowledge governance actions.
---

# PK Govern

Treat this skill as the governance preview step after `pk-lint`; use apply mode only when the user explicitly wants the planned reversible actions written.

## Required Behavior

- Accept either a project root or a `.repowise/` directory.
- Resolve `../../scripts/pk-govern.mjs` relative to this `SKILL.md` file.
- The wrapper delegates to `govern-project-knowledge.mjs`.
- Default behavior is dry-run preview; pass `--apply` to write reversible governance changes.
- Report the result in Chinese, including planned or applied promoted, demoted, rejected, and duplicate-rejected nodes.
- Do not physically delete project knowledge files.
- When verifying a node, preserve the default guard that refuses to refresh `last_verified_at` if non-volatile `source_evidence` paths are missing.
- Explain that actions are reversible because stable nodes are moved back to incubation or marked rejected.



