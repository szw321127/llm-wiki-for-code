---
name: pk-auto-crystallize
description: Use when the user wants task-end project knowledge crystallization to be inferred from the current task, touched files, and existing recommendation matches.
---

# PK Auto Crystallize

Treat this skill as the preferred task-end entrypoint when the user wants the project knowledge loop to update with minimal manual JSON authoring.

## Required Behavior

- Determine the target project root from an explicit path; otherwise use the current working directory.
- Resolve `../../scripts/pk-auto-crystallize.mjs` relative to this `SKILL.md` file.
- The wrapper delegates to `auto-crystallize-session.mjs`.
- If `.project-knowledge/project-profile.md` is missing, return `mode: no-knowledge` and skip crystallization entirely; do not scan touched files, create sessions, or create `.project-knowledge/`.
- Prefer passing a JSON input file after the project path when the task summary, touched files, or session id are known.
- If `adoptedNodeIds` is omitted, allow the script to infer adopted recommended options from `pk-preflight` matches.
- If `incubatingNodes` is omitted and no practice matches, allow the script to create an incubating practice plus candidate option from `taskText` and `touchedFiles`.
- Report the result in Chinese and include `mode`, inferred adopted nodes, generated incubating nodes, touched files, and the next suggested skill `pk-lint`; when skipped because knowledge is uninitialized, suggest `pk-init` instead.

## JSON Input Shape

```json
{
  "sessionId": "session-YYYY-MM-DD-topic",
  "title": "本轮任务标题",
  "topic": "本轮任务主题",
  "taskText": "用于匹配已有实践的任务描述",
  "decisionSummary": "一句话总结本轮关键决策。",
  "touchedFiles": [],
  "adoptedNodeIds": [],
  "incubatingNodes": [],
  "stableUpdates": []
}
```
