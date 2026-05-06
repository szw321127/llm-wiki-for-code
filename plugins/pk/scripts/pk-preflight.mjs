#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";

import { runPreflight } from "./preflight-session.mjs";

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [targetPath, ...taskParts] = process.argv.slice(2);
  const result = await runPreflight(targetPath || process.cwd(), taskParts.join(" "));
  console.log(JSON.stringify(result, null, 2));
}
