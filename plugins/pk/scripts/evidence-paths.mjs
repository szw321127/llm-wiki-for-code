const IGNORED_EVIDENCE_PREFIXES = [
  ".git/",
  ".project-knowledge/",
  ".worktrees/",
  ".agents/",
  ".claude/",
  ".codex/",
  ".cursor/",
  "node_modules/",
  "dist/",
  "build/",
  "coverage/",
  "docs/"
];

const IGNORED_EVIDENCE_BASENAMES = new Set([
  "task_plan.md",
  "findings.md",
  "progress.md",
  "planning.md",
  "claude.md",
  "agents.md"
]);

export function normalizeEvidencePath(filePath) {
  return String(filePath || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\.\/+/, "");
}

export function normalizeEvidencePaths(filePaths) {
  return dedupeValues(
    asArray(filePaths)
      .map((filePath) => normalizeEvidencePath(filePath))
      .filter(Boolean)
      .filter((filePath) => !isVolatileEvidencePath(filePath))
  );
}

export function collectVolatileEvidencePaths(filePaths) {
  return dedupeValues(
    asArray(filePaths)
      .map((filePath) => normalizeEvidencePath(filePath))
      .filter(Boolean)
      .filter((filePath) => isVolatileEvidencePath(filePath))
  );
}

export function isVolatileEvidencePath(filePath) {
  const normalizedPath = normalizeEvidencePath(filePath);
  const comparablePath = normalizedPath.toLowerCase();
  const basename = comparablePath.split("/").at(-1) || comparablePath;

  if (!comparablePath) {
    return true;
  }

  if (isAbsolutePath(comparablePath)) {
    return true;
  }

  if (IGNORED_EVIDENCE_BASENAMES.has(basename)) {
    return true;
  }

  return IGNORED_EVIDENCE_PREFIXES.some((prefix) =>
    comparablePath === prefix.slice(0, -1) || comparablePath.startsWith(prefix)
  );
}

function isAbsolutePath(filePath) {
  return /^[a-z]:\//i.test(filePath) || filePath.startsWith("/") || filePath.startsWith("//");
}

function asArray(value) {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function dedupeValues(values) {
  return Array.from(new Set((values || []).filter(Boolean)));
}
