import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { runPreflight } from "../scripts/preflight-session.mjs";

const fixtureProjectRoot = path.resolve("tests", "fixtures", "sample-project");

test("runPreflight returns no-knowledge when project knowledge is missing", async () => {
  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "project-knowledge-empty-"));

  const result = await runPreflight(projectRoot, "实现 HTTP 请求");

  assert.equal(result.mode, "no-knowledge");
  assert.equal(result.knowledgeRoot, path.join(projectRoot, ".project-knowledge"));
  assert.deepEqual(result.matchedPractices, []);
});

test("runPreflight returns matched practices and recommendation pool for task keywords", async () => {
  const result = await runPreflight(fixtureProjectRoot, "页面里需要实现 http request client");

  assert.equal(result.mode, "knowledge-hit");
  assert.deepEqual(
    result.matchedPractices.map((practice) => practice.id),
    ["practice-http-client"]
  );
  assert.deepEqual(
    result.recommendedOptions.map((option) => option.id),
    ["option-unified-client", "option-direct-call"]
  );
});

test("runPreflight keeps knowledge-hit output within a small context budget", async () => {
  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "project-knowledge-budget-"));
  const knowledgeRoot = path.join(projectRoot, ".project-knowledge");

  await fs.cp(path.join(fixtureProjectRoot, ".project-knowledge"), knowledgeRoot, {
    recursive: true
  });
  await fs.mkdir(path.join(knowledgeRoot, "practices"), { recursive: true });
  await fs.mkdir(path.join(knowledgeRoot, "options"), { recursive: true });

  for (let index = 1; index <= 8; index += 1) {
    const practiceId = `practice-cache-${index}`;
    const optionId = `option-cache-${index}`;
    const evidence = Array.from({ length: 8 }, (_, evidenceIndex) =>
      `src/cache/${index}/evidence-${evidenceIndex + 1}.ts`
    );

    await fs.writeFile(
      path.join(knowledgeRoot, "practices", `${practiceId}.md`),
      renderPractice({ practiceId, optionId, evidence }),
      "utf8"
    );
    await fs.writeFile(
      path.join(knowledgeRoot, "options", `${optionId}.md`),
      renderOption({ practiceId, optionId, evidence }),
      "utf8"
    );
  }

  const result = await runPreflight(projectRoot, "cache strategy");

  assert.equal(result.mode, "knowledge-hit");
  assert.equal(result.limits.maxMatchedPractices, 5);
  assert.equal(result.limits.maxEvidencePerNode, 5);
  assert.equal(result.matchedPractices.length, 5);
  assert.equal(result.recommendedOptions.length, 5);
  assert.equal(result.matchedPractices[0].source_evidence_count, 8);
  assert.equal(result.matchedPractices[0].source_evidence_truncated, true);
  assert.equal(result.matchedPractices[0].source_evidence.length, 5);
  assert.equal(result.recommendedOptions[0].source_evidence_count, 8);
  assert.equal(result.recommendedOptions[0].source_evidence_truncated, true);
  assert.equal(result.recommendedOptions[0].source_evidence.length, 5);
  assert.ok(result.evidenceHintCount > result.evidenceHints.length);
  assert.equal(result.evidenceHintsTruncated, true);
  assert.ok(result.evidenceHints.length <= result.limits.maxEvidenceHints);
});

test("runPreflight excludes docs evidence from knowledge hits and scan hints", async () => {
  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "project-knowledge-doc-evidence-"));
  const knowledgeRoot = path.join(projectRoot, ".project-knowledge");

  await fs.cp(path.join(fixtureProjectRoot, ".project-knowledge"), knowledgeRoot, {
    recursive: true
  });
  const practicePath = path.join(knowledgeRoot, "practices", "practice-http-client.md");
  await fs.writeFile(
    practicePath,
    (await fs.readFile(practicePath, "utf8")).replace(
      "source_evidence:\n  - src/api/client.ts",
      "source_evidence:\n  - docs/engineering.md\n  - src/api/client.ts"
    ),
    "utf8"
  );

  const hit = await runPreflight(projectRoot, "实现 HTTP 请求");

  assert.deepEqual(hit.matchedPractices[0].source_evidence, ["src/api/client.ts"]);
  assert.equal(
    hit.evidenceHints.some((hint) => String(hint.path).startsWith("docs/")),
    false
  );

  await fs.mkdir(path.join(projectRoot, "docs"), { recursive: true });
  await fs.writeFile(path.join(projectRoot, "docs", "architecture.md"), "# Architecture\n", "utf8");
  const miss = await runPreflight(projectRoot, "完全未知的新能力");

  assert.equal(
    miss.evidenceHints.some((hint) => String(hint.path).startsWith("docs/")),
    false
  );
});

