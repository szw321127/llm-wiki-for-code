# Changelog

## 2026-05-15

- Added wiki governance for project knowledge, including stale verification checks, ownership signals, duplicate/conflict detection, reversible graph actions, and dry-run governance defaults.
- Added generic task context adapters for `.tasks/<taskId>` and `tasks/<taskId>`, with `.trellis/tasks/<taskId>` kept only as a compatibility fallback.
- Added `pk:benchmark` to simulate whether PK helps AI by measuring preflight recall, precision, noise, and false positives against labeled task samples.
- Added evidence-path governance: `pk-lint` reports missing `source_evidence` paths with repair candidates, `pk-preflight` filters missing evidence hints, and node verification refuses to refresh broken-evidence nodes by default.
- Updated root and plugin scripts, skill docs, templates, graph UI governance actions, and regression coverage for the Compound Engineering PK governance work.
