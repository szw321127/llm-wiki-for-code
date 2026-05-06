import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { governProjectKnowledge } from "../scripts/govern-project-knowledge.mjs";
import { buildProjectGraphFromDirectory, parseFrontmatterBlock } from "../scripts/knowledge-lib.mjs";

const fixtureRoot = path.resolve("tests", "fixtures", "sample-project", ".project-knowledge");

test("governProjectKnowledge promotes adopted incubating options into the stable pool", async () => {
  const knowledgeRoot = await copyFixture("project-knowledge-govern-promote-");
  await writeUsageIndex(knowledgeRoot, {
    "option-direct-call": {
      session_mentions: 4,
      adopted_count: 3,
      last_used_at: "2026-04-30",
      last_session_id: "session-promote"
    }
  });

  const result = await governProjectKnowledge(knowledgeRoot);

  assert.ok(result.actions.some((action) => action.type === "promote" && action.node_id === "option-direct-call"));
  assert.equal(await exists(path.join(knowledgeRoot, "incubating", "options", "option-direct-call.md")), false);
  assert.equal(await exists(path.join(knowledgeRoot, "options", "option-direct-call.md")), true);

  const document = await readFrontmatter(path.join(knowledgeRoot, "options", "option-direct-call.md"));
  assert.equal(document.maturity, "stable");
  assert.equal(document.review_status, "approved");
});

test("governProjectKnowledge demotes recommendation pool evictions without deleting files", async () => {
  const knowledgeRoot = await copyFixture("project-knowledge-govern-evict-");
  await writeStableOption(knowledgeRoot, "option-extra-a", "额外稳定方案 A", 94);
  await writeStableOption(knowledgeRoot, "option-extra-b", "额外稳定方案 B", 93);
  await writeStableOption(knowledgeRoot, "option-extra-low", "额外低分稳定方案", 72);

  const result = await governProjectKnowledge(knowledgeRoot);

  assert.ok(result.actions.some((action) => action.type === "demote" && action.node_id === "option-extra-low"));
  assert.equal(await exists(path.join(knowledgeRoot, "options", "option-extra-low.md")), false);
  assert.equal(await exists(path.join(knowledgeRoot, "incubating", "options", "option-extra-low.md")), true);

  const document = await readFrontmatter(path.join(knowledgeRoot, "incubating", "options", "option-extra-low.md"));
  assert.equal(document.maturity, "incubating");
  assert.equal(document.review_status, "rejected");
});

test("governProjectKnowledge does not promote manually rejected candidates", async () => {
  const knowledgeRoot = await copyFixture("project-knowledge-govern-rejected-");
  await markRejected(path.join(knowledgeRoot, "incubating", "options", "option-direct-call.md"));
  await writeUsageIndex(knowledgeRoot, {
    "option-direct-call": {
      session_mentions: 4,
      adopted_count: 3,
      last_used_at: "2026-04-30",
      last_session_id: "session-rejected"
    }
  });

  const result = await governProjectKnowledge(knowledgeRoot);

  assert.equal(result.actions.some((action) => action.type === "promote" && action.node_id === "option-direct-call"), false);
  assert.equal(await exists(path.join(knowledgeRoot, "incubating", "options", "option-direct-call.md")), true);
});

test("governProjectKnowledge rejects strong duplicate nodes and keeps the stronger node", async () => {
  const knowledgeRoot = await copyFixture("project-knowledge-govern-duplicate-");
  await writeDuplicatePractice(knowledgeRoot);

  const result = await governProjectKnowledge(knowledgeRoot);

  assert.ok(
    result.actions.some(
      (action) =>
        action.type === "reject-duplicate" &&
        action.node_id === "practice-http-client-duplicate" &&
        action.duplicate_of === "practice-http-client"
    )
  );
  assert.equal(await exists(path.join(knowledgeRoot, "practices", "practice-http-client-duplicate.md")), false);
  assert.equal(
    await exists(path.join(knowledgeRoot, "incubating", "practices", "practice-http-client-duplicate.md")),
    true
  );

  const document = await readFrontmatter(
    path.join(knowledgeRoot, "incubating", "practices", "practice-http-client-duplicate.md")
  );
  assert.equal(document.review_status, "rejected");
  assert.equal(document.duplicate_of, "practice-http-client");
});

test("governProjectKnowledge rebuilds graph data after write actions", async () => {
  const knowledgeRoot = await copyFixture("project-knowledge-govern-graph-");
  await writeUsageIndex(knowledgeRoot, {
    "option-direct-call": {
      session_mentions: 4,
      adopted_count: 3,
      last_used_at: "2026-04-30",
      last_session_id: "session-promote"
    }
  });

  await governProjectKnowledge(knowledgeRoot);

  const graph = await buildProjectGraphFromDirectory(knowledgeRoot);
  const promoted = graph.nodes.find((node) => node.id === "option-direct-call");
  assert.equal(promoted.maturity, "stable");
  assert.equal(await exists(path.join(knowledgeRoot, "graph", "graph-data.json")), true);
});

async function copyFixture(prefix) {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  const knowledgeRoot = path.join(tempRoot, ".project-knowledge");
  await fs.cp(fixtureRoot, knowledgeRoot, { recursive: true });
  return knowledgeRoot;
}

async function readFrontmatter(filePath) {
  const source = await fs.readFile(filePath, "utf8");
  return parseFrontmatterBlock(source).data;
}

async function writeUsageIndex(knowledgeRoot, entries) {
  await fs.writeFile(
    path.join(knowledgeRoot, "state", "usage-index.json"),
    `${JSON.stringify(entries, null, 2)}\n`,
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

async function markRejected(filePath) {
  const source = await fs.readFile(filePath, "utf8");
  const nextSource = source.replace("maturity: incubating", "maturity: incubating\nreview_status: rejected");
  await fs.writeFile(filePath, nextSource, "utf8");
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