test("runPreflight scans local project files for evidence hints when knowledge has no match", async () => {
  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "project-knowledge-preflight-"));
  await fs.cp(path.join(fixtureProjectRoot, ".project-knowledge"), path.join(projectRoot, ".project-knowledge"), {
    recursive: true
  });
  await fs.mkdir(path.join(projectRoot, "src"), { recursive: true });
  await fs.writeFile(
    path.join(projectRoot, "package.json"),
    `${JSON.stringify({ name: "preflight-sample", type: "module" }, null, 2)}\n`,
    "utf8"
  );
  await fs.writeFile(
    path.join(projectRoot, "src", "logger.ts"),
    "export function logInfo(message: string) { console.log(message); }\n",
    "utf8"
  );

  const result = await runPreflight(projectRoot, "整理日志记录实践");

  assert.equal(result.mode, "needs-project-scan");
  assert.deepEqual(result.matchedPractices, []);
  assert.ok(
    result.evidenceHints.some((hint) => hint.path === "src/logger.ts" && hint.kind === "logger")
  );
});

test("runPreflight limits project-scan evidence hints by kind", async () => {
  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "project-knowledge-scan-budget-"));
  await fs.cp(path.join(fixtureProjectRoot, ".project-knowledge"), path.join(projectRoot, ".project-knowledge"), {
    recursive: true
  });
  await fs.mkdir(path.join(projectRoot, "src", "views", "demo"), { recursive: true });
  await fs.writeFile(
    path.join(projectRoot, "package.json"),
    `${JSON.stringify({ name: "scan-budget", type: "module" }, null, 2)}\n`,
    "utf8"
  );

  for (let index = 1; index <= 12; index += 1) {
    await fs.writeFile(
      path.join(projectRoot, "src", "views", "demo", `Page${index}.vue`),
      "<template><div /></template>\n",
      "utf8"
    );
  }

  const result = await runPreflight(projectRoot, "完全未知的新能力");
  const frontendHints = result.evidenceHints.filter((hint) => hint.kind === "frontend-page");

  assert.equal(result.mode, "needs-project-scan");
  assert.equal(result.limits.maxScanHintsPerKind, 5);
  assert.equal(frontendHints.length, 5);
  assert.equal(result.evidenceHintCount >= 12, true);
  assert.equal(result.evidenceHintsTruncated, true);
});

function renderPractice({ practiceId, optionId, evidence }) {
  return `---
id: ${practiceId}
type: practice
title: Cache Practice ${practiceId}
summary: cache strategy pattern ${practiceId}
contexts: []
constraints: []
rules: []
option_ids:
  - ${optionId}
keywords:
  - cache
  - strategy
status: active
maturity: stable
source_evidence:
${evidence.map((filePath) => `  - ${filePath}`).join("\n")}
session_refs: []
---

## Summary

cache strategy pattern ${practiceId}
`;
}

function renderOption({ practiceId, optionId, evidence }) {
  return `---
id: ${optionId}
type: option
title: Cache Option ${optionId}
summary: cache option ${optionId}
practice: ${practiceId}
base_score: 50
score_breakdown:
  consistency: 10
  efficiency: 10
  maintainability: 10
  extensibility: 10
  risk: 10
alternatives: []
keywords:
  - cache
status: active
maturity: stable
source_evidence:
${evidence.map((filePath) => `  - ${filePath}`).join("\n")}
session_refs: []
---

## Summary

cache option ${optionId}
`;
}
