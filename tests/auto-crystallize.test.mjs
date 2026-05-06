import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { autoCrystallizeSession } from "../scripts/auto-crystallize-session.mjs";
import { runPreflight } from "../scripts/preflight-session.mjs";

const execFileAsync = promisify(execFile);

const fixtureRoot = path.resolve("tests", "fixtures", "sample-project");

test("autoCrystallizeSession skips project knowledge when pk-init has not run", async () => {
  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "project-knowledge-auto-uninitialized-"));

  await fs.writeFile(
    path.join(projectRoot, "package.json"),
    `${JSON.stringify({ name: "uninitialized-project" }, null, 2)}\n`,
    "utf8"
  );

  const result = await autoCrystallizeSession(projectRoot, {
    sessionId: "session-2026-04-30-uninitialized",
    title: "未初始化项目不沉淀知识",
    taskText: "实现一个普通功能",
    touchedFiles: ["src/example.ts"]
  });

  assert.equal(result.mode, "no-knowledge");
  assert.equal(result.skipped, true);
  assert.equal(result.reason, "project-knowledge-not-initialized");
  assert.equal(result.knowledgeRoot, path.join(projectRoot, ".project-knowledge"));
  assert.deepEqual(result.incubatingNodeIds, []);
  assert.deepEqual(result.adoptedNodeIds, []);
  assert.deepEqual(result.auto.touchedFiles, []);
  assert.equal(result.auto.preflightMode, "no-knowledge");
  assert.equal(await fileExists(path.join(projectRoot, ".project-knowledge")), false);
});

test("autoCrystallizeSession records adopted recommendations when task matches existing knowledge", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "project-knowledge-auto-hit-"));
  const projectRoot = path.join(tempRoot, "sample-project");

  await fs.cp(fixtureRoot, projectRoot, { recursive: true });

  const result = await autoCrystallizeSession(projectRoot, {
    sessionId: "session-2026-04-28-auto-hit",
    title: "自动沉淀已有实践",
    topic: "http-client",
    taskText: "实现 HTTP 调用",
    decisionSummary: "本轮继续采用统一 HTTP client 方案。",
    touchedFiles: ["src/api/client.ts"]
  });

  assert.equal(result.mode, "session+stable-update");
  assert.deepEqual(result.adoptedNodeIds, ["option-unified-client"]);
  assert.deepEqual(result.incubatingNodeIds, []);
  assert.equal(result.auto.touchedFiles.length, 1);
  assert.equal(result.auto.preflightMode, "knowledge-hit");

  const usageIndex = JSON.parse(
    await fs.readFile(
      path.join(projectRoot, ".project-knowledge", "state", "usage-index.json"),
      "utf8"
    )
  );
  const session = await fs.readFile(
    path.join(projectRoot, ".project-knowledge", "sessions", "session-2026-04-28-auto-hit.md"),
    "utf8"
  );

  assert.equal(usageIndex["option-unified-client"].adopted_count, 2);
  assert.match(session, /adopted_nodes:/);
  assert.match(session, /option-unified-client/);
});

test("autoCrystallizeSession creates incubating practice and option when no knowledge matches touched files", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "project-knowledge-auto-miss-"));
  const projectRoot = path.join(tempRoot, "sample-project");

  await fs.cp(fixtureRoot, projectRoot, { recursive: true });

  const result = await autoCrystallizeSession(projectRoot, {
    sessionId: "session-2026-04-28-auto-miss",
    title: "自动沉淀新场景",
    topic: "pdf-export-cache",
    taskText: "PDF export cache strategy",
    decisionSummary: "本轮形成 PDF 导出缓存的候选做法。",
    touchedFiles: ["src/export/pdf.ts"]
  });

  assert.equal(result.mode, "session+incubating");
  assert.deepEqual(result.adoptedNodeIds, []);
  assert.deepEqual(result.incubatingNodeIds, [
    "practice-pdf-export-cache-strategy",
    "option-pdf-export-cache-strategy-candidate"
  ]);
  assert.equal(result.auto.preflightMode, "needs-project-scan");

  const practice = await fs.readFile(
    path.join(
      projectRoot,
      ".project-knowledge",
      "incubating",
      "practices",
      "practice-pdf-export-cache-strategy.md"
    ),
    "utf8"
  );
  const option = await fs.readFile(
    path.join(
      projectRoot,
      ".project-knowledge",
      "incubating",
      "options",
      "option-pdf-export-cache-strategy-candidate.md"
    ),
    "utf8"
  );

  assert.match(practice, /maturity: incubating/);
  assert.match(practice, /option-pdf-export-cache-strategy-candidate/);
  assert.match(practice, /src\/export\/pdf\.ts/);
  assert.match(option, /practice: practice-pdf-export-cache-strategy/);
  assert.match(option, /src\/export\/pdf\.ts/);
});

