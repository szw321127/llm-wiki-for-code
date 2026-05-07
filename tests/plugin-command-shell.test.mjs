import assert from "node:assert/strict";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

const root = path.resolve(".");
const marketplacePath = path.join(root, ".agents", "plugins", "marketplace.json");
const pluginRoot = path.join(root, "plugins", "pk");
const pluginManifestPath = path.join(pluginRoot, ".codex-plugin", "plugin.json");
const pluginManifest = JSON.parse(fs.readFileSync(pluginManifestPath, "utf8"));
const readmePath = path.join(root, "README.md");
const englishReadmePath = path.join(root, "README_EN.md");
const rootSkillPath = path.join(root, "SKILL.md");
const commandDirectory = path.join(pluginRoot, "commands");
const skillsDirectory = path.join(pluginRoot, "skills");
const initFixtureRoot = path.resolve("tests", "fixtures", "init-sample-project");

test("repository exposes a local Codex marketplace for the pk plugin", () => {
  assert.equal(fs.existsSync(marketplacePath), true);
  const marketplace = JSON.parse(fs.readFileSync(marketplacePath, "utf8"));

  assert.equal(marketplace.name, "local-project-knowledge");
  assert.equal(marketplace.interface.displayName, "LLM Wiki for Code");
  assert.equal(Array.isArray(marketplace.plugins), true);

  const pkPlugin = marketplace.plugins.find((plugin) => plugin.name === "pk");
  assert.ok(pkPlugin);
  assert.deepEqual(pkPlugin.source, {
    source: "local",
    path: "./plugins/pk"
  });
  assert.deepEqual(pkPlugin.policy, {
    installation: "AVAILABLE",
    authentication: "ON_INSTALL"
  });
  assert.equal(pkPlugin.category, "Productivity");
});

test("repository docs expose pk as a skill-based workflow", () => {
  const readme = fs.readFileSync(readmePath, "utf8");
  const englishReadme = fs.readFileSync(englishReadmePath, "utf8");
  const rootSkill = fs.readFileSync(rootSkillPath, "utf8");

  assert.doesNotMatch(readme, /\/pk:/);
  assert.match(readme, /pk-init/);
  assert.match(readme, /pk-status/);
  assert.match(readme, /\[英文文档\]\(README_EN\.md\)/);
  assert.match(englishReadme, /\[中文文档\]\(README\.md\)/);
  assert.match(englishReadme, /pk-init/);

  assert.doesNotMatch(rootSkill, /\/pk:/);
  assert.match(rootSkill, /pk-init/);
  assert.match(rootSkill, /pk-graph/);
});

test("pk plugin manifest exposes skill-bundle metadata", () => {
  assert.equal(fs.existsSync(pluginManifestPath), true);

  assert.equal(pluginManifest.name, "pk");
  assert.equal(pluginManifest.skills, "./skills/");
  assert.equal(pluginManifest.interface.displayName, "PK");
  assert.equal(pluginManifest.interface.category, "Productivity");
  assert.doesNotMatch(pluginManifest.description, /command shell/i);
  assert.doesNotMatch(pluginManifest.interface.shortDescription, /command shell/i);
  assert.doesNotMatch(pluginManifest.interface.longDescription, /\/pk:/);
  assert.deepEqual(pluginManifest.interface.defaultPrompt, [
    "Use the `pk-init` skill to initialize `.project-knowledge/` for the current project.",
    "Use the `pk-preflight` skill before implementation to retrieve matching practices or local evidence hints.",
    "Use the `pk-status` skill to summarize the current project knowledge state.",
    "Use the `pk-crystallize` skill to persist stable knowledge from the current session.",
    "Use the `pk-auto-crystallize` skill after task completion to infer adopted practices or incubating candidates from the task and touched files.",
    "Use the `pk-lint` skill to inspect recommendation-pool lifecycle governance, evidence health, and possible duplicates.",
    "Use the `pk-govern` skill to automatically apply reversible project knowledge governance actions."
  ]);
});

test("pk plugin no longer relies on slash-command docs", () => {
  const commands = ["init", "status", "graph", "crystallize", "serve"];

  for (const command of commands) {
    const commandPath = path.join(commandDirectory, `${command}.md`);
    assert.equal(fs.existsSync(commandPath), false);
  }
});

test("pk plugin exposes skill wrapper docs without slash-command wording", () => {
  const skills = [
    ["pk-init", "init-project-knowledge.mjs"],
    ["pk-preflight", "preflight-session.mjs"],
    ["pk-status", "status-report.mjs"],
    ["pk-graph", "build-project-graph-data.mjs"],
    ["pk-crystallize", "crystallize-session.mjs"],
    ["pk-auto-crystallize", "auto-crystallize-session.mjs"],
    ["pk-lint", "lint-project-knowledge.mjs"],
    ["pk-govern", "govern-project-knowledge.mjs"],
    ["pk-serve", "serve-project-knowledge.mjs"]
  ];

  for (const [skillName, scriptName] of skills) {
    const skillPath = path.join(skillsDirectory, skillName, "SKILL.md");
    assert.equal(fs.existsSync(skillPath), true);
    const source = fs.readFileSync(skillPath, "utf8");
    assert.match(source, new RegExp(`name:\\s*${skillName}`));
    assert.match(source, new RegExp(scriptName.replace(".", "\\.")));
    assert.doesNotMatch(source, /\/pk:/);
    assert.match(source, /skill/i);
  }
});

test("pk init wrapper stays runnable after copying the plugin into a cache-style layout", async () => {
  const tempRoot = await fsp.mkdtemp(path.join(os.tmpdir(), "pk-plugin-cache-"));
  const cachedPluginRoot = path.join(
    tempRoot,
    "cache",
    "local-project-knowledge",
    "pk",
    pluginManifest.version
  );
  const projectRoot = path.join(tempRoot, "sample-project");

  await fsp.cp(pluginRoot, cachedPluginRoot, { recursive: true });
  await fsp.cp(initFixtureRoot, projectRoot, { recursive: true });

  await import(pathToFileURL(path.join(cachedPluginRoot, "scripts", "pk-init.mjs")).href);
  const { initializeProjectKnowledge } = await import(
    pathToFileURL(path.join(cachedPluginRoot, "scripts", "init-project-knowledge.mjs")).href
  );

  await initializeProjectKnowledge(projectRoot);

  assert.equal(
    fs.existsSync(path.join(projectRoot, ".project-knowledge", "graph", "knowledge-graph.html")),
    true
  );

  const workflow = fs.readFileSync(
    path.join(projectRoot, ".project-knowledge", "workflow.md"),
    "utf8"
  );
  assert.doesNotMatch(workflow, /\/pk:/);
  assert.match(workflow, /pk-status/);
  assert.match(workflow, /pk-graph/);
});
