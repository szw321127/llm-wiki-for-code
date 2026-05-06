#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";

import { generateStatusReport } from "./status-report.mjs";

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = await generateStatusReport(process.argv[2] || process.cwd());
  console.log(JSON.stringify(report, null, 2));
}
