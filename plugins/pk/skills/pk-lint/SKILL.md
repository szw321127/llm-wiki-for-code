---
name: pk-lint
description: Use when the user wants a read-only health report for recommendation pools, evidence coverage, wiki quality, stale verification, ownership, and project knowledge consistency.
---

# PK Lint

Treat this skill as the read-only maintenance check for project knowledge.

## Required Behavior

- Accept either a project root or a `.project-knowledge/` directory.
- Resolve `../../scripts/pk-lint.mjs` relative to this `SKILL.md` file.
- The wrapper delegates to `lint-project-knowledge.mjs`.
- Report the result in Chinese, including recommendation pools and any evidence, lifecycle, eviction, duplicate, wiki quality, stale verification, usefulness, ownership, or consistency issues.
- Do not modify or delete project knowledge files.
- Treat `incubating-promotion-candidate`, `recommendation-pool-eviction-candidate`, `possible-duplicate-node`, `wiki-*`, stale verification, and usefulness findings as human review prompts, not automatic promotion/deletion instructions.
- Mention the `wikiQuality`, `staleness`, and `usefulness` summaries when they are present so the user can separate page-governance work from lifecycle-governance work and actual retrieval usefulness.
- When `wiki-evidence-record-missing-reason` appears, explain that structured `source_evidence` records on stable nodes should include a short `reason` describing why the path proves the practice, option, or rule.
- When `node-missing-evidence-path` appears, explain that the evidence path no longer exists in the project; include any `repair_candidates` as review hints, not automatic rewrites.
- When `wiki-never-hit`, `wiki-hit-but-never-adopted`, or `wiki-frequently-rejected-after-hit` appears, explain that the node may need better keywords/applicability, lower ranking, narrower scope, or archival.
- When `wiki-active-conflicting-rules`, `wiki-superseded-node-still-recommended`, or `wiki-duplicate-practice-scope` appears, explain that maintainers should resolve explicit conflicts, remove superseded nodes from recommendation surfaces, or merge/split overlapping practice scopes.
