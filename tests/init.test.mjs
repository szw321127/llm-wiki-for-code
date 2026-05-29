import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { initializeProjectKnowledge } from "../scripts/init-project-knowledge.mjs";

const fixtureRoot = path.resolve("tests", "fixtures", "init-sample-project");

test("initializeProjectKnowledge bootstraps .repowise from local code and docs", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "project-knowledge-init-"));
  const projectRoot = path.join(tempRoot, "sample-project");

  await fs.cp(fixtureRoot, projectRoot, { recursive: true });
  await fs.mkdir(path.join(projectRoot, ".worktrees", "feature", "src", "api"), { recursive: true });
  await fs.writeFile(
    path.join(projectRoot, ".worktrees", "feature", "src", "api", "client.ts"),
    "export const ignoredClient = () => fetch('/ignored');\n",
    "utf8"
  );
  await fs.mkdir(path.join(projectRoot, "docs", "plans"), { recursive: true });
  await fs.writeFile(
    path.join(projectRoot, "docs", "plans", "2026-04-29-agent-plan.md"),
    "# Agent planning draft\n\n不应作为项目知识证据。\n",
    "utf8"
  );
  await fs.writeFile(
    path.join(projectRoot, "task_plan.md"),
    "# 临时任务计划\n\n不应作为项目知识证据。\n",
    "utf8"
  );
  await fs.mkdir(path.join(projectRoot, "src", "nested"), { recursive: true });
  await fs.writeFile(
    path.join(projectRoot, "src", "nested", "README.md"),
    "# 嵌套 README\n\n不应作为项目文档入口。\n",
    "utf8"
  );
  await fs.mkdir(path.join(projectRoot, "src", "views", "demo"), { recursive: true });
  await fs.writeFile(
    path.join(projectRoot, "src", "views", "demo", "config.ts"),
    "export const tableColumns = [];\n",
    "utf8"
  );
  await fs.mkdir(path.join(projectRoot, "public", "ckeditor"), { recursive: true });
  await fs.writeFile(
    path.join(projectRoot, "public", "ckeditor", "config.js"),
    "window.CKEDITOR_CONFIG = {};\n",
    "utf8"
  );

  const summary = await initializeProjectKnowledge(projectRoot);
  const knowledgeRoot = path.join(projectRoot, ".repowise");
  const projectProfile = await fs.readFile(path.join(knowledgeRoot, "project-profile.md"), "utf8");
  const practice = await fs.readFile(
    path.join(knowledgeRoot, "practices", "practice-http-client.md"),
    "utf8"
  );
  const incubatingOption = await fs.readFile(
    path.join(knowledgeRoot, "incubating", "options", "option-direct-call.md"),
    "utf8"
  );
  const centralizedConfigOption = await fs.readFile(
    path.join(knowledgeRoot, "options", "option-centralized-config.md"),
    "utf8"
  );
  const launcherPath = path.join(knowledgeRoot, "open-graph.cmd");
  const launcherToolPath = path.join(knowledgeRoot, "tools", "serve-project-knowledge.mjs");
  const evidencePolicy = JSON.parse(await fs.readFile(path.join(knowledgeRoot, "evidence-policy.json"), "utf8"));
  const obsidianIndex = await fs.readFile(path.join(knowledgeRoot, "index.md"), "utf8");
  const obsidianLog = await fs.readFile(path.join(knowledgeRoot, "log.md"), "utf8");
  const practiceView = await fs.readFile(path.join(knowledgeRoot, "_views", "practices.md"), "utf8");

  assert.equal(summary.projectRoot, projectRoot);
  assert.deepEqual(summary.tech, ["typescript", "vue", "node"]);
  assert.ok(summary.stableNodeIds.includes("practice-http-client"));
  assert.ok(summary.incubatingNodeIds.includes("option-direct-call"));
  assert.match(projectProfile, /title: 示例初始化项目/);
  assert.match(projectProfile, /adopted_rules:/);
  assert.doesNotMatch(projectProfile, /docs\/engineering\.md/);
  assert.doesNotMatch(projectProfile, /docs\/plans/);
  assert.doesNotMatch(projectProfile, /task_plan\.md/);
  assert.doesNotMatch(projectProfile, /src\/nested\/README\.md/);
  assert.match(practice, /HTTP 调用封装实践/);
  assert.doesNotMatch(practice, /\.worktrees/);
  assert.match(incubatingOption, /maturity: incubating/);
  assert.match(centralizedConfigOption, /src\/config\/env\.ts/);
  assert.doesNotMatch(centralizedConfigOption, /src\/views\/demo\/config\.ts/);
  assert.doesNotMatch(centralizedConfigOption, /public\/ckeditor\/config\.js/);
  assert.equal(
    await fileExists(path.join(knowledgeRoot, "graph", "graph-data.json")),
    true
  );
  assert.equal(
    await fileExists(path.join(knowledgeRoot, "graph", "knowledge-graph.html")),
    true
  );
  assert.equal(await fileExists(path.join(knowledgeRoot, ".obsidian", "app.json")), true);
  assert.equal(await fileExists(path.join(knowledgeRoot, ".obsidian", "graph.json")), true);
  assert.match(obsidianIndex, /\[\[project-profile\]\]/);
  assert.match(obsidianIndex, /\[\[practice-http-client\]\]/);
  assert.match(obsidianIndex, /\[\[option-unified-client\]\]/);
  assert.match(obsidianLog, /pk:init/);
  assert.match(practiceView, /\[\[practice-http-client\]\]/);
  assert.match(practiceView, /\[\[option-unified-client\]\]/);
  assert.equal(evidencePolicy.useDefaultIgnores, true);
  assert.deepEqual(evidencePolicy.ignoredPrefixes, []);
  assert.deepEqual(evidencePolicy.ignoredBasenames, []);
  assert.deepEqual(evidencePolicy.allowedPrefixes, []);
  assert.equal(evidencePolicy.allowAbsolutePaths, false);
  assert.equal(await fileExists(launcherPath), true);
  assert.equal(await fileExists(launcherToolPath), true);

  const launcher = await fs.readFile(launcherPath, "utf8");
  assert.match(launcher, /serve-project-knowledge\.mjs/);
  assert.match(launcher, /%~dp0tools\\serve-project-knowledge\.mjs/);
  assert.doesNotMatch(launcher, /universal-practice-knowledge-graph/);
  assert.doesNotMatch(launcher, /[A-Za-z]:\\/);
  assert.doesNotMatch(launcher, /set "NODE_EXE=.*[A-Za-z]:/);
  assert.match(launcher, /127\.0\.0\.1/);
  assert.match(launcher, /8124/);
});

