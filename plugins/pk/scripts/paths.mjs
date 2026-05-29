import fs from "node:fs/promises";
import path from "node:path";

export const knowledgeDirectoryName = ".repowise";
export const legacyKnowledgeDirectoryName = ".project-knowledge";

export function resolveProjectKnowledgeRoot(projectRoot = process.cwd()) {
  return path.join(path.resolve(projectRoot || process.cwd()), knowledgeDirectoryName);
}

export function resolveLegacyProjectKnowledgeRoot(projectRoot = process.cwd()) {
  return path.join(path.resolve(projectRoot || process.cwd()), legacyKnowledgeDirectoryName);
}

export async function resolveKnowledgeRoot(targetPath = process.cwd(), options = {}) {
  const resolved = path.resolve(targetPath || process.cwd());

  if (await exists(path.join(resolved, "project-profile.md"))) {
    return resolved;
  }

  const knowledgeRoot = path.join(resolved, knowledgeDirectoryName);
  if (await exists(path.join(knowledgeRoot, "project-profile.md"))) {
    return knowledgeRoot;
  }

  if (options.allowLegacy !== false) {
    const legacyKnowledgeRoot = path.join(resolved, legacyKnowledgeDirectoryName);
    if (await exists(path.join(legacyKnowledgeRoot, "project-profile.md"))) {
      return legacyKnowledgeRoot;
    }
  }

  if (options.mustExist === false) {
    return knowledgeRoot;
  }

  throw new Error(`未找到 ${knowledgeDirectoryName}: ${resolved}`);
}

export async function resolveProjectTarget(targetPath = process.cwd(), options = {}) {
  const resolved = path.resolve(targetPath || process.cwd());

  if (await exists(path.join(resolved, "project-profile.md"))) {
    return {
      hasKnowledge: true,
      projectRoot: path.dirname(resolved),
      knowledgeRoot: resolved
    };
  }

  const knowledgeRoot = path.join(resolved, knowledgeDirectoryName);
  if (await exists(path.join(knowledgeRoot, "project-profile.md"))) {
    return {
      hasKnowledge: true,
      projectRoot: resolved,
      knowledgeRoot
    };
  }

  if (options.allowLegacy !== false) {
    const legacyKnowledgeRoot = path.join(resolved, legacyKnowledgeDirectoryName);
    if (await exists(path.join(legacyKnowledgeRoot, "project-profile.md"))) {
      return {
        hasKnowledge: true,
        projectRoot: resolved,
        knowledgeRoot: legacyKnowledgeRoot
      };
    }
  }

  return {
    hasKnowledge: false,
    projectRoot: resolved,
    knowledgeRoot
  };
}

export async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
