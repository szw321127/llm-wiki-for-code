#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildProjectGraphFromDirectory,
  writeGraphFiles
} from "./knowledge-lib.mjs";
import { buildProjectGraphPage } from "./build-project-graph-page.mjs";
import { refreshObsidianVault } from "./obsidian-lib.mjs";
import { resolveKnowledgeRoot, resolveProjectKnowledgeRoot } from "./paths.mjs";

export async function buildProjectGraphArtifacts(projectKnowledgeDir) {
  const graph = await buildProjectGraphFromDirectory(projectKnowledgeDir);
  const index = await writeGraphFiles(projectKnowledgeDir, graph);
  const page = await buildProjectGraphPage(projectKnowledgeDir);
  await refreshObsidianVault(projectKnowledgeDir, { graph });

  return { graph, index, page };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const projectKnowledgeDir = process.argv[2]
    ? await resolveKnowledgeRoot(process.argv[2])
    : resolveProjectKnowledgeRoot(process.cwd());
  const result = await buildProjectGraphArtifacts(projectKnowledgeDir);

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
