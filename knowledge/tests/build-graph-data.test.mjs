import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";

import {
  buildGraphFromDirectory,
  computeFinalScore,
  parseFrontmatterBlock
} from "../tools/graph-lib.mjs";

const fixtureRoot = fileURLToPath(
  new URL("./fixtures/minimal-knowledge", import.meta.url)
);

test("parseFrontmatterBlock 解析数组、布尔、数字和嵌套对象", () => {
  const source = `---
id: option-sample-a
type: option
title: 示例方案 A
practice: practice-sample
base_score: 85
score_breakdown:
  consistency: 18
  efficiency: 17
  maintainability: 16
  extensibility: 18
  risk: 16
tech: [node, script]
constraints: [constraint-sample]
alternatives: [option-sample-b]
recommended: true
status: active
---

## Summary

用于测试 frontmatter 解析。
`;

  const document = parseFrontmatterBlock(source);

  assert.equal(document.data.id, "option-sample-a");
  assert.equal(document.data.base_score, 85);
  assert.equal(document.data.recommended, true);
  assert.deepEqual(document.data.tech, ["node", "script"]);
  assert.equal(document.data.score_breakdown.consistency, 18);
  assert.match(document.body, /Summary/);
});

test("buildGraphFromDirectory 构建节点和边", async () => {
  const graph = await buildGraphFromDirectory(fixtureRoot);
  const edgeKeys = graph.edges.map((edge) => `${edge.type}:${edge.from}->${edge.to}`);

  assert.equal(path.isAbsolute(graph.knowledge_root), false);
  assert.equal(graph.knowledge_root, ".");
  assert.equal(graph.nodes.length, 7);
  assert.ok(edgeKeys.includes("has_option:practice-sample->option-sample-a"));
  assert.ok(edgeKeys.includes("has_option:practice-sample->option-sample-b"));
  assert.ok(edgeKeys.includes("applies_to:practice-sample->context-sample"));
  assert.ok(edgeKeys.includes("limited_by:practice-sample->constraint-sample"));
  assert.ok(edgeKeys.includes("governed_by:practice-sample->rule-sample"));
  assert.ok(edgeKeys.includes("alternative_to:option-sample-a->option-sample-b"));
  assert.ok(edgeKeys.includes("prefers_option:project-sample->option-sample-a"));
  assert.ok(edgeKeys.includes("adopts_rule:project-sample->rule-sample"));

  const optionA = graph.nodes.find((node) => node.id === "option-sample-a");
  assert.equal(optionA.practice, "practice-sample");
  assert.equal(optionA.final_scores["project-sample"], 92);
  assert.equal(optionA.label, "示例方案 A");
  assert.equal(optionA.node_group, "option-recommended");
  assert.deepEqual(optionA.neighbor_ids.sort(), [
    "constraint-sample",
    "option-sample-b",
    "practice-sample",
    "project-sample"
  ]);
});

test("computeFinalScore 按公式计算 final_score", () => {
  assert.equal(computeFinalScore(88, 10), 98);
  assert.equal(computeFinalScore(88, -15), 73);
  assert.equal(computeFinalScore(88, 0), 88);
});

test("buildGraphFromDirectory 为实践计算当前项目推荐方案", async () => {
  const graph = await buildGraphFromDirectory(path.resolve(fixtureRoot));
  const practice = graph.nodes.find((node) => node.id === "practice-sample");

  assert.equal(practice.recommended_options.global, "option-sample-a");
  assert.equal(practice.recommended_options["project-sample"], "option-sample-a");
  assert.deepEqual(practice.ranked_option_ids.global, [
    "option-sample-a",
    "option-sample-b"
  ]);
  assert.deepEqual(practice.ranked_option_ids["project-sample"], [
    "option-sample-a",
    "option-sample-b"
  ]);
  assert.equal(practice.label, "示例实践");
  assert.equal(practice.node_group, "practice");
  assert.deepEqual(practice.neighbor_ids.sort(), [
    "constraint-sample",
    "context-sample",
    "option-sample-a",
    "option-sample-b",
    "rule-sample"
  ]);

  const optionB = graph.nodes.find((node) => node.id === "option-sample-b");
  assert.equal(optionB.final_scores["project-sample"], 69);
});
