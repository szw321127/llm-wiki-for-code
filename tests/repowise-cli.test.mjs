import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = path.resolve(".");
const cliPath = path.join(root, "bin", "repowise.mjs");
const fixtureRoot = path.resolve("tests", "fixtures", "init-sample-project");

test("repowise init initializes the current project with .repowise and both project skill sets", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "repowise-cli-init-"));
  const projectRoot = path.join(tempRoot, "sample-project");
  const homeRoot = path.join(tempRoot, "home");

  await fs.cp(fixtureRoot, projectRoot, { recursive: true });

  const result = await runRepowise(["init", "--no-global"], {
    cwd: projectRoot,
    homeRoot
  });

  assert.equal(result.projectRoot, projectRoot);
  assert.equal(result.knowledgeRoot, path.join(projectRoot, ".repowise"));
  assert.equal(await exists(path.join(projectRoot, ".repowise", "project-profile.md")), true);
  assert.equal(await exists(path.join(projectRoot, ".project-knowledge")), false);
  const codexInitSkill = path.join(projectRoot, ".agents", "skills", "repowise-init", "SKILL.md");
  assert.equal(await exists(codexInitSkill), true);
  assert.equal(await exists(path.join(projectRoot, ".claude", "skills", "repowise-init", "SKILL.md")), true);
  assert.equal(await exists(path.join(projectRoot, ".agents", "repowise", "scripts", "pk-init.mjs")), true);
  assert.equal(await exists(path.join(projectRoot, ".agents", "repowise", "assets", "graph", "knowledge-graph.html")), true);
  assert.equal(await exists(path.join(projectRoot, ".agents", "repowise", "templates", "practice-template.md")), true);
  assert.equal(await exists(path.join(projectRoot, ".agents", "repowise", "skills", "pk-init", "SKILL.md")), true);
  assert.match(await fs.readFile(codexInitSkill, "utf8"), /\.\.\/\.\.\/repowise\/scripts\/repowise-init\.mjs/);
  assert.equal(await exists(path.join(homeRoot, ".agents", "skills", "repowise-init", "SKILL.md")), false);
  assert.equal(await exists(path.join(homeRoot, ".claude", "skills", "repowise-init", "SKILL.md")), false);
});

test("repowise init --codex installs only Codex skills", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "repowise-cli-codex-"));
  const projectRoot = path.join(tempRoot, "sample-project");
  const homeRoot = path.join(tempRoot, "home");

  await fs.cp(fixtureRoot, projectRoot, { recursive: true });

  await runRepowise(["init", projectRoot, "--codex"], {
    cwd: tempRoot,
    homeRoot
  });

  assert.equal(await exists(path.join(projectRoot, ".agents", "skills", "repowise-init", "SKILL.md")), true);
  assert.equal(await exists(path.join(projectRoot, ".claude", "skills", "repowise-init", "SKILL.md")), false);
  assert.equal(await exists(path.join(homeRoot, ".agents", "skills", "repowise-init", "SKILL.md")), true);
  assert.equal(await exists(path.join(homeRoot, ".claude", "skills", "repowise-init", "SKILL.md")), false);
});

test("repowise init --claude installs only Claude skills", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "repowise-cli-claude-"));
  const projectRoot = path.join(tempRoot, "sample-project");
  const homeRoot = path.join(tempRoot, "home");

  await fs.cp(fixtureRoot, projectRoot, { recursive: true });

  await runRepowise(["init", projectRoot, "--claude"], {
    cwd: tempRoot,
    homeRoot
  });

  assert.equal(await exists(path.join(projectRoot, ".agents", "skills", "repowise-init", "SKILL.md")), false);
  assert.equal(await exists(path.join(projectRoot, ".claude", "skills", "repowise-init", "SKILL.md")), true);
  assert.equal(await exists(path.join(homeRoot, ".agents", "skills", "repowise-init", "SKILL.md")), false);
  assert.equal(await exists(path.join(homeRoot, ".claude", "skills", "repowise-init", "SKILL.md")), true);
});

test("repowise init --no-project-skills installs only user-level skills", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "repowise-cli-global-"));
  const projectRoot = path.join(tempRoot, "sample-project");
  const homeRoot = path.join(tempRoot, "home");

  await fs.cp(fixtureRoot, projectRoot, { recursive: true });

  await runRepowise(["init", projectRoot, "--no-project-skills"], {
    cwd: tempRoot,
    homeRoot
  });

  assert.equal(await exists(path.join(projectRoot, ".agents", "skills", "repowise-init", "SKILL.md")), false);
  assert.equal(await exists(path.join(projectRoot, ".claude", "skills", "repowise-init", "SKILL.md")), false);
  assert.equal(await exists(path.join(homeRoot, ".agents", "skills", "repowise-init", "SKILL.md")), true);
  assert.equal(await exists(path.join(homeRoot, ".claude", "skills", "repowise-init", "SKILL.md")), true);
});

test("repowise init --migrate renames a legacy .project-knowledge vault", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "repowise-cli-migrate-"));
  const projectRoot = path.join(tempRoot, "sample-project");
  const homeRoot = path.join(tempRoot, "home");

  await fs.mkdir(path.join(projectRoot, ".project-knowledge"), { recursive: true });
  await fs.writeFile(
    path.join(projectRoot, ".project-knowledge", "project-profile.md"),
    "# Legacy profile\n",
    "utf8"
  );

  const result = await runRepowise(["init", projectRoot, "--migrate", "--no-global", "--no-project-skills"], {
    cwd: tempRoot,
    homeRoot
  });

  assert.equal(result.migratedLegacyKnowledgeRoot, true);
  assert.equal(await exists(path.join(projectRoot, ".repowise", "project-profile.md")), true);
  assert.equal(await exists(path.join(projectRoot, ".project-knowledge")), false);
});

async function runRepowise(args, { cwd, homeRoot }) {
  const { stdout } = await execFileAsync(process.execPath, [cliPath, ...args], {
    cwd,
    env: {
      ...process.env,
      REPOWISE_HOME: homeRoot
    }
  });

  return JSON.parse(stdout);
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
