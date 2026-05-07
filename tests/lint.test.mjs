import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { lintProjectKnowledge } from "../scripts/lint-project-knowledge.mjs";

const fixtureRoot = path.resolve("tests", "fixtures", "sample-project", ".project-knowledge");

test("lintProjectKnowledge reports recommendation pools and knowledge health issues", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "project-knowledge-lint-"));
  const knowledgeRoot = path.join(tempRoot, ".project-knowledge");
  await fs.cp(fixtureRoot, knowledgeRoot, { recursive: true });
  await writeOptionWithoutPractice(knowledgeRoot);
  await writePracticeWithoutOptions(knowledgeRoot);

  const report = await lintProjectKnowledge(knowledgeRoot);

  assert.equal(report.knowledgeRoot, knowledgeRoot);
  assert.ok(
    report.recommendationPools.some(
      (pool) =>
        pool.practice_id === "practice-http-client" &&
        pool.view_id === "project-current" &&
        pool.option_ids.includes("option-unified-client")
    )
  );
  assert.ok(report.issues.some((issue) => issue.code === "option-missing-practice"));
  assert.ok(report.issues.some((issue) => issue.code === "node-missing-evidence"));
  assert.ok(report.issues.some((issue) => issue.code === "practice-empty-recommendation-pool"));
});

test("lintProjectKnowledge reports lifecycle governance and duplicate candidates", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "project-knowledge-lint-governance-"));
  const knowledgeRoot = path.join(tempRoot, ".project-knowledge");
  await fs.cp(fixtureRoot, knowledgeRoot, { recursive: true });
  await writeDuplicatePractice(knowledgeRoot);
  await writeAdoptedIncubatingOption(knowledgeRoot);
  await writeStableOption(knowledgeRoot, "option-extra-a", "额外稳定方案 A", 94);
  await writeStableOption(knowledgeRoot, "option-extra-b", "额外稳定方案 B", 93);
  await writeStableOption(knowledgeRoot, "option-extra-c", "额外稳定方案 C", 92);
  await fs.writeFile(
    path.join(knowledgeRoot, "state", "usage-index.json"),
    `${JSON.stringify(
      {
        "option-adopted-incubating": {
          session_mentions: 5,
          adopted_count: 3,
          last_used_at: "2026-04-30",
          last_session_id: "session-governance"
        }
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  const report = await lintProjectKnowledge(knowledgeRoot);

  assert.ok(report.issues.some((issue) => issue.code === "incubating-promotion-candidate"));
  assert.ok(report.issues.some((issue) => issue.code === "recommendation-pool-eviction-candidate"));
  assert.ok(
    report.issues.some(
      (issue) =>
        issue.code === "possible-duplicate-node" &&
        issue.node_id === "practice-http-client" &&
        issue.duplicate_node_id === "practice-http-client-duplicate"
    )
  );
});

test("lintProjectKnowledge ignores manually rejected nodes for governance candidates", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "project-knowledge-lint-rejected-"));
  const knowledgeRoot = path.join(tempRoot, ".project-knowledge");
  await fs.cp(fixtureRoot, knowledgeRoot, { recursive: true });
  await writeDuplicatePractice(knowledgeRoot);
  await markRejected(path.join(knowledgeRoot, "practices", "practice-http-client-duplicate.md"));
  await markRejected(path.join(knowledgeRoot, "incubating", "options", "option-direct-call.md"));
  await fs.writeFile(
    path.join(knowledgeRoot, "state", "usage-index.json"),
    `${JSON.stringify(
      {
        "option-direct-call": {
          session_mentions: 5,
          adopted_count: 3,
          last_used_at: "2026-04-30",
          last_session_id: "session-rejected"
        }
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  const report = await lintProjectKnowledge(knowledgeRoot);

  assert.equal(
    report.issues.some(
      (issue) =>
        issue.code === "possible-duplicate-node" &&
        issue.duplicate_node_id === "practice-http-client-duplicate"
    ),
    false
  );
  assert.equal(
    report.issues.some(
      (issue) =>
        issue.code === "incubating-promotion-candidate" &&
        issue.node_id === "option-direct-call"
    ),
    false
  );
});

test("lintProjectKnowledge reports volatile source evidence paths", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "project-knowledge-lint-volatile-evidence-"));
  const knowledgeRoot = path.join(tempRoot, ".project-knowledge");
  await fs.cp(fixtureRoot, knowledgeRoot, { recursive: true });
  await writeVolatileEvidenceOption(knowledgeRoot);

  const report = await lintProjectKnowledge(knowledgeRoot);
  const issue = report.issues.find(
    (candidate) =>
      candidate.code === "node-volatile-evidence" &&
      candidate.node_id === "option-volatile-evidence"
  );

  assert.ok(issue);
  assert.deepEqual(issue.volatile_source_evidence, [
    "docs/engineering.md",
    "docs/plans/2026-04-28-agent-plan.md",
    ".worktrees/feature/src/api/client.ts",
    "task_plan.md",
    "findings.md",
    "progress.md"
  ]);
});

test("lintProjectKnowledge applies project evidence policy overrides", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "project-knowledge-lint-evidence-policy-"));
  const knowledgeRoot = path.join(tempRoot, ".project-knowledge");
  await fs.cp(fixtureRoot, knowledgeRoot, { recursive: true });
  await writeEvidencePolicy(knowledgeRoot, {
    ignoredPrefixes: ["generated/"],
    ignoredBasenames: ["local-note.md"],
    allowedPrefixes: ["docs/adr/"]
  });
  await writePolicyEvidenceOption(knowledgeRoot);

  const report = await lintProjectKnowledge(knowledgeRoot);
  const issue = report.issues.find(
    (candidate) =>
      candidate.code === "node-volatile-evidence" &&
      candidate.node_id === "option-policy-evidence"
  );

  assert.ok(issue);
  assert.deepEqual(issue.volatile_source_evidence, [
    "docs/tmp.md",
    "generated/client.ts",
    "src/runtime/local-note.md"
  ]);
});

