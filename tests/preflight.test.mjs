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

test("runPreflight records hits only when explicitly enabled", async () => {
  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "project-knowledge-preflight-hit-usage-"));
  const knowledgeRoot = path.join(projectRoot, ".project-knowledge");

  await fs.cp(path.join(fixtureProjectRoot, ".project-knowledge"), knowledgeRoot, {
    recursive: true
  });
  const before = await readUsageIndex(knowledgeRoot);

  await runPreflight(projectRoot, "页面里需要实现 http request client");
  const afterDefault = await readUsageIndex(knowledgeRoot);

  assert.equal(afterDefault["practice-http-client"]?.preflight_hits || 0, 0);
  assert.equal(afterDefault["option-unified-client"]?.preflight_hits || 0, 0);

  const recorded = await runPreflight(projectRoot, "页面里需要实现 http request client", {
    recordHits: true,
    now: "2026-05-15T00:00:00.000Z"
  });
  const afterRecorded = await readUsageIndex(knowledgeRoot);

  assert.equal(recorded.mode, "knowledge-hit");
  assert.equal(afterRecorded["practice-http-client"].preflight_hits, 1);
  assert.equal(afterRecorded["practice-http-client"].last_hit_at, "2026-05-15");
  assert.equal(afterRecorded["option-unified-client"].preflight_hits, 1);
  assert.equal(afterRecorded["option-unified-client"].adopted_count, before["option-unified-client"].adopted_count);
  assert.equal(afterRecorded["option-unified-client"].last_hit_at, "2026-05-15");
  assert.equal(afterRecorded["option-direct-call"].preflight_hits, 1);
  assert.equal(afterRecorded["option-direct-call"].last_hit_at, "2026-05-15");
});

test("runPreflight matches practices through applies_when task intent", async () => {
  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "project-knowledge-intent-match-"));
  const knowledgeRoot = path.join(projectRoot, ".project-knowledge");

  await fs.cp(path.join(fixtureProjectRoot, ".project-knowledge"), knowledgeRoot, {
    recursive: true
  });
  await writeIntentPractice(knowledgeRoot, {
    practiceId: "practice-frontend-crud-intent",
    optionId: "option-frontend-crud-intent",
    appliesWhen: {
      task_kinds: ["frontend-page", "crud-list"],
      technologies: ["vue"],
      path_prefixes: ["src/views"]
    }
  });

  const result = await runPreflight(
    projectRoot,
    "新增 Vue 页面 src/views/users/UserList.vue，实现用户列表增删改查"
  );
  const matchedPractice = result.matchedPractices.find(
    (practice) => practice.id === "practice-frontend-crud-intent"
  );

  assert.equal(result.mode, "knowledge-hit");
  assert.ok(matchedPractice);
  assert.ok(matchedPractice.matchReasons.includes("task-kind:frontend-page"));
  assert.ok(matchedPractice.matchReasons.includes("task-kind:crud-list"));
  assert.ok(matchedPractice.matchReasons.includes("technology:vue"));
  assert.ok(matchedPractice.matchReasons.includes("path-prefix:src/views"));
});

