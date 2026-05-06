#!/usr/bin/env node

// 用法:
// node knowledge/tools/build-graph-data.mjs

import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildGraphFromDirectory, writeGraphFiles } from "./graph-lib.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const knowledgeDirectory = path.resolve(scriptDirectory, "..");

const graph = await buildGraphFromDirectory(knowledgeDirectory);
const index = await writeGraphFiles(knowledgeDirectory, graph);

console.log(
  JSON.stringify(
    {
      generated_at: graph.generated_at,
      output: {
        data: "knowledge/graph/graph-data.json",
        index: "knowledge/graph/graph-index.json"
      },
      counts_by_type: graph.stats.counts_by_type,
      projects: index.project_views.map((project) => project.id)
    },
    null,
    2
  )
);
