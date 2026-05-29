import path from "node:path";

import { resolveKnowledgeRoot as resolveRepowiseKnowledgeRoot } from "./paths.mjs";

export function resolveProjectRoot(targetPath = process.cwd()) {
  return path.resolve(targetPath);
}

export async function resolveKnowledgeRoot(targetPath = process.cwd()) {
  return resolveRepowiseKnowledgeRoot(targetPath, { mustExist: false });
}
