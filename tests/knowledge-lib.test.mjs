import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  buildProjectGraphFromDirectory,
  computeFinalScore,
  parseFrontmatterBlock
} from "../scripts/knowledge-lib.mjs";

const fixtureRoot = path.resolve("tests", "fixtures", "sample-project", ".repowise");

test("parseFrontmatterBlock parses nested project knowledge fields", () => {
  const source = `---
id: option-sample
type: option
title: 示例方案
summary: 示例摘要
practice: practice-sample
base_score: 42
score_breakdown:
  consistency: 8
  efficiency: 9
  maintainability: 8
  extensibility: 9
  risk: 8
maturity: incubating
source_evidence: [src/api/client.ts, docs/engineering.md]
session_refs: [session-2026-04-23-sample]
---

## Summary

用于测试。
`;

  const document = parseFrontmatterBlock(source);

  assert.equal(document.data.practice, "practice-sample");
  assert.equal(document.data.base_score, 42);
  assert.equal(document.data.score_breakdown.efficiency, 9);
  assert.deepEqual(document.data.source_evidence, [
    "src/api/client.ts",
    "docs/engineering.md"
  ]);
  assert.deepEqual(document.data.session_refs, ["session-2026-04-23-sample"]);
});

test("buildProjectGraphFromDirectory loads root project profile and incubating nodes", async () => {
  const graph = await buildProjectGraphFromDirectory(fixtureRoot);

  assert.equal(path.isAbsolute(graph.knowledge_root), false);
  assert.equal(graph.knowledge_root, ".");
  const project = graph.nodes.find((node) => node.type === "project_profile");
  const incubatingOption = graph.nodes.find((node) => node.id === "option-direct-call");
  const stableOption = graph.nodes.find((node) => node.id === "option-unified-client");
  const practice = graph.nodes.find((node) => node.id === "practice-http-client");

  assert.equal(project.id, "project-current");
  assert.equal(project.title, "示例项目");
  assert.equal(incubatingOption.maturity, "incubating");
  assert.equal(stableOption.maturity, "stable");
  assert.equal(stableOption.final_scores["project-current"], 96);
  assert.equal(incubatingOption.final_scores["project-current"], 32);
  assert.equal(practice.recommended_options.global, "option-unified-client");
  assert.equal(practice.recommended_options["project-current"], "option-unified-client");
  assert.equal(stableOption.has_explicit_summary, true);
  assert.deepEqual(practice.ranked_option_ids["project-current"], [
    "option-unified-client",
    "option-direct-call"
  ]);
});

test("buildProjectGraphFromDirectory preserves wiki governance metadata", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "project-knowledge-metadata-"));
  const knowledgeRoot = path.join(tempRoot, ".repowise");
  await fs.cp(fixtureRoot, knowledgeRoot, { recursive: true });
  await writeGovernanceMetadataRule(knowledgeRoot);

  const graph = await buildProjectGraphFromDirectory(knowledgeRoot);
  const rule = graph.nodes.find((node) => node.id === "rule-governance-metadata");

  assert.equal(rule.last_verified_at, "2026-05-15");
  assert.equal(rule.stale_after_days, 90);
  assert.equal(rule.owner, "platform-team");
  assert.deepEqual(rule.reviewers, ["maintainer-a", "maintainer-b"]);
  assert.deepEqual(rule.conflicts_with, ["rule-old"]);
  assert.deepEqual(rule.supersedes, ["rule-older"]);
  assert.equal(rule.superseded_by, "rule-new");
});

test("buildProjectGraphFromDirectory normalizes rich evidence records", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "project-knowledge-rich-evidence-"));
  const knowledgeRoot = path.join(tempRoot, ".repowise");
  await fs.cp(fixtureRoot, knowledgeRoot, { recursive: true });
  await writeRichEvidenceOption(knowledgeRoot);

  const graph = await buildProjectGraphFromDirectory(knowledgeRoot);
  const option = graph.nodes.find((node) => node.id === "option-rich-evidence");

  assert.deepEqual(option.source_evidence, [
    "src/api/client.ts",
    "src/runtime/scheduler.ts"
  ]);
  assert.deepEqual(option.evidence_records, [
    {
      path: "src/runtime/scheduler.ts",
      symbol: "createScheduler",
      reason: "Demonstrates project-wide scheduler boundary.",
      observed_pattern: "Scheduler starts after login/user readiness.",
      stability: "stable",
      last_verified_at: "2026-05-15"
    }
  ]);
});

