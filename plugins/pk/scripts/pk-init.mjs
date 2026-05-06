#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";

import { initializeProjectKnowledge } from "./init-project-knowledge.mjs";
import { resolveProjectRoot } from "./shared.mjs";

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const projectRoot = resolveProjectRoot(process.argv[2] || process.cwd());
  const summary = await initializeProjectKnowledge(projectRoot);
  console.log(JSON.stringify(summary, null, 2));
}