test("autoCrystallizeSession excludes volatile agent artifacts from touched files and evidence", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "project-knowledge-auto-evidence-filter-"));
  const projectRoot = path.join(tempRoot, "sample-project");

  await fs.cp(fixtureRoot, projectRoot, { recursive: true });

  const result = await autoCrystallizeSession(projectRoot, {
    sessionId: "session-2026-04-28-auto-evidence-filter",
    title: "事件总线重试策略",
    topic: "event-bus-retry",
    taskText: "event bus retry strategy",
    decisionSummary: "本轮形成事件总线重试策略的候选做法。",
    touchedFiles: [
      "docs/architecture/event-bus.md",
      "docs/plans/2026-04-28-agent-plan.md",
      ".worktrees/feature/src/runtime/eventBus.ts",
      "task_plan.md",
      "findings.md",
      "progress.md",
      "src/runtime/eventBus.ts"
    ]
  });

  assert.equal(result.mode, "session+incubating");
  assert.deepEqual(result.auto.touchedFiles, ["src/runtime/eventBus.ts"]);

  const session = await fs.readFile(
    path.join(
      projectRoot,
      ".project-knowledge",
      "sessions",
      "session-2026-04-28-auto-evidence-filter.md"
    ),
    "utf8"
  );
  const practice = await fs.readFile(
    path.join(
      projectRoot,
      ".project-knowledge",
      "incubating",
      "practices",
      "practice-event-bus-retry-strategy.md"
    ),
    "utf8"
  );
  const option = await fs.readFile(
    path.join(
      projectRoot,
      ".project-knowledge",
      "incubating",
      "options",
      "option-event-bus-retry-strategy-candidate.md"
    ),
    "utf8"
  );

  assert.match(session, /src\/runtime\/eventBus\.ts/);
  assert.doesNotMatch(session, /docs\/|\.worktrees|task_plan\.md|findings\.md|progress\.md/);
  assert.match(practice, /src\/runtime\/eventBus\.ts/);
  assert.doesNotMatch(practice, /docs\/|\.worktrees|task_plan\.md|findings\.md|progress\.md/);
  assert.match(option, /src\/runtime\/eventBus\.ts/);
  assert.doesNotMatch(option, /docs\/|\.worktrees|task_plan\.md|findings\.md|progress\.md/);
});

test("autoCrystallizeSession avoids incubating knowledge when only volatile files changed", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "project-knowledge-auto-only-volatile-"));
  const projectRoot = path.join(tempRoot, "sample-project");

  await fs.cp(fixtureRoot, projectRoot, { recursive: true });

  const result = await autoCrystallizeSession(projectRoot, {
    sessionId: "session-2026-04-28-auto-only-volatile",
    title: "仅临时文件变更",
    topic: "volatile-only",
    taskText: "temporary planning only",
    decisionSummary: "本轮只有临时计划文件和 worktree 文件被修改。",
    touchedFiles: [
      "docs/architecture/event-bus.md",
      "docs/plans/2026-04-28-agent-plan.md",
      ".worktrees/feature/src/runtime/eventBus.ts",
      "task_plan.md",
      "findings.md",
      "progress.md"
    ]
  });

  assert.equal(result.mode, "session-only");
  assert.deepEqual(result.auto.touchedFiles, []);
  assert.deepEqual(result.incubatingNodeIds, []);

  const session = await fs.readFile(
    path.join(
      projectRoot,
      ".project-knowledge",
      "sessions",
      "session-2026-04-28-auto-only-volatile.md"
    ),
    "utf8"
  );

  assert.match(session, /touched_files: \[\]/);
  assert.doesNotMatch(session, /docs\/|\.worktrees|task_plan\.md|findings\.md|progress\.md/);
});

