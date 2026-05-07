#!/usr/bin/env node

import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { crystallizeSession } from "./crystallize-session.mjs";
import { loadEvidencePolicy, normalizeEvidencePaths } from "./evidence-paths.mjs";
import { runPreflight } from "./preflight-session.mjs";

const execFileAsync = promisify(execFile);

export async function autoCrystallizeSession(projectRootOrKnowledgeRoot, input = {}) {
  const target = await resolveProjectTarget(projectRootOrKnowledgeRoot);
  if (!target.hasKnowledge) {
    return buildNoKnowledgeResult(target);
  }

  const taskText = buildTaskText(input);
  const evidencePolicy = await loadEvidencePolicy(target.knowledgeRoot);
  const touchedFiles = await resolveTouchedFiles(target.projectRoot, input, evidencePolicy);
  const preflight = await runPreflight(target.projectRoot, taskText);
  const adoptedNodeIds = Array.isArray(input.adoptedNodeIds)
    ? dedupeValues(input.adoptedNodeIds)
    : inferAdoptedNodeIds(preflight);
  const incubatingNodes = Array.isArray(input.incubatingNodes)
    ? input.incubatingNodes
    : buildIncubatingNodes({
      input,
      taskText,
      touchedFiles,
      preflightMode: preflight.mode
    });

  const crystallizeInput = {
    ...input,
    title: input.title || "自动知识结晶",
    topic: input.topic || taskText || "auto-crystallize",
    taskText,
    decisionSummary: input.decisionSummary || taskText || "自动记录本轮任务知识沉淀。",
    touchedFiles,
    adoptedNodeIds,
    incubatingNodes,
    stableUpdates: input.stableUpdates || []
  };
  const result = await crystallizeSession(target.projectRoot, crystallizeInput);

  return {
    ...result,
    auto: {
      preflightMode: preflight.mode,
      touchedFiles,
      inferredAdoptedNodeIds: adoptedNodeIds,
      generatedIncubatingNodeIds: incubatingNodes.map((node) => node.id)
    }
  };
}

export async function loadAutoCrystallizeCliInput(projectRootOrKnowledgeRoot, cliArgs = [], defaults = {}) {
  const args = [...cliArgs].filter((arg) => arg !== undefined && arg !== null);
  const defaultInput = {
    topic: "auto-crystallize",
    title: "自动知识结晶",
    decisionSummary: "自动执行了一次项目知识结晶。",
    ...defaults
  };

  if (args.length === 0) {
    return defaultInput;
  }

  if (args[0] === "--input" || args[0] === "-i") {
    if (!args[1]) {
      throw new Error("缺少自动结晶输入 JSON 文件路径");
    }
    return {
      ...defaultInput,
      ...(await readAutoCrystallizeInputFile(projectRootOrKnowledgeRoot, args[1]))
    };
  }

  const inputPath = await resolveExistingInputFile(projectRootOrKnowledgeRoot, args[0]);
  if (inputPath) {
    return {
      ...defaultInput,
      ...(await readJson(inputPath, {}))
    };
  }

  const taskText = args.join(" ");
  return {
    ...defaultInput,
    topic: taskText || defaultInput.topic,
    taskText,
    decisionSummary: taskText || defaultInput.decisionSummary
  };
}

async function resolveProjectTarget(projectRootOrKnowledgeRoot) {
  const resolved = path.resolve(projectRootOrKnowledgeRoot || process.cwd());

  if (await exists(path.join(resolved, "project-profile.md"))) {
    return {
      hasKnowledge: true,
      projectRoot: path.dirname(resolved),
      knowledgeRoot: resolved
    };
  }

  const knowledgeRoot = path.join(resolved, ".project-knowledge");
  if (await exists(path.join(knowledgeRoot, "project-profile.md"))) {
    return {
      hasKnowledge: true,
      projectRoot: resolved,
      knowledgeRoot
    };
  }

  return {
    hasKnowledge: false,
    projectRoot: resolved,
    knowledgeRoot
  };
}

