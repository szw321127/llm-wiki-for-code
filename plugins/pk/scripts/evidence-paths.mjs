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

const DEFAULT_WALK_IGNORED_DIRECTORIES = new Set([
  ".git",
  ".agents",
  ".claude",
  ".codex",
  ".cursor",
  ".project-knowledge",
  ".worktrees",
  "node_modules",
  "dist",
  "build",
  "coverage"
]);

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
  return String(resolveEvidencePath(filePath) || "")
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

export function normalizeEvidenceRecords(evidenceValues, policyOverrides = {}) {
  const policy = buildEvidencePolicy(policyOverrides);
  const records = [];
  const seen = new Set();

  for (const value of asArray(evidenceValues)) {
    const pathValue = normalizeEvidencePath(value);
    if (!pathValue || isVolatileEvidencePath(pathValue, policy) || seen.has(pathValue)) {
      continue;
    }
    seen.add(pathValue);

    if (value && typeof value === "object" && !Array.isArray(value)) {
      records.push({
        path: pathValue,
        ...Object.fromEntries(
          Object.entries(value)
            .filter(([key]) => key !== "path")
            .filter(([, nestedValue]) => nestedValue !== undefined && nestedValue !== null && nestedValue !== "")
        )
      });
    }
  }

  return records;
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

export async function filterExistingEvidencePaths(projectRoot, filePaths, policyOverrides = {}) {
  const inspection = await inspectEvidencePaths(projectRoot, filePaths, policyOverrides);
  return inspection.existingSourceEvidence;
}

export async function inspectEvidencePaths(projectRoot, filePaths, policyOverrides = {}, options = {}) {
  const policy = buildEvidencePolicy(policyOverrides);
  const normalizedPaths = normalizeEvidencePaths(filePaths, policy);
  const projectFiles = options.projectFiles || await listProjectEvidenceFiles(projectRoot, policy);
  const projectFileSet = new Set(projectFiles);
  const existingSourceEvidence = [];
  const missingSourceEvidence = [];

  for (const evidencePath of normalizedPaths) {
    if (await evidencePathExists(projectRoot, evidencePath, projectFileSet)) {
      existingSourceEvidence.push(evidencePath);
    } else {
      missingSourceEvidence.push(evidencePath);
    }
  }

  return {
    existingSourceEvidence,
    missingSourceEvidence,
    repairCandidates: collectRepairCandidates(missingSourceEvidence, projectFiles)
  };
}

export async function listProjectEvidenceFiles(projectRoot, policyOverrides = {}) {
  const policy = buildEvidencePolicy(policyOverrides);
  const resolvedRoot = path.resolve(projectRoot || process.cwd());
  const files = await walkProjectFiles(resolvedRoot);

  return files
    .map((filePath) => path.relative(resolvedRoot, filePath).replace(/\\/g, "/"))
    .map((filePath) => normalizeEvidencePath(filePath))
    .filter(Boolean)
    .filter((filePath) => !isVolatileEvidencePath(filePath, policy))
    .sort();
}

function resolveEvidencePath(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value.path;
  }
  return value;
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

async function evidencePathExists(projectRoot, evidencePath, projectFileSet) {
  if (isAbsolutePath(evidencePath)) {
    return exists(path.normalize(evidencePath));
  }

  if (projectFileSet) {
    return projectFileSet.has(evidencePath);
  }

  return exists(path.join(projectRoot, evidencePath));
}

function collectRepairCandidates(missingSourceEvidence, projectFiles) {
  const candidates = {};

  for (const missingPath of missingSourceEvidence) {
    const basename = path.posix.basename(missingPath).toLowerCase();
    const matches = projectFiles
      .filter((filePath) => path.posix.basename(filePath).toLowerCase() === basename)
      .sort((left, right) => compareRepairCandidate(left, right, missingPath))
      .slice(0, 3);

    if (matches.length > 0) {
      candidates[missingPath] = matches;
    }
  }

  return candidates;
}

function compareRepairCandidate(left, right, missingPath) {
  return scoreRepairCandidate(right, missingPath) - scoreRepairCandidate(left, missingPath) ||
    left.localeCompare(right);
}

function scoreRepairCandidate(candidatePath, missingPath) {
  const missingParts = missingPath.toLowerCase().split("/");
  const candidateParts = candidatePath.toLowerCase().split("/");
  const sharedParts = candidateParts.filter((part) => missingParts.includes(part)).length;
  const sameExtension = path.posix.extname(candidatePath) === path.posix.extname(missingPath) ? 1 : 0;
  return sharedParts * 2 + sameExtension;
}

async function walkProjectFiles(rootDirectory) {
  const files = [];
  const stack = [rootDirectory];

  while (stack.length > 0) {
    const currentDirectory = stack.pop();
    let entries = [];
    try {
      entries = await fs.readdir(currentDirectory, { withFileTypes: true });
    } catch (error) {
      if (error.code === "ENOENT") {
        continue;
      }
      throw error;
    }

    for (const entry of entries) {
      const absolutePath = path.join(currentDirectory, entry.name);
      if (entry.isDirectory()) {
        if (!DEFAULT_WALK_IGNORED_DIRECTORIES.has(entry.name.toLowerCase())) {
          stack.push(absolutePath);
        }
        continue;
      }

      if (entry.isFile()) {
        files.push(absolutePath);
      }
    }
  }

  return files;
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
