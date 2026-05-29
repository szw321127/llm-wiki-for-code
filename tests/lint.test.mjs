import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { lintProjectKnowledge } from "../scripts/lint-project-knowledge.mjs";

const fixtureRoot = path.resolve("tests", "fixtures", "sample-project", ".repowise");

test("lintProjectKnowledge reports recommendation pools and knowledge health issues", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "project-knowledge-lint-"));
  const knowledgeRoot = path.join(tempRoot, ".repowise");
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
  const knowledgeRoot = path.join(tempRoot, ".repowise");
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
  const knowledgeRoot = path.join(tempRoot, ".repowise");
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
  const knowledgeRoot = path.join(tempRoot, ".repowise");
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

test("lintProjectKnowledge reports broken source evidence paths with repair candidates", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "project-knowledge-lint-broken-evidence-"));
  const knowledgeRoot = path.join(tempRoot, ".repowise");
  await fs.cp(fixtureRoot, knowledgeRoot, { recursive: true });
  await fs.mkdir(path.join(tempRoot, "src", "api"), { recursive: true });
  await fs.mkdir(path.join(tempRoot, "src", "pages"), { recursive: true });
  await fs.writeFile(path.join(tempRoot, "src", "api", "client.ts"), "export const client = true;\n", "utf8");
  await fs.writeFile(path.join(tempRoot, "src", "pages", "demo.ts"), "export const demo = true;\n", "utf8");
  await writeBrokenEvidenceOption(knowledgeRoot);

  const report = await lintProjectKnowledge(knowledgeRoot);
  const issue = report.issues.find(
    (candidate) =>
      candidate.code === "node-missing-evidence-path" &&
      candidate.node_id === "option-broken-evidence-path"
  );

  assert.ok(issue);
  assert.deepEqual(issue.missing_source_evidence, ["src/legacy/client.ts"]);
  assert.deepEqual(issue.repair_candidates, {
    "src/legacy/client.ts": ["src/api/client.ts"]
  });
});

test("lintProjectKnowledge applies project evidence policy overrides", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "project-knowledge-lint-evidence-policy-"));
  const knowledgeRoot = path.join(tempRoot, ".repowise");
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

test("lintProjectKnowledge reports evidence records missing reasons on stable nodes", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "project-knowledge-lint-rich-evidence-"));
  const knowledgeRoot = path.join(tempRoot, ".repowise");
  await fs.cp(fixtureRoot, knowledgeRoot, { recursive: true });
  await writeRichEvidenceWithoutReasonOption(knowledgeRoot);

  const report = await lintProjectKnowledge(knowledgeRoot);

  assert.ok(
    report.issues.some(
      (issue) =>
        issue.code === "wiki-evidence-record-missing-reason" &&
        issue.node_id === "option-rich-evidence-without-reason" &&
        issue.evidence_path === "src/api/missing-reason.ts"
    )
  );
});


test("lintProjectKnowledge reports wiki quality issues", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "project-knowledge-lint-wiki-quality-"));
  const knowledgeRoot = path.join(tempRoot, ".repowise");
  await fs.cp(fixtureRoot, knowledgeRoot, { recursive: true });
  await writeThinPractice(knowledgeRoot);
  await writeNoPreflightSurfaceOption(knowledgeRoot);
  await writeOrphanRule(knowledgeRoot);
  await writeBadIdOption(knowledgeRoot);
  await writeOversizedPractice(knowledgeRoot);
  await writeBrokenLinkOption(knowledgeRoot);
  await writeMissingSessionAndDecisionOption(knowledgeRoot);

  const report = await lintProjectKnowledge(knowledgeRoot);

  assert.ok(report.wikiQuality);
  assert.ok(report.wikiQuality.issue_count >= 4);
  assert.ok(report.issues.some((issue) => issue.code === "wiki-thin-page" && issue.node_id === "practice-thin-page"));
  assert.ok(report.issues.some((issue) => issue.code === "wiki-missing-summary" && issue.node_id === "practice-thin-page"));
  assert.ok(report.issues.some((issue) => issue.code === "wiki-missing-required-section" && issue.node_id === "practice-thin-page"));
  assert.ok(report.issues.some((issue) => issue.code === "wiki-bad-title" && issue.node_id === "practice-thin-page"));
  assert.ok(report.issues.some((issue) => issue.code === "wiki-oversized-page" && issue.node_id === "practice-oversized-page"));
  assert.ok(report.issues.some((issue) => issue.code === "wiki-no-preflight-surface" && issue.node_id === "option-no-preflight-surface"));
  assert.ok(report.issues.some((issue) => issue.code === "wiki-orphan-node" && issue.node_id === "rule-orphan"));
  assert.ok(report.issues.some((issue) => issue.code === "wiki-bad-id" && issue.node_id === "bad id"));
  assert.ok(report.issues.some((issue) => issue.code === "wiki-wrong-directory" && issue.node_id === "bad id"));
  assert.ok(report.issues.some((issue) => issue.code === "wiki-broken-node-link" && issue.node_id === "option-broken-link" && issue.linked_node_id === "missing-node"));
  assert.ok(report.issues.some((issue) => issue.code === "wiki-missing-session-ref" && issue.node_id === "option-missing-session-decision"));
  assert.ok(report.issues.some((issue) => issue.code === "wiki-missing-decision-reason" && issue.node_id === "option-missing-session-decision"));
});

