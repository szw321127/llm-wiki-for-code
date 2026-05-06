#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildProjectGraphArtifacts } from "./build-project-graph-data.mjs";
import { resolveKnowledgeRoot } from "./shared.mjs";

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const knowledgeRoot = await resolveKnowledgeRoot(process.argv[2] || process.cwd());
  const result = await buildProjectGraphArtifacts(knowledgeRoot);

  console.log(
    JSON.stringify(
      {
        generated_at: result.graph.generated_at,
        knowledge_root: result.graph.knowledge_root,
        output: {
          data: "graph/graph-data.json",
          index: "graph/graph-index.json",
          html: "graph/knowledge-graph.html"
        },
        counts_by_type: result.graph.stats.counts_by_type
      },
      null,
      2
    )
  );
}