test("autoCrystallizeSession generalizes long-running scheduler knowledge beyond business nouns", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "project-knowledge-auto-generalized-"));
  const projectRoot = path.join(tempRoot, "sample-project");

  await fs.cp(fixtureRoot, projectRoot, { recursive: true });

  const result = await autoCrystallizeSession(projectRoot, {
    sessionId: "session-2026-04-29-inventory-auto-tracking-sync",
    title: "库存状态自动同步全局调度器接入",
    topic: "库存状态自动同步外部平台信息",
    taskText: "库存状态自动同步应拆分纯调度 core 与浏览器接线入口，登录后全局初始化，页面只负责 hover 文案和开关配置。",
    decisionSummary: "库存状态自动同步不能绑定列表页面生命周期；应在用户信息加载成功后初始化全局调度器，读取当前账号开关和上次同步时间，再按需同步待处理列表。",
    touchedFiles: [
      "src/stores/user.ts",
      "src/views/inventory/pages/list/services/autoTrackingSyncScheduler.ts",
      "src/views/inventory/pages/list/services/autoTrackingSyncSchedulerCore.ts"
    ]
  });

  assert.equal(result.mode, "session+incubating");
  assert.deepEqual(result.incubatingNodeIds, [
    "practice-long-running-auto-task-global-scheduler",
    "option-login-ready-global-scheduler"
  ]);

  const practice = await fs.readFile(
    path.join(
      projectRoot,
      ".project-knowledge",
      "incubating",
      "practices",
      "practice-long-running-auto-task-global-scheduler.md"
    ),
    "utf8"
  );
  const option = await fs.readFile(
    path.join(
      projectRoot,
      ".project-knowledge",
      "incubating",
      "options",
      "option-login-ready-global-scheduler.md"
    ),
    "utf8"
  );

  assert.match(practice, /title: 长周期自动任务应使用登录态就绪后的全局调度器/);
  assert.match(practice, /自动任务不应绑定具体页面生命周期/);
  assert.match(practice, /自动同步/);
  assert.match(practice, /页面生命周期/);
  assert.doesNotMatch(practice, /title: .*库存状态/);
  assert.match(option, /title: 登录态就绪后初始化全局调度器/);
  assert.match(option, /practice: practice-long-running-auto-task-global-scheduler/);

  const preflight = await runPreflight(
    projectRoot,
    "自动同步任务不要绑在页面生命周期里，登录后通过全局调度器执行"
  );

  assert.equal(preflight.mode, "knowledge-hit");
  assert.equal(preflight.matchedPractices[0].id, "practice-long-running-auto-task-global-scheduler");
});

test("auto crystallize CLI accepts JSON input and reports automatic metadata", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "project-knowledge-auto-cli-"));
  const projectRoot = path.join(tempRoot, "sample-project");
  const inputPath = path.join(tempRoot, "auto-crystallize-input.json");

  await fs.cp(fixtureRoot, projectRoot, { recursive: true });
  await fs.writeFile(
    inputPath,
    `${JSON.stringify(
      {
        sessionId: "session-2026-04-28-auto-cli",
        title: "自动 CLI 沉淀",
        topic: "http-client",
        taskText: "实现 HTTP 调用",
        decisionSummary: "通过自动 CLI 记录一次推荐实践采纳。",
        touchedFiles: ["src/api/client.ts"]
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  const { stdout } = await execFileAsync(process.execPath, [
    path.resolve("scripts", "auto-crystallize-session.mjs"),
    projectRoot,
    inputPath
  ]);
  const result = JSON.parse(stdout);

  assert.equal(result.mode, "session+stable-update");
  assert.deepEqual(result.adoptedNodeIds, ["option-unified-client"]);
  assert.equal(result.auto.preflightMode, "knowledge-hit");
});

test("auto crystallize CLI exits cleanly when project knowledge is missing", async () => {
  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "project-knowledge-auto-cli-uninitialized-"));

  const { stdout } = await execFileAsync(process.execPath, [
    path.resolve("scripts", "auto-crystallize-session.mjs"),
    projectRoot,
    "实现一个普通功能"
  ]);
  const result = JSON.parse(stdout);

  assert.equal(result.mode, "no-knowledge");
  assert.equal(result.skipped, true);
  assert.equal(result.reason, "project-knowledge-not-initialized");
  assert.equal(await fileExists(path.join(projectRoot, ".project-knowledge")), false);
});

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
