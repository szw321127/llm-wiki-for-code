import fs from "node:fs/promises";
import path from "node:path";

const IGNORE_DIRECTORIES = new Set([
  ".git",
  ".agents",
  ".claude",
  ".codex",
  ".cursor",
  ".repowise",
  ".project-knowledge",
  ".worktrees",
  "node_modules",
  "dist",
  "build",
  "coverage"
]);

export async function scanProject(projectRoot) {
  const packageJsonPath = path.join(projectRoot, "package.json");
  const readmePath = path.join(projectRoot, "README.md");
  const packageJson = await readJsonIfExists(packageJsonPath);
  const readme = await readTextIfExists(readmePath);
  const allFiles = await walkFiles(projectRoot);
  const relativeFiles = allFiles.map((filePath) => path.relative(projectRoot, filePath).replace(/\\/g, "/"));
  const markdownFiles = relativeFiles.filter((filePath) => filePath.endsWith(".md"));
  const codeFiles = relativeFiles.filter((filePath) => /\.(cjs|cts|js|jsx|mjs|mts|ts|tsx|vue)$/i.test(filePath));

  const title = extractProjectTitle(readme) || packageJson?.name || path.basename(projectRoot);
  const tech = detectTech(relativeFiles, packageJson);
  const buildTools = detectBuildTools(relativeFiles, packageJson);
  const testTools = detectTestTools(relativeFiles, packageJson);
  const docEntrypoints = detectDocEntrypoints(markdownFiles);
  const unifiedClientFiles = codeFiles.filter((relativePath) =>
    /(^|\/)(api|services?)\/.*(client|request)|(^|\/)(client|request|http)\.(cjs|cts|js|jsx|mjs|mts|ts|tsx)$/i.test(
      relativePath
    )
  );
  const directCallCandidates = codeFiles.filter((relativePath) => {
    if (unifiedClientFiles.includes(relativePath)) {
      return false;
    }
    return true;
  });
  const directCallFiles = await filterFilesByContent(
    projectRoot,
    directCallCandidates,
    /\b(fetch|axios)\s*\(/
  );
  const configModuleFiles = codeFiles.filter((relativePath) =>
    isProjectConfigModulePath(relativePath)
  );
  const configModuleFileSet = new Set(configModuleFiles);
  const inlineConfigCandidates = codeFiles.filter((relativePath) => !configModuleFileSet.has(relativePath));
  const inlineConfigFiles = await filterFilesByContent(projectRoot, inlineConfigCandidates, /\bprocess\.env\b/);
  const loggerFiles = codeFiles.filter((relativePath) =>
    /(^|\/)(logger|logging)\.(cjs|cts|js|jsx|mjs|mts|ts|tsx)$/i.test(relativePath)
  );
  const frontendPageFiles = codeFiles.filter((relativePath) =>
    /(^|\/)(pages|views)\//i.test(relativePath)
  );

  return {
    projectRoot,
    title,
    packageJson,
    tech,
    buildTools,
    testTools,
    docEntrypoints,
    unifiedClientFiles,
    directCallFiles,
    configModuleFiles,
    inlineConfigFiles,
    loggerFiles,
    frontendPageFiles,
    markdownFiles,
    codeFiles
  };
}

async function walkFiles(rootDirectory) {
  const files = [];
  const stack = [rootDirectory];

  while (stack.length > 0) {
    const currentDirectory = stack.pop();
    const entries = await fs.readdir(currentDirectory, { withFileTypes: true });

    for (const entry of entries) {
      const absolutePath = path.join(currentDirectory, entry.name);
      if (entry.isDirectory()) {
        if (!IGNORE_DIRECTORIES.has(entry.name)) {
          stack.push(absolutePath);
        }
        continue;
      }

      if (entry.isFile()) {
        files.push(absolutePath);
      }
    }
  }

  return files.sort();
}

function extractProjectTitle(readme) {
  const match = String(readme || "").match(/^#\s+(.+)$/m);
  return match?.[1]?.trim() || "";
}

function detectTech(relativeFiles, packageJson) {
  const dependencies = {
    ...(packageJson?.dependencies || {}),
    ...(packageJson?.devDependencies || {})
  };
  const tech = [];

  if (dependencies.typescript || relativeFiles.some((filePath) => /\.(cts|mts|ts|tsx)$/.test(filePath))) {
    tech.push("typescript");
  }
  if (dependencies.vue || relativeFiles.some((filePath) => filePath.endsWith(".vue"))) {
    tech.push("vue");
  }
  if (packageJson) {
    tech.push("node");
  }

  return Array.from(new Set(tech));
}

function detectBuildTools(relativeFiles, packageJson) {
  const dependencies = {
    ...(packageJson?.dependencies || {}),
    ...(packageJson?.devDependencies || {})
  };
  const buildTools = [];

  if (String(packageJson?.packageManager || "").includes("pnpm") || relativeFiles.includes("pnpm-lock.yaml")) {
    buildTools.push("pnpm");
  }
  if (
    dependencies.vite ||
    relativeFiles.some((filePath) => /^vite\.config\./.test(path.basename(filePath)))
  ) {
    buildTools.push("vite");
  }

  return Array.from(new Set(buildTools));
}

function detectTestTools(relativeFiles, packageJson) {
  const dependencies = {
    ...(packageJson?.dependencies || {}),
    ...(packageJson?.devDependencies || {})
  };
  const testTools = [];

  if (dependencies.vitest) {
    testTools.push("vitest");
  }
  if (String(packageJson?.scripts?.test || "").includes("node --test")) {
    testTools.push("node-test");
  }
  if (relativeFiles.some((filePath) => /(^|\/)tests?\//.test(filePath))) {
    testTools.push("tests-directory");
  }

  return Array.from(new Set(testTools));
}

async function filterFilesByContent(projectRoot, relativeFiles, pattern) {
  const matchedFiles = [];

  for (const relativePath of relativeFiles) {
    const content = await readTextIfExists(path.join(projectRoot, relativePath));
    if (pattern.test(content)) {
      matchedFiles.push(relativePath);
    }
  }

  return matchedFiles;
}

function isProjectConfigModulePath(relativePath) {
  const normalizedPath = String(relativePath || "").replace(/\\/g, "/");

  if (/\.d\.[cm]?ts$/i.test(normalizedPath)) {
    return false;
  }

  return (
    /^(config|configs|env)\//i.test(normalizedPath) ||
    /^src\/(config|configs|env)\//i.test(normalizedPath) ||
    /^(config|env)\.(cjs|cts|js|jsx|mjs|mts|ts|tsx)$/i.test(normalizedPath) ||
    /^src\/(config|env)\.(cjs|cts|js|jsx|mjs|mts|ts|tsx)$/i.test(normalizedPath)
  );
}

function detectDocEntrypoints(markdownFiles) {
  return markdownFiles.filter((relativePath) => {
    if (isAgentPlanningMarkdown(relativePath)) {
      return false;
    }

    return /^README/i.test(normalizedEntrypointPath(relativePath));
  });
}

function normalizedEntrypointPath(relativePath) {
  return String(relativePath || "").replace(/\\/g, "/");
}

function isAgentPlanningMarkdown(relativePath) {
  const normalizedPath = String(relativePath || "").replace(/\\/g, "/");
  const basename = path.basename(normalizedPath).toLowerCase();

  if (
    [
      "task_plan.md",
      "findings.md",
      "progress.md",
      "planning.md",
      "claude.md",
      "agents.md"
    ].includes(basename)
  ) {
    return true;
  }

  return /^docs\/plans?\//i.test(normalizedPath);
}

async function readJsonIfExists(filePath) {
  const source = await readTextIfExists(filePath);
  return source ? JSON.parse(source) : null;
}

async function readTextIfExists(filePath) {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") {
      return "";
    }
    throw error;
  }
}
