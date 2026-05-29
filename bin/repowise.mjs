#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";

import { initializeRepowiseProject, parseRepowiseInitArgs } from "../scripts/repowise-init.mjs";

async function main(argv = process.argv.slice(2)) {
  const [command, ...commandArgs] = argv;

  if (command === "init") {
    const { projectRoot, options } = parseRepowiseInitArgs(commandArgs);
    const summary = await initializeRepowiseProject(projectRoot, options);
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  console.error("Usage: repowise init [project-root] [--codex|--claude] [--no-global] [--no-project-skills] [--migrate] [--force]");
  process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