async function writeOptionWithoutPractice(knowledgeRoot) {
  await fs.writeFile(
    path.join(knowledgeRoot, "options", "option-orphan.md"),
    `---
id: option-orphan
type: option
title: 孤立方案
summary: 没有关联 practice 的方案。
practice: practice-missing
base_score: 50
score_breakdown:
  consistency: 10
  efficiency: 10
  maintainability: 10
  extensibility: 10
  risk: 10
constraints: []
alternatives: []
keywords: []
status: active
maturity: stable
source_evidence: []
session_refs: []
---

## Summary

没有关联 practice 的方案。
`,
    "utf8"
  );
}

async function writeEvidencePolicy(knowledgeRoot, policy) {
  await fs.writeFile(
    path.join(knowledgeRoot, "evidence-policy.json"),
    `${JSON.stringify(policy, null, 2)}\n`,
    "utf8"
  );
}

async function writeVolatileEvidenceOption(knowledgeRoot) {
  await fs.writeFile(
    path.join(knowledgeRoot, "options", "option-volatile-evidence.md"),
    `---
id: option-volatile-evidence
type: option
title: 临时证据方案
summary: 包含临时证据路径的方案。
practice: practice-http-client
base_score: 55
score_breakdown:
  consistency: 11
  efficiency: 11
  maintainability: 11
  extensibility: 11
  risk: 11
constraints: []
alternatives: []
keywords: [http, request]
status: active
maturity: stable
source_evidence:
  - docs/engineering.md
  - docs/plans/2026-04-28-agent-plan.md
  - .worktrees/feature/src/api/client.ts
  - task_plan.md
  - findings.md
  - progress.md
  - src/api/client.ts
session_refs: []
---

## Summary

包含临时证据路径的方案。
`,
    "utf8"
  );
}

async function writePolicyEvidenceOption(knowledgeRoot) {
  await fs.writeFile(
    path.join(knowledgeRoot, "options", "option-policy-evidence.md"),
    `---
id: option-policy-evidence
type: option
title: 可配置证据方案
summary: 包含项目级证据策略覆盖的方案。
practice: practice-http-client
base_score: 55
score_breakdown:
  consistency: 11
  efficiency: 11
  maintainability: 11
  extensibility: 11
  risk: 11
constraints: []
alternatives: []
keywords: [http, request]
status: active
maturity: stable
source_evidence:
  - docs/adr/http-client.md
  - docs/tmp.md
  - generated/client.ts
  - src/runtime/local-note.md
  - src/api/client.ts
session_refs: []
---

## Summary

包含项目级证据策略覆盖的方案。
`,
    "utf8"
  );
}

async function writeDuplicatePractice(knowledgeRoot) {
  await fs.writeFile(
    path.join(knowledgeRoot, "practices", "practice-http-client-duplicate.md"),
    `---
id: practice-http-client-duplicate
type: practice
title: HTTP 调用封装实践
summary: 当前项目中的远程调用应优先通过统一封装层收敛。
contexts: []
constraints: []
rules: []
option_ids: []
keywords: [http, request]
status: active
maturity: stable
source_evidence: [src/api/duplicate.ts]
session_refs: []
---

## Summary

当前项目中的远程调用应优先通过统一封装层收敛。
`,
    "utf8"
  );
}

async function writeAdoptedIncubatingOption(knowledgeRoot) {
  await fs.writeFile(
    path.join(knowledgeRoot, "incubating", "options", "option-adopted-incubating.md"),
    `---
id: option-adopted-incubating
type: option
title: 已采纳孵化方案
summary: 已被多次采纳的孵化方案。
practice: practice-http-client
base_score: 86
score_breakdown:
  consistency: 17
  efficiency: 17
  maintainability: 17
  extensibility: 17
  risk: 18
constraints: []
alternatives: []
keywords: [http, request]
status: active
maturity: incubating
source_evidence: [src/api/adopted-incubating.ts]
session_refs: []
---

## Summary

已被多次采纳的孵化方案。
`,
    "utf8"
  );
}

async function writeStableOption(knowledgeRoot, id, title, baseScore) {
  await fs.writeFile(
    path.join(knowledgeRoot, "options", `${id}.md`),
    `---
id: ${id}
type: option
title: ${title}
summary: ${title}。
practice: practice-http-client
base_score: ${baseScore}
score_breakdown:
  consistency: 18
  efficiency: 18
  maintainability: 18
  extensibility: 18
  risk: ${baseScore - 72}
constraints: []
alternatives: []
keywords: [http, request]
status: active
maturity: stable
source_evidence: [src/api/${id}.ts]
session_refs: []
---

## Summary

${title}。
`,
    "utf8"
  );
}

async function writePracticeWithoutOptions(knowledgeRoot) {
  await fs.writeFile(
    path.join(knowledgeRoot, "practices", "practice-empty.md"),
    `---
id: practice-empty
type: practice
title: 空实践
summary: 没有候选方案的实践。
contexts: []
constraints: []
rules: []
option_ids: []
keywords: []
status: active
maturity: stable
source_evidence: [docs/empty.md]
session_refs: []
---

## Summary

没有候选方案的实践。
`,
    "utf8"
  );
}

async function markRejected(filePath) {
  const source = await fs.readFile(filePath, "utf8");
  const nextSource = source.replace(/maturity: (stable|incubating)/, "maturity: $1\nreview_status: rejected");
  await fs.writeFile(filePath, nextSource, "utf8");
}