test("lintProjectKnowledge reports stale verification and ownership issues", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "project-knowledge-lint-stale-"));
  const knowledgeRoot = path.join(tempRoot, ".repowise");
  await fs.cp(fixtureRoot, knowledgeRoot, { recursive: true });
  await writeStaleOption(knowledgeRoot);
  await writeStrongRuleWithoutOwner(knowledgeRoot);
  await writeInvalidVerificationRule(knowledgeRoot);

  const report = await lintProjectKnowledge(knowledgeRoot, { now: "2026-05-15T00:00:00.000Z" });

  assert.ok(report.staleness);
  assert.ok(report.staleness.issue_count >= 3);
  assert.ok(report.issues.some((issue) => issue.code === "wiki-stale-node" && issue.node_id === "option-stale-recommendation"));
  assert.ok(report.issues.some((issue) => issue.code === "wiki-stale-evidence" && issue.node_id === "option-stale-recommendation"));
  assert.ok(report.issues.some((issue) => issue.code === "wiki-high-rank-stale-recommendation" && issue.node_id === "option-stale-recommendation"));
  assert.ok(report.issues.some((issue) => issue.code === "wiki-missing-owner-for-strong-rule" && issue.node_id === "rule-strong-without-owner"));
  assert.ok(report.issues.some((issue) => issue.code === "wiki-missing-verification-date" && issue.node_id === "rule-strong-without-owner"));
  assert.ok(report.issues.some((issue) => issue.code === "wiki-invalid-verification-date" && issue.node_id === "rule-invalid-verification-date"));
});

