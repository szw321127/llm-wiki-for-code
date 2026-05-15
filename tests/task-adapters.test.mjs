import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { loadTaskContext } from "../scripts/task-adapters.mjs";

const taskFixtureRoot = path.resolve("tests", "fixtures", "task-context-sample");

test("loadTaskContext builds task text and process sources from a generic task directory", async () => {
  const context = await loadTaskContext(taskFixtureRoot, {
    taskDir: ".tasks/http-client-retry"
  });

  assert.equal(context.title, "Add HTTP client retry policy");
  assert.equal(context.topic, "http-client-retry");
  assert.match(context.taskText, /Add HTTP client retry policy/);
  assert.match(context.taskText, /Use the shared request client/);
  assert.match(context.taskText, /Retry policy belongs in `src\/api\/client\.ts`/);
  assert.deepEqual(context.candidateEvidenceHints, [
    "src/api/client.ts",
    "src/api/retryPolicy.ts",
    "src/pages/orders/OrderList.vue"
  ]);
  assert.deepEqual(context.processSources, [
    ".tasks/http-client-retry/prd.md",
    ".tasks/http-client-retry/research/retry-policy.md",
    ".tasks/http-client-retry/implement.jsonl",
    ".tasks/http-client-retry/check.jsonl",
    ".tasks/http-client-retry/task.json"
  ]);
});

test("loadTaskContext resolves taskId through the generic .tasks layout", async () => {
  const context = await loadTaskContext(taskFixtureRoot, {
    taskId: "http-client-retry"
  });

  assert.equal(context.topic, "http-client-retry");
  assert.ok(context.processSources.includes(".tasks/http-client-retry/prd.md"));
});

test("loadTaskContext resolves taskId through the generic tasks layout", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "project-knowledge-task-context-"));
  const projectRoot = path.join(tempRoot, "sample-project");

  await fs.mkdir(path.join(projectRoot, "tasks"), { recursive: true });
  await fs.cp(
    path.join(taskFixtureRoot, ".tasks", "http-client-retry"),
    path.join(projectRoot, "tasks", "http-client-retry"),
    { recursive: true }
  );

  const context = await loadTaskContext(projectRoot, {
    taskId: "http-client-retry"
  });

  assert.equal(context.topic, "http-client-retry");
  assert.ok(context.processSources.includes("tasks/http-client-retry/prd.md"));
});

test("loadTaskContext returns an empty context when taskId has no matching directory", async () => {
  const context = await loadTaskContext(taskFixtureRoot, {
    taskId: "missing-task"
  });

  assert.deepEqual(context, {
    title: null,
    topic: null,
    decisionSummary: null,
    taskText: "",
    candidateEvidenceHints: [],
    processSources: []
  });
});

test("loadTaskContext ignores malformed task.json without dropping other task context", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "project-knowledge-task-context-bad-json-"));
  const projectRoot = path.join(tempRoot, "sample-project");
  const taskDir = path.join(projectRoot, ".tasks", "bad-json");

  await fs.mkdir(taskDir, { recursive: true });
  await fs.writeFile(path.join(taskDir, "task.json"), "{bad json", "utf8");
  await fs.writeFile(
    path.join(taskDir, "prd.md"),
    "# Bad JSON Task\n\nUse `src/api/client.ts` for retry handling.\n",
    "utf8"
  );

  const context = await loadTaskContext(projectRoot, {
    taskId: "bad-json"
  });

  assert.equal(context.title, "Bad JSON Task");
  assert.match(context.taskText, /Use `src\/api\/client\.ts`/);
  assert.deepEqual(context.candidateEvidenceHints, ["src/api/client.ts"]);
  assert.deepEqual(context.processSources, [".tasks/bad-json/prd.md"]);
});

test("loadTaskContext returns an empty context when no task context is requested", async () => {
  const context = await loadTaskContext(taskFixtureRoot, {});

  assert.deepEqual(context, {
    title: null,
    topic: null,
    decisionSummary: null,
    taskText: "",
    candidateEvidenceHints: [],
    processSources: []
  });
});
