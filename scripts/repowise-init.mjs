#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { initializeProjectKnowledge } from "./init-project-knowledge.mjs";
import { installRepowiseSkills } from "./install-repowise-skills.mjs";
import {
  exists,
  legacyKnowledgeDirectoryName,
  resolveLegacyProjectKnowledgeRoot,
  resolveProjectKnowledgeRoot
} from "./paths.mjs";

export async function initializeRepowiseProject(projectRoot = process.cwd(), options = {}) {
  const resolvedProjectRoot = path.resolve(projectRoot || process.cwd());
  const legacyKnowledgeRoot = resolveLegacyProjectKnowledgeRoot(resolvedProjectRoot);
  const knowledgeRoot = resolveProjectKnowledgeRoot(resolvedProjectRoot);
  let migratedLegacyKnowledgeRoot = false;

  if (await exists(legacyKnowledgeRoot)) {
    if (options.migrate === true) {
      if (await exists(knowledgeRoot)) {
        throw new Error(`无法迁移，目标已存在: ${knowledgeRoot}`);
      }
      await fs.rename(legacyKnowledgeRoot, knowledgeRoot);
      migratedLegacyKnowledgeRoot = true;
    } else if (!(await exists(knowledgeRoot))) {
      throw new Error(
        `发现旧知识库 ${legacyKnowledgeDirectoryName}。请使用 --migrate 迁移到 .repowise/。`
      );
    }
  }

  const summary = await initializeProjectKnowledge(resolvedProjectRoot);
  const skillInstallations = await installRepowiseSkills({
    projectRoot: resolvedProjectRoot,
    homeDir: options.homeDir,
    agents: options.agents,
    global: options.globalSkills,
    project: options.projectSkills,
    force: options.force
  });

  return {
    ...summary,
    knowledgeRoot,
    migratedLegacyKnowledgeRoot,
    skillInstallations
  };
}

export function parseRepowiseInitArgs(argv = []) {
  const positional = [];
  const options = {
    agents: ["codex", "claude"],
    globalSkills: true,
    projectSkills: true,
    force: false,
    migrate: false
  };

  for (const arg of argv) {
    if (arg === "--codex") {
      options.agents = ["codex"];
      continue;
    }
    if (arg === "--claude") {
      options.agents = ["claude"];
      continue;
    }
    if (arg === "--no-global") {
      options.globalSkills = false;
      continue;
    }
    if (arg === "--no-project-skills") {
      options.projectSkills = false;
      continue;
    }
    if (arg === "--force") {
      options.force = true;
      continue;
    }
    if (arg === "--migrate") {
      options.migrate = true;
      continue;
    }
    positional.push(arg);
  }

  return {
    projectRoot: positional[0] || process.cwd(),
    options
  };
}

async function main() {
  const { projectRoot, options } = parseRepowiseInitArgs(process.argv.slice(2));
  const summary = await initializeRepowiseProject(projectRoot, options);
  console.log(JSON.stringify(summary, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