test("lintProjectKnowledge reports low-usefulness knowledge issues", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "project-knowledge-lint-usefulness-"));
  const knowledgeRoot = path.join(tempRoot, ".repowise");
  await fs.cp(fixtureRoot, knowledgeRoot, { recursive: true });
  await writeStableOption(knowledgeRoot, "option-never-hit", "Never Hit Option", 54);
  await fs.writeFile(
    path.join(knowledgeRoot, "state", "usage-index.json"),
    `${JSON.stringify(
      {
        "option-unified-client": {
          session_mentions: 0,
          preflight_hits: 4,
          adopted_count: 0,
          rejected_after_hit_count: 0,
          last_hit_at: "2026-05-15",
          last_used_at: null,
          last_session_id: null
        },
        "option-direct-call": {
          session_mentions: 0,
          preflight_hits: 4,
          adopted_count: 0,
          rejected_after_hit_count: 3,
          last_hit_at: "2026-05-15",
          last_used_at: "2026-05-15",
          last_session_id: "session-rejected"
        }
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  const report = await lintProjectKnowledge(knowledgeRoot);

  assert.ok(report.usefulness);
  assert.ok(
    report.issues.some(
      (issue) => issue.code === "wiki-never-hit" && issue.node_id === "option-never-hit"
    )
  );
  assert.ok(
    report.issues.some(
      (issue) => issue.code === "wiki-hit-but-never-adopted" && issue.node_id === "option-unified-client"
    )
  );
  assert.ok(
    report.issues.some(
      (issue) =>
        issue.code === "wiki-frequently-rejected-after-hit" &&
        issue.node_id === "option-direct-call" &&
        issue.preflight_hits === 4 &&
        issue.rejected_after_hit_count === 3
    )
  );
});

test("lintProjectKnowledge reports active conflicts and superseded recommendation leftovers", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "project-knowledge-lint-conflicts-"));
  const knowledgeRoot = path.join(tempRoot, ".repowise");
  await fs.cp(fixtureRoot, knowledgeRoot, { recursive: true });
  await writeConflictingRules(knowledgeRoot);
  await writeStableOption(knowledgeRoot, "option-superseded-recommended", "Superseded Recommended Option", 98);
  await markOptionSuperseded(
    path.join(knowledgeRoot, "options", "option-superseded-recommended.md"),
    "option-unified-client"
  );
  await addPreferredOption(knowledgeRoot, "option-superseded-recommended", 9);
  await writeDuplicateScopePractice(knowledgeRoot);

  const report = await lintProjectKnowledge(knowledgeRoot);

  assert.ok(
    report.issues.some(
      (issue) =>
        issue.code === "wiki-active-conflicting-rules" &&
        issue.node_id === "rule-conflict-a" &&
        issue.conflicting_node_id === "rule-conflict-b"
    )
  );
  assert.ok(
    report.issues.some(
      (issue) =>
        issue.code === "wiki-superseded-node-still-recommended" &&
        issue.node_id === "option-superseded-recommended" &&
        issue.superseded_by === "option-unified-client" &&
        issue.recommendation_sources.includes("project-preferred:project-current")
    )
  );
  assert.ok(
    report.issues.some(
      (issue) =>
        issue.code === "wiki-duplicate-practice-scope" &&
        issue.node_id === "practice-http-client" &&
        issue.duplicate_node_id === "practice-http-client-same-scope"
    )
  );
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

async function writeConflictingRules(knowledgeRoot) {
  await fs.writeFile(
    path.join(knowledgeRoot, "rules", "rule-conflict-a.md"),
    `---
id: rule-conflict-a
type: rule
title: Conflict Rule A
summary: Conflicts with rule B.
applies_to: [practice-http-client]
priority: strong
keywords: [conflict]
status: active
maturity: stable
source_evidence: [src/api/conflict-a.ts]
session_refs: [session-conflict]
conflicts_with: [rule-conflict-b]
---

## Summary

Conflicts with rule B.
`,
    "utf8"
  );
  await fs.writeFile(
    path.join(knowledgeRoot, "rules", "rule-conflict-b.md"),
    `---
id: rule-conflict-b
type: rule
title: Conflict Rule B
summary: Conflicts with rule A.
applies_to: [practice-http-client]
priority: strong
keywords: [conflict]
status: active
maturity: stable
source_evidence: [src/api/conflict-b.ts]
session_refs: [session-conflict]
conflicts_with: [rule-conflict-a]
---

## Summary

Conflicts with rule A.
`,
    "utf8"
  );
}

async function markOptionSuperseded(filePath, supersededBy) {
  const source = await fs.readFile(filePath, "utf8");
  await fs.writeFile(
    filePath,
    source.replace("session_refs: []", `session_refs: []\nsuperseded_by: ${supersededBy}`),
    "utf8"
  );
}

async function addPreferredOption(knowledgeRoot, optionId, adjustment) {
  const profilePath = path.join(knowledgeRoot, "project-profile.md");
  const source = await fs.readFile(profilePath, "utf8");
  await fs.writeFile(
    profilePath,
    source.replace("  option-direct-call: -8", `  option-direct-call: -8\n  ${optionId}: ${adjustment}`),
    "utf8"
  );
}

async function writeDuplicateScopePractice(knowledgeRoot) {
  await fs.writeFile(
    path.join(knowledgeRoot, "practices", "practice-http-client-same-scope.md"),
    `---
id: practice-http-client-same-scope
type: practice
title: HTTP Client Same Scope
summary: Duplicates the HTTP client practice scope.
contexts: [context-frontend-page]
constraints: [constraint-backward-compatibility]
rules: [rule-use-unified-client]
option_ids: []
keywords: [http, request]
status: active
maturity: stable
source_evidence: [src/api/client.ts]
session_refs: [session-scope]
scope: remote-http-client
---

## Summary

Duplicates the HTTP client practice scope.
`,
    "utf8"
  );
  const source = await fs.readFile(
    path.join(knowledgeRoot, "practices", "practice-http-client.md"),
    "utf8"
  );
  await fs.writeFile(
    path.join(knowledgeRoot, "practices", "practice-http-client.md"),
    source.replace("session_refs: []", "session_refs: []\nscope: remote-http-client"),
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

async function writeBrokenEvidenceOption(knowledgeRoot) {
  await fs.writeFile(
    path.join(knowledgeRoot, "options", "option-broken-evidence-path.md"),
    `---
id: option-broken-evidence-path
type: option
title: Broken Evidence Path
summary: Evidence path no longer exists after a file move.
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
  - src/legacy/client.ts
session_refs: [session-broken-evidence]
---

## Summary

Evidence path no longer exists after a file move.
`,
    "utf8"
  );
}

async function writeRichEvidenceWithoutReasonOption(knowledgeRoot) {
  await fs.writeFile(
    path.join(knowledgeRoot, "options", "option-rich-evidence-without-reason.md"),
    `---
id: option-rich-evidence-without-reason
type: option
title: Rich Evidence Without Reason
summary: Structured evidence without a reason should be reported.
practice: practice-http-client
base_score: 56
score_breakdown:
  consistency: 11
  efficiency: 11
  maintainability: 11
  extensibility: 11
  risk: 12
constraints: []
alternatives: []
keywords: [evidence]
status: active
maturity: stable
source_evidence:
  - path: src/api/missing-reason.ts
    symbol: callApi
    stability: stable
session_refs: [session-rich-evidence]
---

## Summary

Structured evidence without a reason should be reported.

## Decision

Stable structured evidence needs a reason.
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


async function writeThinPractice(knowledgeRoot) {
  await fs.writeFile(
    path.join(knowledgeRoot, "practices", "practice-thin-page.md"),
    `---
id: practice-thin-page
type: practice
title:  
contexts: []
constraints: []
rules: []
option_ids: []
keywords: []
status: active
maturity: stable
source_evidence: []
session_refs: []
---

Too short.
`,
    "utf8"
  );
}

async function writeNoPreflightSurfaceOption(knowledgeRoot) {
  await fs.writeFile(
    path.join(knowledgeRoot, "options", "option-no-preflight-surface.md"),
    `---
id: option-no-preflight-surface
type: option
title: No Preflight Surface
summary: Has summary and evidence but no keywords for retrieval.
practice: practice-http-client
base_score: 62
score_breakdown:
  consistency: 12
  efficiency: 12
  maintainability: 12
  extensibility: 13
  risk: 13
constraints: []
alternatives: []
keywords: []
status: active
maturity: stable
source_evidence: [src/api/no-preflight.ts]
session_refs: []
---

## Summary

Has summary and evidence but no retrieval keywords.
`,
    "utf8"
  );
}

async function writeOrphanRule(knowledgeRoot) {
  await fs.writeFile(
    path.join(knowledgeRoot, "rules", "rule-orphan.md"),
    `---
id: rule-orphan
type: rule
title: Orphan Rule
summary: Has no graph links, session refs, or evidence.
applies_to: []
keywords: [orphan]
status: active
maturity: stable
source_evidence: []
session_refs: []
---

## Summary

Has no graph links, session refs, or evidence.
`,
    "utf8"
  );
}

async function writeBadIdOption(knowledgeRoot) {
  await fs.writeFile(
    path.join(knowledgeRoot, "practices", "bad-id-option.md"),
    `---
id: bad id
type: option
title: Bad Directory Option
summary: Option stored under the wrong directory with an invalid id.
practice: practice-http-client
base_score: 50
score_breakdown:
  consistency: 10
  efficiency: 10
  maintainability: 10
  extensibility: 10
  risk: 10
constraints: []
alternatives: []
keywords: [bad]
status: active
maturity: stable
source_evidence: [src/api/bad.ts]
session_refs: []
---

## Summary

Option stored under the wrong directory with an invalid id.
`,
    "utf8"
  );
}

async function writeOversizedPractice(knowledgeRoot) {
  await fs.writeFile(
    path.join(knowledgeRoot, "practices", "practice-oversized-page.md"),
    `---
id: practice-oversized-page
type: practice
title: Oversized Practice
summary: Oversized practice page should be split.
contexts: []
constraints: []
rules: []
option_ids: []
keywords: [oversized]
status: active
maturity: stable
source_evidence: [src/api/oversized.ts]
session_refs: [session-oversized]
---

## Summary

Oversized practice page should be split.

${"Long governance note.\n".repeat(700)}
`,
    "utf8"
  );
}

async function writeBrokenLinkOption(knowledgeRoot) {
  await fs.writeFile(
    path.join(knowledgeRoot, "options", "option-broken-link.md"),
    `---
id: option-broken-link
type: option
title: Broken Link Option
summary: Contains a wiki link to a missing node.
practice: practice-http-client
base_score: 51
score_breakdown:
  consistency: 10
  efficiency: 10
  maintainability: 10
  extensibility: 10
  risk: 11
constraints: []
alternatives: []
keywords: [link]
status: active
maturity: stable
source_evidence: [src/api/link.ts]
session_refs: [session-link]
---

## Summary

See [[missing-node]] before adopting.

## Decision

Keep links resolvable.
`,
    "utf8"
  );
}

async function writeMissingSessionAndDecisionOption(knowledgeRoot) {
  await fs.writeFile(
    path.join(knowledgeRoot, "options", "option-missing-session-decision.md"),
    `---
id: option-missing-session-decision
type: option
title: Missing Session and Decision Option
summary: Has evidence but lacks a session reference and decision reason.
practice: practice-http-client
base_score: 52
score_breakdown:
  consistency: 10
  efficiency: 10
  maintainability: 10
  extensibility: 11
  risk: 11
constraints: []
alternatives: []
keywords: [decision]
status: active
maturity: stable
source_evidence: [src/api/missing-session.ts]
session_refs: []
---

## Summary

Has evidence but lacks a session reference and decision reason.
`,
    "utf8"
  );
}

async function writeStaleOption(knowledgeRoot) {
  await fs.writeFile(
    path.join(knowledgeRoot, "options", "option-stale-recommendation.md"),
    `---
id: option-stale-recommendation
type: option
title: Stale Recommended Option
summary: High-ranked option with stale verification.
practice: practice-http-client
base_score: 99
score_breakdown:
  consistency: 20
  efficiency: 20
  maintainability: 20
  extensibility: 20
  risk: 19
constraints: []
alternatives: []
keywords: [http, stale]
status: active
maturity: stable
source_evidence: [src/api/stale.ts]
session_refs: [session-old]
last_verified_at: 2026-01-01
stale_after_days: 30
---

## Summary

High-ranked option with stale verification.
`,
    "utf8"
  );
}

async function writeInvalidVerificationRule(knowledgeRoot) {
  await fs.writeFile(
    path.join(knowledgeRoot, "rules", "rule-invalid-verification-date.md"),
    `---
id: rule-invalid-verification-date
type: rule
title: Invalid Verification Date
summary: Invalid verification date should be reported.
applies_to: [practice-http-client]
priority: default
keywords: [date]
status: active
maturity: stable
source_evidence: [src/api/date.ts]
session_refs: [session-date]
last_verified_at: not-a-date
stale_after_days: 90
owner: platform
---

## Summary

Invalid verification date should be reported.
`,
    "utf8"
  );
}

async function writeStrongRuleWithoutOwner(knowledgeRoot) {
  await fs.writeFile(
    path.join(knowledgeRoot, "rules", "rule-strong-without-owner.md"),
    `---
id: rule-strong-without-owner
type: rule
title: Strong Rule Without Owner
summary: Strong rule should have an owner and verification date.
applies_to: [practice-http-client]
priority: strong
keywords: [strong]
status: active
maturity: stable
source_evidence: [src/api/rule.ts]
session_refs: [session-rule]
---

## Summary

Strong rule should have an owner and verification date.
`,
    "utf8"
  );
}
async function markRejected(filePath) {
  const source = await fs.readFile(filePath, "utf8");
  const nextSource = source.replace(/maturity: (stable|incubating)/, "maturity: $1\nreview_status: rejected");
  await fs.writeFile(filePath, nextSource, "utf8");
}