test("initializeProjectKnowledge does not create centralized config recommendations from page-level config files", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "project-knowledge-inline-config-"));
  const projectRoot = path.join(tempRoot, "inline-config-project");

  await fs.mkdir(path.join(projectRoot, "src", "views", "demo"), { recursive: true });
  await fs.writeFile(
    path.join(projectRoot, "package.json"),
    `${JSON.stringify({ name: "inline-config-project", dependencies: { vue: "^3.0.0" } }, null, 2)}\n`,
    "utf8"
  );
  await fs.writeFile(path.join(projectRoot, "README.md"), "# inline-config-project\n", "utf8");
  await fs.writeFile(
    path.join(projectRoot, "src", "views", "demo", "config.ts"),
    "export const tableColumns = [];\n",
    "utf8"
  );
  await fs.writeFile(
    path.join(projectRoot, "src", "views", "demo", "index.vue"),
    "const mode = process.env.NODE_ENV;\n",
    "utf8"
  );

  const summary = await initializeProjectKnowledge(projectRoot);
  const knowledgeRoot = path.join(projectRoot, ".repowise");
  const practice = await fs.readFile(
    path.join(knowledgeRoot, "incubating", "practices", "practice-config-management.md"),
    "utf8"
  );
  const inlineOption = await fs.readFile(
    path.join(knowledgeRoot, "incubating", "options", "option-inline-config.md"),
    "utf8"
  );

  assert.ok(summary.incubatingNodeIds.includes("practice-config-management"));
  assert.ok(summary.incubatingNodeIds.includes("option-inline-config"));
  assert.equal(
    await fileExists(path.join(knowledgeRoot, "options", "option-centralized-config.md")),
    false
  );
  assert.match(practice, /maturity: incubating/);
  assert.match(practice, /option-inline-config/);
  assert.doesNotMatch(practice, /src\/views\/demo\/config\.ts/);
  assert.match(inlineOption, /practice: practice-config-management/);
  assert.doesNotMatch(inlineOption, /option-centralized-config/);
});

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
