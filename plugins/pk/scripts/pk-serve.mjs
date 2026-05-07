#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";

import { createProjectKnowledgeServer } from "./serve-project-knowledge.mjs";
import { resolveProjectRoot } from "./shared.mjs";

const currentFilePath = fileURLToPath(import.meta.url);
const port = Number(process.argv[3] || process.env.PORT || 8124);

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(currentFilePath)) {
  const projectRoot = resolveProjectRoot(process.argv[2] || process.cwd());
  const server = createProjectKnowledgeServer(projectRoot);
  server.listen(port, "127.0.0.1", () => {
    console.log(`LLM Wiki for Code preview: http://127.0.0.1:${port}/graph/knowledge-graph.html`);
  });
}
