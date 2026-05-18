#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";

import { governProjectKnowledge } from "./govern-project-knowledge.mjs";

function parseGovernCliArgs(args) {
  const filteredArgs = [];
  let dryRun = true;

  for (const arg of args) {
    if (arg === "--apply") {
      dryRun = false;
      continue;
    }
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    filteredArgs.push(arg);
  }

  return {
    projectRoot: filteredArgs[0] || process.cwd(),
    options: { dryRun }
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { projectRoot, options } = parseGovernCliArgs(process.argv.slice(2));
  const result = await governProjectKnowledge(projectRoot, options);
  console.log(JSON.stringify(result, null, 2));
}
