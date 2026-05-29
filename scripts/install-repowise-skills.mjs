import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const bundleRoot = path.resolve(scriptDirectory, "..");
const skillNames = [
  "init",
  "preflight",
  "status",
  "graph",
  "crystallize",
  "auto-crystallize",
  "lint",
  "govern",
  "serve"
];

export async function installRepowiseSkills({
  projectRoot,
  homeDir = process.env.REPOWISE_HOME || os.homedir(),
  agents = ["codex", "claude"],
  global = true,
  project = true,
  force = false
} = {}) {
  const sourceBundleRoot = await resolveSourceBundleRoot();
  const sourceSkillsDirectory = path.join(sourceBundleRoot, "skills");
  const resolvedProjectRoot = path.resolve(projectRoot || process.cwd());
  const resolvedHomeDir = path.resolve(homeDir || os.homedir());
  const targets = buildSkillTargets({
    projectRoot: resolvedProjectRoot,
    homeDir: resolvedHomeDir,
    agents,
    global,
    project
  });
  const installations = [];

  for (const target of targets) {
    const runtime = await installRuntimeBundle(target.directory, { force, sourceBundleRoot });
    const installedSkills = [];
    for (const skillName of skillNames) {
      installedSkills.push(await installSkill(skillName, target.directory, {
        force,
        sourceSkillsDirectory
      }));
    }
    installations.push({
      ...target,
      runtime,
      installedSkills
    });
  }

  return installations;
}

async function resolveSourceBundleRoot() {
  const candidates = [
    bundleRoot,
    path.join(bundleRoot, "plugins", "pk")
  ];

  for (const candidate of candidates) {
    if (
      await exists(path.join(candidate, "scripts")) &&
      await exists(path.join(candidate, "skills")) &&
      await exists(path.join(candidate, "assets")) &&
      await exists(path.join(candidate, "templates"))
    ) {
      return candidate;
    }
  }

  throw new Error(`未找到 Repowise 运行时资源目录: ${bundleRoot}`);
}

function buildSkillTargets({ projectRoot, homeDir, agents, global, project }) {
  const normalizedAgents = new Set(agents);
  const targets = [];

  if (project && normalizedAgents.has("codex")) {
    targets.push({
      scope: "project",
      agent: "codex",
      directory: path.join(projectRoot, ".agents", "skills")
    });
  }
  if (project && normalizedAgents.has("claude")) {
    targets.push({
      scope: "project",
      agent: "claude",
      directory: path.join(projectRoot, ".claude", "skills")
    });
  }
  if (global && normalizedAgents.has("codex")) {
    targets.push({
      scope: "global",
      agent: "codex",
      directory: path.join(homeDir, ".agents", "skills")
    });
  }
  if (global && normalizedAgents.has("claude")) {
    targets.push({
      scope: "global",
      agent: "claude",
      directory: path.join(homeDir, ".claude", "skills")
    });
  }

  return targets;
}

async function installSkill(skillName, targetSkillsDirectory, { force, sourceSkillsDirectory }) {
  const sourceName = `pk-${skillName}`;
  const targetName = `repowise-${skillName}`;
  const sourcePath = path.join(sourceSkillsDirectory, sourceName);
  const targetPath = path.join(targetSkillsDirectory, targetName);

  if (await exists(targetPath)) {
    if (!force) {
      return {
        name: targetName,
        path: targetPath,
        status: "skipped"
      };
    }
    await fs.rm(targetPath, { recursive: true, force: true });
  }

  await fs.mkdir(targetSkillsDirectory, { recursive: true });
  await copySkillDirectory(sourcePath, targetPath, { sourceName, targetName });

  return {
    name: targetName,
    path: targetPath,
    status: "created"
  };
}

async function installRuntimeBundle(targetSkillsDirectory, { force, sourceBundleRoot }) {
  const agentRoot = path.dirname(targetSkillsDirectory);
  const runtimePath = path.join(agentRoot, "repowise");

  if (await exists(runtimePath)) {
    if (!force) {
      return {
        path: runtimePath,
        status: "skipped"
      };
    }
    await fs.rm(runtimePath, { recursive: true, force: true });
  }

  await fs.mkdir(runtimePath, { recursive: true });
  await fs.cp(path.join(sourceBundleRoot, "scripts"), path.join(runtimePath, "scripts"), {
    force: true,
    recursive: true
  });
  await fs.cp(path.join(sourceBundleRoot, "assets"), path.join(runtimePath, "assets"), {
    force: true,
    recursive: true
  });
  await fs.cp(path.join(sourceBundleRoot, "templates"), path.join(runtimePath, "templates"), {
    force: true,
    recursive: true
  });
  await fs.cp(path.join(sourceBundleRoot, "skills"), path.join(runtimePath, "skills"), {
    force: true,
    recursive: true
  });

  return {
    path: runtimePath,
    status: "created"
  };
}

async function copySkillDirectory(sourcePath, targetPath, replacements) {
  await fs.mkdir(targetPath, { recursive: true });
  const entries = await fs.readdir(sourcePath, { withFileTypes: true });

  for (const entry of entries) {
    const sourceEntryPath = path.join(sourcePath, entry.name);
    const targetEntryPath = path.join(targetPath, entry.name);

    if (entry.isDirectory()) {
      await copySkillDirectory(sourceEntryPath, targetEntryPath, replacements);
      continue;
    }

    if (entry.name === "SKILL.md") {
      const source = await fs.readFile(sourceEntryPath, "utf8");
      await fs.writeFile(targetEntryPath, rewriteSkillSource(source, replacements), "utf8");
      continue;
    }

    await fs.copyFile(sourceEntryPath, targetEntryPath);
  }
}

function rewriteSkillSource(source, { sourceName, targetName }) {
  return String(source)
    .replaceAll("../../scripts/", "../../repowise/scripts/")
    .replace(new RegExp(`name:\\s*${escapeRegExp(sourceName)}`), `name: ${targetName}`)
    .replaceAll(sourceName, targetName)
    .replaceAll("pk-status", "repowise-status")
    .replaceAll("pk-graph", "repowise-graph")
    .replaceAll("pk-lint", "repowise-lint")
    .replaceAll("pk-init", "repowise-init")
    .replaceAll(".project-knowledge", ".repowise");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
