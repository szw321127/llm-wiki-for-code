import fs from "node:fs/promises";
import path from "node:path";

const DEFAULT_IGNORED_EVIDENCE_PREFIXES = [
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

const DEFAULT_IGNORED_EVIDENCE_BASENAMES = [
  "task_plan.md",
  "findings.md",
  "progress.md",
  "planning.md",
  "claude.md",
  "agents.md"
];

export const EVIDENCE_POLICY_FILE = "evidence-policy.json";

export const DEFAULT_EVIDENCE_POLICY = Object.freeze({
  useDefaultIgnores: true,
  ignoredPrefixes: Object.freeze([...DEFAULT_IGNORED_EVIDENCE_PREFIXES]),
  ignoredBasenames: Object.freeze([...DEFAULT_IGNORED_EVIDENCE_BASENAMES]),
  allowedPrefixes: Object.freeze([]),
  allowAbsolutePaths: false
});

export async function loadEvidencePolicy(projectRootOrKnowledgeRoot = process.cwd()) {
  const knowledgeRoot = await resolvePolicyKnowledgeRoot(projectRootOrKnowledgeRoot);
  const policyPath = path.join(knowledgeRoot, EVIDENCE_POLICY_FILE);
  const overrides = await readJsonIfExists(policyPath);

  return buildEvidencePolicy(overrides || {});
}

export function buildEvidencePolicy(overrides = {}) {
  const useDefaultIgnores = overrides?.useDefaultIgnores !== false;
  const ignoredPrefixes = useDefaultIgnores ? DEFAULT_IGNORED_EVIDENCE_PREFIXES : [];
  const ignoredBasenames = useDefaultIgnores ? DEFAULT_IGNORED_EVIDENCE_BASENAMES : [];

  return {
    useDefaultIgnores,
    allowAbsolutePaths: overrides?.allowAbsolutePaths === true,
    ignoredPrefixes: dedupeValues([
      ...ignoredPrefixes,
      ...asArray(overrides?.ignoredPrefixes)
    ].map((value) => normalizePolicyPrefix(value))),
    ignoredBasenames: dedupeValues([
      ...ignoredBasenames,
      ...asArray(overrides?.ignoredBasenames)
    ].map((value) => normalizePolicyBasename(value))),
    allowedPrefixes: dedupeValues(
      asArray(overrides?.allowedPrefixes).map((value) => normalizePolicyPrefix(value))
    )
  };
}

export function normalizeEvidencePath(filePath) {
  return String(filePath || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\.\/+/, "");
}

export function normalizeEvidencePaths(filePaths, policyOverrides = {}) {
  const policy = buildEvidencePolicy(policyOverrides);

  return dedupeValues(
    asArray(filePaths)
      .map((filePath) => normalizeEvidencePath(filePath))
      .filter(Boolean)
      .filter((filePath) => !isVolatileEvidencePath(filePath, policy))
  );
}

export function collectVolatileEvidencePaths(filePaths, policyOverrides = {}) {
  const policy = buildEvidencePolicy(policyOverrides);

  return dedupeValues(
    asArray(filePaths)
      .map((filePath) => normalizeEvidencePath(filePath))
      .filter(Boolean)
      .filter((filePath) => isVolatileEvidencePath(filePath, policy))
  );
}

export function isVolatileEvidencePath(filePath, policyOverrides = {}) {
  const policy = buildEvidencePolicy(policyOverrides);
  const normalizedPath = normalizeEvidencePath(filePath);
  const comparablePath = normalizedPath.toLowerCase();
  const basename = comparablePath.split("/").at(-1) || comparablePath;

  if (!comparablePath) {
    return true;
  }

  if (isAbsolutePath(comparablePath) && !policy.allowAbsolutePaths) {
    return true;
  }

  if (policy.allowedPrefixes.some((prefix) => pathMatchesPolicyPrefix(comparablePath, prefix))) {
    return false;
  }

  if (policy.ignoredBasenames.includes(basename)) {
    return true;
  }

  return policy.ignoredPrefixes.some((prefix) =>
    pathMatchesPolicyPrefix(comparablePath, prefix)
  );
}

async function resolvePolicyKnowledgeRoot(projectRootOrKnowledgeRoot) {
  const resolved = path.resolve(projectRootOrKnowledgeRoot || process.cwd());

  if (await exists(path.join(resolved, "project-profile.md"))) {
    return resolved;
  }

  return path.join(resolved, ".project-knowledge");
}

function normalizePolicyPrefix(value) {
  return normalizeEvidencePath(value)
    .toLowerCase()
    .replace(/\/+$/g, "");
}

function normalizePolicyBasename(value) {
  const normalized = normalizeEvidencePath(value).toLowerCase();
  return normalized.split("/").at(-1) || normalized;
}

function pathMatchesPolicyPrefix(comparablePath, prefix) {
  if (!prefix) {
    return false;
  }

  return comparablePath === prefix || comparablePath.startsWith(`${prefix}/`);
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

async function readJsonIfExists(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }
    if (error instanceof SyntaxError) {
      throw new Error(`证据策略 JSON 无法解析: ${filePath}: ${error.message}`);
    }
    throw error;
  }
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
