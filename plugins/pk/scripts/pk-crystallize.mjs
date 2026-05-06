#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  crystallizeSession,
  loadCrystallizeCliInput
} from "./crystallize-session.mjs";

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const projectRoot = process.argv[2] || process.cwd();
  const input = await loadCrystallizeCliInput(projectRoot, process.argv.slice(3), {
    decisionSummary: "通过 pk 命令壳手动执行了一次项目知识结晶。"
  });
  const result = await crystallizeSession(projectRoot, input);
  console.log(JSON.stringify(result, null, 2));
}
