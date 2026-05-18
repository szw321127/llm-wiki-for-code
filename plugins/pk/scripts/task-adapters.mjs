import fs from "node:fs/promises";
import path from "node:path";

import { normalizeEvidencePaths } from "./evidence-paths.mjs";

const TASK_CONTEXT_FILES = [
  "prd.md",
  "implement.jsonl",
  "check.jsonl",
  "task.json"
];

export async function loadTaskContext(projectRoot, input = {}) {
  const taskDirectory = await resolveTaskContextDirectory(projectRoot, input);
  if (!taskDirectory) {
    return emptyTaskContext();
  }

  const processSources = [];
  const textParts = [];
  const candidateEvidenceHints = [];
  let title = null;
  let topic = input.taskId || path.basename(taskDirectory);
  let decisionSummary = null;

  const taskJsonPath = path.join(taskDirectory, "task.json");
  const taskJson = await readJsonIfExists(taskJsonPath);
  if (taskJson) {
    title = asOptionalString(taskJson.title) || title;
    topic = asOptionalString(taskJson.id) || topic;
    decisionSummary = asOptionalString(taskJson.summary) || decisionSummary;
    textParts.push(compactJoin([taskJson.title, taskJson.summary, taskJson.description]));
    candidateEvidenceHints.push(...extractPathHints(JSON.stringify(taskJson)));
  }

  const prdPath = path.join(taskDirectory, "prd.md");
  const prd = await readTextIfExists(prdPath);
  if (prd) {
    processSources.push(toProjectRelativePath(projectRoot, prdPath));
    title = title || extractMarkdownTitle(prd);
    decisionSummary = decisionSummary || extractFirstMeaningfulLine(prd);
    textParts.push(prd);
    candidateEvidenceHints.push(...extractPathHints(prd));
  }

  const researchDirectory = path.join(taskDirectory, "research");
  const researchFiles = await listMarkdownFiles(researchDirectory);
  for (const researchPath of researchFiles) {
    const research = await readTextIfExists(researchPath);
    if (!research) {
      continue;
    }
    processSources.push(toProjectRelativePath(projectRoot, researchPath));
    textParts.push(research);
    candidateEvidenceHints.push(...extractPathHints(research));
  }

  for (const fileName of TASK_CONTEXT_FILES.filter((name) => name !== "prd.md" && name !== "task.json")) {
    const filePath = path.join(taskDirectory, fileName);
    const source = await readTextIfExists(filePath);
    if (!source) {
      continue;
    }
    processSources.push(toProjectRelativePath(projectRoot, filePath));
    textParts.push(source);
    candidateEvidenceHints.push(...extractPathHints(source));
    candidateEvidenceHints.push(...extractJsonlPathHints(source));
  }

  if (taskJson) {
    processSources.push(toProjectRelativePath(projectRoot, taskJsonPath));
  }

  return {
    title,
    topic,
    decisionSummary,
    taskText: compactJoin(textParts),
    candidateEvidenceHints: normalizeEvidencePaths(candidateEvidenceHints, {
      useDefaultIgnores: true,
      ignoredPrefixes: [".tasks/", "tasks/", ".trellis/"],
      ignoredBasenames: [],
      allowedPrefixes: [],
      allowAbsolutePaths: false
    }),
    processSources: dedupeValues(processSources)
  };
}

async function resolveTaskContextDirectory(projectRoot, input = {}) {
  if (input.taskDir) {
    return path.resolve(projectRoot, input.taskDir);
  }

  if (input.taskId) {
    const candidates = [
      path.resolve(projectRoot, ".tasks", input.taskId),
      path.resolve(projectRoot, "tasks", input.taskId),
      path.resolve(projectRoot, ".trellis", "tasks", input.taskId)
    ];
    for (const candidate of candidates) {
      if (await isDirectory(candidate)) {
        return candidate;
      }
    }
    return null;
  }

  return null;
}

function emptyTaskContext() {
  return {
    title: null,
    topic: null,
    decisionSummary: null,
    taskText: "",
    candidateEvidenceHints: [],
    processSources: []
  };
}

async function listMarkdownFiles(directoryPath) {
  try {
    const entries = await fs.readdir(directoryPath, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
      .map((entry) => path.join(directoryPath, entry.name))
      .sort((left, right) => left.localeCompare(right));
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function isDirectory(directoryPath) {
  try {
    const stats = await fs.stat(directoryPath);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

async function readTextIfExists(filePath) {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function readJsonIfExists(filePath) {
  const source = await readTextIfExists(filePath);
  if (!source) {
    return null;
  }
  try {
    return JSON.parse(source);
  } catch {
    return null;
  }
}

function extractMarkdownTitle(source) {
  const match = String(source || "").match(/^#\s+(.+)$/m);
  return match?.[1]?.trim() || null;
}

function extractFirstMeaningfulLine(source) {
  return String(source || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith("#") && !line.startsWith("- ")) || null;
}

function extractJsonlPathHints(source) {
  const hints = [];
  for (const line of String(source || "").split(/\r?\n/)) {
    if (!line.trim()) {
      continue;
    }
    try {
      const record = JSON.parse(line);
      hints.push(record.path, record.file);
    } catch {
      // JSONL process logs are best-effort context; malformed lines should not block crystallization.
    }
  }
  return hints.filter(Boolean);
}

function extractPathHints(source) {
  return Array.from(String(source || "").matchAll(/(?:^|[\s"'`(])((?:[A-Za-z]:[\\/])?[\w@.-]+(?:[\\/][\w@.-]+)+)/g))
    .map((match) => match[1])
    .filter(Boolean);
}

function toProjectRelativePath(projectRoot, filePath) {
  return path.relative(projectRoot, filePath).replace(/\\/g, "/");
}

function compactJoin(values) {
  return (values || [])
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

function asOptionalString(value) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function dedupeValues(values) {
  return Array.from(new Set((values || []).filter(Boolean)));
}
