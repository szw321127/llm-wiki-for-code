#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";

import { lintProjectKnowledge } from "./lint-project-knowledge.mjs";

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = await lintProjectKnowledge(process.argv[2] || process.cwd());
  console.log(JSON.stringify(report, null, 2));
}
