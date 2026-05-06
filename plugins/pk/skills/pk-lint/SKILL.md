---
name: pk-lint
description: Use when the user wants a read-only health report for recommendation pools, evidence coverage, and project knowledge consistency.
---

# PK Lint

Treat this skill as the read-only maintenance check for project knowledge.

## Required Behavior

- Accept either a project root or a `.project-knowledge/` directory.
- Resolve `../../scripts/pk-lint.mjs` relative to this `SKILL.md` file.
- The wrapper delegates to `lint-project-knowledge.mjs`.
- Report the result in Chinese, including recommendation pools and any evidence, lifecycle, eviction, duplicate, or consistency issues.
- Do not modify or delete project knowledge files.
- Treat `incubating-promotion-candidate`, `recommendation-pool-eviction-candidate`, and `possible-duplicate-node` as human review prompts, not automatic promotion/deletion instructions.