function buildNoKnowledgeResult(target) {
  return {
    mode: "no-knowledge",
    skipped: true,
    reason: "project-knowledge-not-initialized",
    projectRoot: target.projectRoot,
    knowledgeRoot: target.knowledgeRoot,
    sessionId: null,
    incubatingNodeIds: [],
    updatedNodeIds: [],
    adoptedNodeIds: [],
    auto: {
      preflightMode: "no-knowledge",
      touchedFiles: [],
      inferredAdoptedNodeIds: [],
      generatedIncubatingNodeIds: []
    }
  };
}

function buildTaskText(input) {
  return [
    input.taskText,
    input.topic,
    input.title,
    input.decisionSummary
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
}

async function resolveTouchedFiles(projectRoot, input, evidencePolicy) {
  if (Array.isArray(input.touchedFiles) && input.touchedFiles.length > 0) {
    return normalizeTouchedFiles(input.touchedFiles, evidencePolicy);
  }

  return normalizeTouchedFiles(await collectGitTouchedFiles(projectRoot), evidencePolicy);
}

async function collectGitTouchedFiles(projectRoot) {
  try {
    const { stdout } = await execFileAsync("git", [
      "-C",
      projectRoot,
      "status",
      "--porcelain",
      "-uall"
    ], {
      windowsHide: true
    });
    return stdout
      .split(/\r?\n/)
      .map((line) => parseGitStatusPath(line))
      .filter(Boolean);
  } catch {
    return [];
  }
}

function parseGitStatusPath(line) {
  if (!line || line.length < 4) {
    return null;
  }

  const rawPath = line.slice(3).trim();
  const renameTarget = rawPath.includes(" -> ")
    ? rawPath.split(" -> ").at(-1)
    : rawPath;
  return unquoteGitPath(renameTarget);
}

function unquoteGitPath(filePath) {
  const value = String(filePath || "").trim();
  if (value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1);
  }
  return value;
}

function normalizeTouchedFiles(files, evidencePolicy) {
  return normalizeEvidencePaths(files, evidencePolicy);
}

function inferAdoptedNodeIds(preflight) {
  if (preflight.mode !== "knowledge-hit") {
    return [];
  }

  return dedupeValues(
    (preflight.matchedPractices || [])
      .map((practice) => practice.recommended_option)
      .filter(Boolean)
  );
}

function buildIncubatingNodes({ input, taskText, touchedFiles, preflightMode }) {
  if (preflightMode === "knowledge-hit" || touchedFiles.length === 0) {
    return [];
  }

  const metadata = buildIncubatingNodeMetadata({ input, taskText, touchedFiles });
  const keywords = dedupeValues([
    ...(metadata.keywords || []),
    ...extractKeywords(taskText || metadata.practiceTitle)
  ]);

  return [
    {
      id: metadata.practiceId,
      type: "practice",
      title: metadata.practiceTitle,
      summary: metadata.practiceSummary,
      contexts: [],
      constraints: [],
      rules: [],
      option_ids: [metadata.optionId],
      keywords,
      source_evidence: touchedFiles
    },
    {
      id: metadata.optionId,
      type: "option",
      title: metadata.optionTitle,
      summary: metadata.optionSummary,
      practice: metadata.practiceId,
      base_score: 36,
      score_breakdown: {
        consistency: 7,
        efficiency: 7,
        maintainability: 8,
        extensibility: 7,
        risk: 7
      },
      alternatives: [],
      keywords,
      source_evidence: touchedFiles
    }
  ];
}

function buildIncubatingNodeMetadata({ input, taskText, touchedFiles }) {
  const detectedPattern = detectLongRunningAutoTaskPattern({ input, taskText, touchedFiles });
  if (detectedPattern) {
    return detectedPattern;
  }

  const slug = slugify(input.taskText || input.topic || input.title || taskText || "session");
  const title = input.title || input.topic || taskText || "新场景";
  const summary = input.decisionSummary || `从本轮任务中发现 ${title} 的候选实践。`;

  return {
    practiceId: `practice-${slug}`,
    optionId: `option-${slug}-candidate`,
    practiceTitle: `${title} 实践`,
    optionTitle: `${title} 候选方案`,
    practiceSummary: summary,
    optionSummary: summary,
    keywords: extractKeywords(taskText || title)
  };
}

