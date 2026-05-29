import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { resolveKnowledgeRoot, resolveProjectKnowledgeRoot } from "./paths.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const assetDirectory = path.resolve(scriptDirectory, "..", "assets", "graph");

export async function buildProjectGraphPage(projectKnowledgeDir) {
  const graphDirectory = path.join(projectKnowledgeDir, "graph");

  await fs.mkdir(graphDirectory, { recursive: true });
  await fs.cp(assetDirectory, graphDirectory, { force: true, recursive: true });

  return {
    html: path.join(graphDirectory, "knowledge-graph.html"),
    css: path.join(graphDirectory, "knowledge-graph.css"),
    js: path.join(graphDirectory, "knowledge-graph.js"),
    runtime: path.join(graphDirectory, "graph-runtime.mjs")
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const projectKnowledgeDir = process.argv[2]
    ? await resolveKnowledgeRoot(process.argv[2])
    : resolveProjectKnowledgeRoot(process.cwd());
  const output = await buildProjectGraphPage(projectKnowledgeDir);
  console.log(JSON.stringify(output, null, 2));
}
