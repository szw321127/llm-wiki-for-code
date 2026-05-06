#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";

import { governProjectKnowledge } from "./govern-project-knowledge.mjs";

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await governProjectKnowledge(process.argv[2] || process.cwd());
  console.log(JSON.stringify(result, null, 2));
}