test("buildProjectGraphFromDirectory ranks recommendation pools with usage adjustment", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "project-knowledge-ranking-"));
  const knowledgeRoot = path.join(tempRoot, ".repowise");
  await fs.cp(fixtureRoot, knowledgeRoot, { recursive: true });

  await writeOption(knowledgeRoot, {
    id: "option-close-competitor",
    title: "接近默认方案",
    baseScore: 98,
    evidence: "src/api/competitor.ts"
  });
  await writeOption(knowledgeRoot, {
    id: "option-mid-competitor",
    title: "中位候选方案",
    baseScore: 97,
    evidence: "src/api/mid.ts"
  });
  await writeOption(knowledgeRoot, {
    id: "option-low-competitor",
    title: "低位候选方案",
    baseScore: 75,
    evidence: "src/api/low.ts"
  });

  const graph = await buildProjectGraphFromDirectory(knowledgeRoot);
  const practice = graph.nodes.find((node) => node.id === "practice-http-client");
  const adoptedOption = graph.nodes.find((node) => node.id === "option-unified-client");

  assert.equal(adoptedOption.usage_adjustment, 5);
  assert.equal(adoptedOption.final_scores["project-current"], 96);
  assert.equal(adoptedOption.effective_scores["project-current"], 101);
  assert.deepEqual(practice.recommendation_pools["project-current"], [
    "option-unified-client",
    "option-close-competitor",
    "option-mid-competitor"
  ]);
  assert.equal(practice.recommended_options["project-current"], "option-unified-client");
  assert.equal(practice.recommendation_pools["project-current"].length, 3);
});

