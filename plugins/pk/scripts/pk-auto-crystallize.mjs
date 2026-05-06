#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  autoCrystallizeSession,
  loadAutoCrystallizeCliInput
} from "./auto-crystallize-session.mjs";

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const projectRoot = process.argv[2] || process.cwd();
  const input = await loadAutoCrystallizeCliInput(projectRoot, process.argv.slice(3), {
    decisionSummary: "通过 pk 自动结晶入口记录了一次项目知识沉淀。"
  });
  const result = await autoCrystallizeSession(projectRoot, input);
  console.log(JSON.stringify(result, null, 2));
}
