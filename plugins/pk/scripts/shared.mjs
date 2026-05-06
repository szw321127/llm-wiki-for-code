import fs from "node:fs/promises";
import path from "node:path";

export function resolveProjectRoot(targetPath = process.cwd()) {
  return path.resolve(targetPath);
}

export async function resolveKnowledgeRoot(targetPath = process.cwd()) {
  const resolved = path.resolve(targetPath);

  if (await exists(path.join(resolved, "project-profile.md"))) {
    return resolved;
  }

  return path.join(resolved, ".project-knowledge");
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
