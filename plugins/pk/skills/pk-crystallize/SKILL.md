---
name: pk-crystallize
description: Use when the user wants to persist a session or update project knowledge.
---

# PK Crystallize

Treat this skill as the primary plugin entrypoint for manual crystallization.

## Required Behavior

- Determine the target project root from an explicit path; otherwise use the current working directory.
- Resolve `../../scripts/pk-crystallize.mjs` relative to this `SKILL.md` file.
- The wrapper delegates to `crystallize-session.mjs`.
- Prefer passing a JSON input file after the project path when adopted nodes, incubating nodes, touched files, or stable updates need to be recorded.
- Expect `log.md` and Obsidian `_views/` to be refreshed after crystallization.
- Report the result in Chinese and include whether this run only wrote a session or also updated incubating or stable knowledge.

## JSON Input Shape

```json
{
  "sessionId": "session-YYYY-MM-DD-topic",
  "title": "本轮任务标题",
  "topic": "本轮任务主题",
  "decisionSummary": "一句话总结本轮关键决策。",
  "touchedFiles": [],
  "adoptedNodeIds": [],
  "incubatingNodes": [],
  "stableUpdates": []
}
```