function detectLongRunningAutoTaskPattern({ input, taskText, touchedFiles }) {
  const combinedText = [
    input.title,
    input.topic,
    input.taskText,
    input.decisionSummary,
    taskText
  ].filter(Boolean).join(" ").toLowerCase();
  const normalizedFiles = (touchedFiles || []).map((filePath) => String(filePath || "").toLowerCase());
  const hasSchedulerSignal =
    /全局调度器|调度器|调度\s*core|scheduler|schedule/.test(combinedText) ||
    normalizedFiles.some((filePath) => /scheduler|schedule/.test(filePath));
  const hasAutoTaskSignal =
    /自动任务|自动同步|自动|sync|tracking|轮询|定时/.test(combinedText) ||
    normalizedFiles.some((filePath) => /sync|tracking|scheduler/.test(filePath));
  const hasLifecycleBoundarySignal =
    /页面生命周期|生命周期|页面.*绑定|登录后|登录态|用户信息|用户.*加载|全局初始化|lifecycle/.test(combinedText);

  if (!hasSchedulerSignal || !hasAutoTaskSignal || !hasLifecycleBoundarySignal) {
    return null;
  }

  return {
    practiceId: "practice-long-running-auto-task-global-scheduler",
    optionId: "option-login-ready-global-scheduler",
    practiceTitle: "长周期自动任务应使用登录态就绪后的全局调度器",
    optionTitle: "登录态就绪后初始化全局调度器",
    practiceSummary:
      "长周期自动任务不应绑定具体页面生命周期；应在登录态或用户信息就绪后初始化全局调度器，读取开关、上次执行时间等状态后按需执行。",
    optionSummary:
      "将调度 core 与页面接线分离，在登录态就绪后启动全局调度器，由调度器读取开关和上次执行时间并触发任务。",
    keywords: [
      "自动任务",
      "自动同步",
      "长周期任务",
      "全局调度器",
      "登录态",
      "用户信息就绪",
      "页面生命周期",
      "调度 core",
      "scheduler",
      "lifecycle",
      "sync"
    ]
  };
}

function slugify(value) {
  const slug = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || "session";
}

function extractKeywords(value) {
  return dedupeValues(
    String(value || "")
      .toLowerCase()
      .split(/[^a-z0-9\u4e00-\u9fff]+/u)
      .map((term) => term.trim())
      .filter((term) => term.length >= 2)
      .slice(0, 8)
  );
}

async function readAutoCrystallizeInputFile(projectRootOrKnowledgeRoot, inputFilePath) {
  const resolvedInputPath = await resolveExistingInputFile(projectRootOrKnowledgeRoot, inputFilePath);
  if (!resolvedInputPath) {
    throw new Error(`未找到自动结晶输入 JSON: ${inputFilePath}`);
  }

  const input = await readJson(resolvedInputPath, {});
  if (!input || Array.isArray(input) || typeof input !== "object") {
    throw new Error(`自动结晶输入 JSON 必须是对象: ${resolvedInputPath}`);
  }
  return input;
}

async function resolveExistingInputFile(projectRootOrKnowledgeRoot, inputFilePath) {
  const candidates = buildInputPathCandidates(projectRootOrKnowledgeRoot, inputFilePath);

  for (const candidate of candidates) {
    if (await isFile(candidate)) {
      return candidate;
    }
  }

  return null;
}

function buildInputPathCandidates(projectRootOrKnowledgeRoot, inputFilePath) {
  if (path.isAbsolute(inputFilePath)) {
    return [inputFilePath];
  }

  const resolvedProjectPath = path.resolve(projectRootOrKnowledgeRoot || process.cwd());
  return dedupeValues([
    path.resolve(process.cwd(), inputFilePath),
    path.resolve(resolvedProjectPath, inputFilePath),
    path.resolve(resolvedProjectPath, ".project-knowledge", inputFilePath)
  ]);
}

function dedupeValues(values) {
  return Array.from(new Set((values || []).filter(Boolean)));
}

async function readJson(filePath, fallbackValue) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") {
      return fallbackValue;
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

async function isFile(filePath) {
  try {
    const stats = await fs.stat(filePath);
    return stats.isFile();
  } catch {
    return false;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const projectRoot = process.argv[2] || process.cwd();
  const input = await loadAutoCrystallizeCliInput(projectRoot, process.argv.slice(3));
  const result = await autoCrystallizeSession(projectRoot, input);
  console.log(JSON.stringify(result, null, 2));
}