test("buildProjectGraphFromDirectory ranks adoption above raw preflight hits", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "project-knowledge-ranking-usefulness-"));
  const knowledgeRoot = path.join(tempRoot, ".repowise");
  await fs.cp(fixtureRoot, knowledgeRoot, { recursive: true });

  await writeOption(knowledgeRoot, {
    id: "option-adopted-lower-base",
    title: "Adopted Lower Base",
    baseScore: 82,
    evidence: "src/api/adopted-lower-base.ts"
  });
  await writeOption(knowledgeRoot, {
    id: "option-hit-only-higher-base",
    title: "Hit Only Higher Base",
    baseScore: 84,
    evidence: "src/api/hit-only-higher-base.ts"
  });
  await fs.writeFile(
    path.join(knowledgeRoot, "state", "usage-index.json"),
    `${JSON.stringify(
      {
        "option-adopted-lower-base": {
          session_mentions: 0,
          preflight_hits: 0,
          adopted_count: 2,
          rejected_after_hit_count: 0,
          last_used_at: "2026-05-15",
          last_session_id: "session-adopted"
        },
        "option-hit-only-higher-base": {
          session_mentions: 0,
          preflight_hits: 20,
          adopted_count: 0,
          rejected_after_hit_count: 0,
          last_hit_at: "2026-05-15"
        }
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  const graph = await buildProjectGraphFromDirectory(knowledgeRoot);
  const practice = graph.nodes.find((node) => node.id === "practice-http-client");
  const adoptedIndex = practice.ranked_option_ids.global.indexOf("option-adopted-lower-base");
  const hitOnlyIndex = practice.ranked_option_ids.global.indexOf("option-hit-only-higher-base");
  const hitOnlyOption = graph.nodes.find((node) => node.id === "option-hit-only-higher-base");

  assert.equal(hitOnlyOption.usage_stats.preflight_hits, 20);
  assert.equal(hitOnlyOption.usage_stats.rejected_after_hit_count, 0);
  assert.equal(hitOnlyOption.usage_adjustment, 3);
  assert.ok(adoptedIndex >= 0);
  assert.ok(hitOnlyIndex >= 0);
  assert.ok(adoptedIndex < hitOnlyIndex);
});

test("buildProjectGraphFromDirectory excludes superseded options from recommendation ranking", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "project-knowledge-ranking-superseded-"));
  const knowledgeRoot = path.join(tempRoot, ".repowise");
  await fs.cp(fixtureRoot, knowledgeRoot, { recursive: true });

  await writeOption(knowledgeRoot, {
    id: "option-superseded-high-score",
    title: "Superseded High Score",
    baseScore: 120,
    evidence: "src/api/superseded-high.ts"
  });
  await markOptionSuperseded(
    path.join(knowledgeRoot, "options", "option-superseded-high-score.md"),
    "option-unified-client"
  );

  const graph = await buildProjectGraphFromDirectory(knowledgeRoot);
  const practice = graph.nodes.find((node) => node.id === "practice-http-client");
  const supersededOption = graph.nodes.find((node) => node.id === "option-superseded-high-score");

  assert.equal(supersededOption.superseded_by, "option-unified-client");
  assert.equal(supersededOption.lifecycle_state, "superseded");
  assert.equal(practice.ranked_option_ids["project-current"].includes("option-superseded-high-score"), false);
  assert.equal(practice.recommendation_pools["project-current"].includes("option-superseded-high-score"), false);
});

test("buildProjectGraphFromDirectory excludes archived options from recommendation ranking", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "project-knowledge-ranking-archived-"));
  const knowledgeRoot = path.join(tempRoot, ".repowise");
  await fs.cp(fixtureRoot, knowledgeRoot, { recursive: true });

  await writeOption(knowledgeRoot, {
    id: "option-archived-high-score",
    title: "Archived High Score",
    baseScore: 120,
    evidence: "src/api/archived-high.ts"
  });
  await markOptionArchived(
    path.join(knowledgeRoot, "options", "option-archived-high-score.md")
  );

  const graph = await buildProjectGraphFromDirectory(knowledgeRoot);
  const practice = graph.nodes.find((node) => node.id === "practice-http-client");
  const archivedOption = graph.nodes.find((node) => node.id === "option-archived-high-score");

  assert.equal(archivedOption.status, "archived");
  assert.equal(practice.ranked_option_ids["project-current"].includes("option-archived-high-score"), false);
  assert.equal(practice.recommendation_pools["project-current"].includes("option-archived-high-score"), false);
});

test("buildProjectGraphFromDirectory marks promotion and eviction candidates", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "project-knowledge-lifecycle-"));
  const knowledgeRoot = path.join(tempRoot, ".repowise");
  await fs.cp(fixtureRoot, knowledgeRoot, { recursive: true });

  await writeOption(knowledgeRoot, {
    id: "option-stable-secondary",
    title: "稳定次选方案",
    baseScore: 95,
    evidence: "src/api/stable-secondary.ts"
  });
  await writeOption(knowledgeRoot, {
    id: "option-stable-low",
    title: "稳定低分方案",
    baseScore: 74,
    evidence: "src/api/stable-low.ts"
  });
  await writeIncubatingOption(knowledgeRoot, {
    id: "option-incubating-adopted",
    title: "已采纳孵化方案",
    baseScore: 85,
    evidence: "src/api/incubating-adopted.ts"
  });
  await fs.writeFile(
    path.join(knowledgeRoot, "state", "usage-index.json"),
    `${JSON.stringify(
      {
        "option-unified-client": {
          session_mentions: 2,
          adopted_count: 1,
          last_used_at: "2026-04-30",
          last_session_id: "session-existing"
        },
        "option-incubating-adopted": {
          session_mentions: 4,
          adopted_count: 3,
          last_used_at: "2026-04-30",
          last_session_id: "session-lifecycle"
        }
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  const graph = await buildProjectGraphFromDirectory(knowledgeRoot);
  const practice = graph.nodes.find((node) => node.id === "practice-http-client");
  const promotedOption = graph.nodes.find((node) => node.id === "option-incubating-adopted");

  assert.equal(promotedOption.maturity, "incubating");
  assert.equal(promotedOption.lifecycle_state, "promotion_candidate");
  assert.equal(promotedOption.lifecycle_reasons.includes("adopted-threshold-met"), true);
  assert.deepEqual(practice.recommendation_pools["project-current"], [
    "option-unified-client",
    "option-incubating-adopted",
    "option-stable-secondary"
  ]);
  assert.equal(practice.recommendation_pools["project-current"].length, 3);
  assert.ok(practice.evicted_option_ids["project-current"].includes("option-stable-low"));
  assert.ok(practice.evicted_option_ids["project-current"].includes("option-direct-call"));
});

test("computeFinalScore keeps the manual score formula", () => {
  assert.equal(computeFinalScore(50, 8), 58);
  assert.equal(computeFinalScore(50, -12), 38);
});

async function writeOption(knowledgeRoot, { id, title, baseScore, evidence }) {
  const optionPath = path.join(knowledgeRoot, "options", `${id}.md`);
  await fs.writeFile(
    optionPath,
    `---
id: ${id}
type: option
title: ${title}
summary: ${title}。
practice: practice-http-client
base_score: ${baseScore}
score_breakdown:
  consistency: 20
  efficiency: 20
  maintainability: 20
  extensibility: 20
  risk: ${baseScore - 80}
constraints: []
alternatives: []
keywords: [client]
status: active
maturity: stable
source_evidence: [${evidence}]
session_refs: []
---

## Summary

${title}。
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

async function markOptionArchived(filePath) {
  const source = await fs.readFile(filePath, "utf8");
  await fs.writeFile(
    filePath,
    source.replace("status: active", "status: archived"),
    "utf8"
  );
}

async function writeGovernanceMetadataRule(knowledgeRoot) {
  await fs.writeFile(
    path.join(knowledgeRoot, "rules", "rule-governance-metadata.md"),
    `---
id: rule-governance-metadata
type: rule
title: Governance Metadata Rule
summary: Preserves governance metadata.
applies_to: [practice-http-client]
priority: strong
keywords: [metadata]
status: active
maturity: stable
source_evidence: [src/api/metadata.ts]
session_refs: [session-metadata]
last_verified_at: 2026-05-15
stale_after_days: 90
owner: platform-team
reviewers: [maintainer-a, maintainer-b]
conflicts_with: [rule-old]
supersedes: [rule-older]
superseded_by: rule-new
---

## Summary

Preserves governance metadata.
`,
    "utf8"
  );
}

async function writeRichEvidenceOption(knowledgeRoot) {
  await fs.writeFile(
    path.join(knowledgeRoot, "options", "option-rich-evidence.md"),
    `---
id: option-rich-evidence
type: option
title: Rich Evidence Option
summary: Preserves structured evidence records.
practice: practice-http-client
base_score: 90
score_breakdown:
  consistency: 18
  efficiency: 18
  maintainability: 18
  extensibility: 18
  risk: 18
constraints: []
alternatives: []
keywords: [evidence]
status: active
maturity: stable
source_evidence:
  - src/api/client.ts
  - path: src/runtime/scheduler.ts
    symbol: createScheduler
    reason: Demonstrates project-wide scheduler boundary.
    observed_pattern: Scheduler starts after login/user readiness.
    stability: stable
    last_verified_at: 2026-05-15
session_refs: [session-rich-evidence]
---

## Summary

Preserves structured evidence records.

## Decision

Use structured evidence when a path alone is not auditable enough.
`,
    "utf8"
  );
}

async function writeIncubatingOption(knowledgeRoot, { id, title, baseScore, evidence }) {
  const optionPath = path.join(knowledgeRoot, "incubating", "options", `${id}.md`);
  await fs.writeFile(
    optionPath,
    `---
id: ${id}
type: option
title: ${title}
summary: ${title}。
practice: practice-http-client
base_score: ${baseScore}
score_breakdown:
  consistency: 17
  efficiency: 17
  maintainability: 17
  extensibility: 17
  risk: 17
constraints: []
alternatives: []
keywords: [client]
status: active
maturity: incubating
source_evidence: [${evidence}]
session_refs: []
---

## Summary

${title}。
`,
    "utf8"
  );
}