test("runPreflight excludes practices through does_not_apply_when task intent", async () => {
  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "project-knowledge-intent-exclude-"));
  const knowledgeRoot = path.join(projectRoot, ".project-knowledge");

  await fs.cp(path.join(fixtureProjectRoot, ".project-knowledge"), knowledgeRoot, {
    recursive: true
  });
  await writeIntentPractice(knowledgeRoot, {
    practiceId: "practice-http-client-excluded-for-tests",
    optionId: "option-http-client-excluded-for-tests",
    keywords: ["http"],
    appliesWhen: {
      task_kinds: ["api-client"]
    },
    doesNotApplyWhen: {
      task_kinds: ["test"],
      path_prefixes: ["tests"]
    }
  });

  const result = await runPreflight(
    projectRoot,
    "为 tests/api/http-client.test.ts 增加 HTTP client 单元测试"
  );

  assert.equal(
    result.matchedPractices.some((practice) => practice.id === "practice-http-client-excluded-for-tests"),
    false
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
    await writeEvidenceFiles(projectRoot, evidence);

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
  await writeEvidenceFiles(projectRoot, ["src/api/client.ts"]);
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

test("runPreflight applies project evidence policy to evidence previews and scan hints", async () => {
  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "project-knowledge-preflight-evidence-policy-"));
  const knowledgeRoot = path.join(projectRoot, ".project-knowledge");

  await fs.cp(path.join(fixtureProjectRoot, ".project-knowledge"), knowledgeRoot, {
    recursive: true
  });
  await writeEvidenceFiles(projectRoot, ["docs/adr/http-client.md", "src/api/client.ts"]);
  await fs.writeFile(
    path.join(knowledgeRoot, "evidence-policy.json"),
    `${JSON.stringify(
      {
        ignoredPrefixes: ["generated/"],
        allowedPrefixes: ["docs/adr/"]
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  const practicePath = path.join(knowledgeRoot, "practices", "practice-http-client.md");
  await fs.writeFile(
    practicePath,
    (await fs.readFile(practicePath, "utf8")).replace(
      "source_evidence: [src/api/client.ts, docs/engineering.md]",
      "source_evidence: [docs/adr/http-client.md, docs/tmp.md, generated/client.ts, src/api/client.ts]"
    ),
    "utf8"
  );

  const hit = await runPreflight(projectRoot, "实现 HTTP 请求");

  assert.deepEqual(hit.matchedPractices[0].source_evidence, [
    "docs/adr/http-client.md",
    "src/api/client.ts"
  ]);

  await fs.mkdir(path.join(projectRoot, "generated"), { recursive: true });
  await fs.writeFile(path.join(projectRoot, "generated", "client.ts"), "export const generated = true;\n", "utf8");
  const miss = await runPreflight(projectRoot, "完全未知的新能力");

  assert.ok(miss.evidenceHints.some((hint) => hint.path === "docs/adr/http-client.md"));
  assert.equal(
    miss.evidenceHints.some((hint) => String(hint.path).startsWith("generated/")),
    false
  );
});

test("runPreflight excludes missing evidence paths from knowledge hints", async () => {
  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "project-knowledge-preflight-missing-evidence-"));
  const knowledgeRoot = path.join(projectRoot, ".project-knowledge");

  await fs.cp(path.join(fixtureProjectRoot, ".project-knowledge"), knowledgeRoot, {
    recursive: true
  });
  await fs.mkdir(path.join(projectRoot, "src", "api"), { recursive: true });
  await fs.writeFile(path.join(projectRoot, "src", "api", "client.ts"), "export const client = true;\n", "utf8");

  const practicePath = path.join(knowledgeRoot, "practices", "practice-http-client.md");
  await fs.writeFile(
    practicePath,
    (await fs.readFile(practicePath, "utf8")).replace(
      "source_evidence: [src/api/client.ts, docs/engineering.md]",
      "source_evidence: [src/moved/client.ts, src/api/client.ts]"
    ),
    "utf8"
  );

  const result = await runPreflight(projectRoot, "实现 HTTP 请求");

  assert.equal(result.mode, "knowledge-hit");
  assert.deepEqual(result.matchedPractices[0].source_evidence, ["src/api/client.ts"]);
  assert.equal(
    result.evidenceHints.some((hint) => hint.path === "src/moved/client.ts"),
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

async function writeIntentPractice(
  knowledgeRoot,
  { practiceId, optionId, keywords = [], appliesWhen = {}, doesNotApplyWhen = {} }
) {
  await fs.writeFile(
    path.join(knowledgeRoot, "practices", `${practiceId}.md`),
    `---
id: ${practiceId}
type: practice
title: Intent Practice ${practiceId}
summary: Intent practice summary without task-specific keywords.
contexts: []
constraints: []
rules: []
option_ids: [${optionId}]
keywords: [${keywords.join(", ")}]
status: active
maturity: stable
source_evidence: [src/views/intent.ts]
session_refs: []
applies_when:
  task_kinds: [${(appliesWhen.task_kinds || []).join(", ")}]
  technologies: [${(appliesWhen.technologies || []).join(", ")}]
  path_prefixes: [${(appliesWhen.path_prefixes || []).join(", ")}]
does_not_apply_when:
  task_kinds: [${(doesNotApplyWhen.task_kinds || []).join(", ")}]
  path_prefixes: [${(doesNotApplyWhen.path_prefixes || []).join(", ")}]
---

## Summary

Intent practice summary without task-specific keywords.
`,
    "utf8"
  );
  await fs.writeFile(
    path.join(knowledgeRoot, "options", `${optionId}.md`),
    `---
id: ${optionId}
type: option
title: Intent Option ${optionId}
summary: Intent option summary.
practice: ${practiceId}
base_score: 50
score_breakdown:
  consistency: 10
  efficiency: 10
  maintainability: 10
  extensibility: 10
  risk: 10
alternatives: []
keywords: []
status: active
maturity: stable
source_evidence: [src/views/intent-option.ts]
session_refs: []
---

## Summary

Intent option summary.
`,
    "utf8"
  );
}

async function readUsageIndex(knowledgeRoot) {
  return JSON.parse(
    await fs.readFile(path.join(knowledgeRoot, "state", "usage-index.json"), "utf8")
  );
}

async function writeEvidenceFiles(projectRoot, relativePaths) {
  for (const relativePath of relativePaths) {
    const absolutePath = path.join(projectRoot, relativePath);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, `// evidence: ${relativePath}\n`, "utf8");
  }
}
