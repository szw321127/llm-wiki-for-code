#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildProjectGraphFromDirectory, normalizeUsageEntry } from "./knowledge-lib.mjs";
import { filterExistingEvidencePaths, loadEvidencePolicy, normalizeEvidencePaths } from "./evidence-paths.mjs";
import { resolveProjectTarget } from "./paths.mjs";
import { scanProject } from "./scan-project.mjs";

const CHINESE_MATCH_PHRASES = [
  "页面生命周期",
  "生命周期",
  "全局调度器",
  "调度器",
  "自动同步",
  "自动任务",
  "长周期任务",
  "登录态",
  "登录",
  "用户信息就绪",
  "用户信息",
  "上次执行时间",
  "统一调用",
  "调用封装",
  "封装层",
  "原生调用",
  "内联配置",
  "环境变量",
  "配置管理"
];

const DEFAULT_PREFLIGHT_LIMITS = {
  maxMatchedPractices: 5,
  maxEvidencePerNode: 5,
  maxEvidenceHints: 50,
  maxScanHintsPerKind: 5
};

export async function runPreflight(projectRootOrKnowledgeRoot = process.cwd(), taskText = "", options = {}) {
  const target = path.resolve(projectRootOrKnowledgeRoot || process.cwd());
  const resolved = await resolveProjectKnowledge(target);
  const limits = normalizePreflightLimits(options);
  const taskIntent = extractTaskIntent(taskText, options);

  if (!resolved.hasKnowledge) {
    return emptyPreflightResult({
      mode: "no-knowledge",
      projectRoot: target,
      knowledgeRoot: resolved.knowledgeRoot,
      taskText,
      limits
    });
  }

  const graph = await buildProjectGraphFromDirectory(resolved.knowledgeRoot);
  const evidencePolicy = await loadEvidencePolicy(resolved.knowledgeRoot);
  const nodeMap = new Map(graph.nodes.map((node) => [node.id, node]));
  const viewId =
    graph.project_views.find((view) => !view.synthetic)?.id ||
    graph.project_views[0]?.id ||
    "global";
  const matchedPracticeMatches = graph.nodes
    .filter((node) => node.type === "practice")
    .map((node) => scorePracticeMatch(node, taskText, taskIntent))
    .filter((match) => match.score > 0)
    .sort((left, right) => right.score - left.score || left.node.title.localeCompare(right.node.title, "zh-Hans-CN"))
    .slice(0, limits.maxMatchedPractices);
  const matchedPractices = await Promise.all(
    matchedPracticeMatches.map((match) =>
      summarizePractice(match.node, viewId, limits, evidencePolicy, resolved.projectRoot, match.reasons)
    )
  );

  if (matchedPractices.length > 0) {
    const recommendedOptions = await collectRecommendedOptions(
      matchedPractices,
      nodeMap,
      viewId,
      limits,
      evidencePolicy,
      resolved.projectRoot
    );
    const evidenceHintResult = collectEvidenceHintsFromNodes(
      [...matchedPractices, ...recommendedOptions],
      limits
    );
    if (options.recordHits === true) {
      await recordPreflightHits(
        resolved.knowledgeRoot,
        [
          ...matchedPractices.map((practice) => practice.id),
          ...recommendedOptions.map((option) => option.id)
        ],
        options
      );
    }
    return {
      mode: "knowledge-hit",
      projectRoot: resolved.projectRoot,
      knowledgeRoot: resolved.knowledgeRoot,
      taskText,
      taskIntent,
      limits,
      matchedPractices,
      recommendedOptions,
      incubatingCandidates: recommendedOptions.filter((option) => option.maturity === "incubating"),
      evidenceHints: evidenceHintResult.hints,
      evidenceHintCount: evidenceHintResult.totalCount,
      evidenceHintsTruncated: evidenceHintResult.truncated
    };
  }

  const scan = await scanProject(resolved.projectRoot);
  const evidenceHintResult = collectEvidenceHintsFromScan(scan, limits, evidencePolicy);
  return {
    mode: "needs-project-scan",
    projectRoot: resolved.projectRoot,
    knowledgeRoot: resolved.knowledgeRoot,
    taskText,
    taskIntent,
    limits,
    matchedPractices: [],
    recommendedOptions: [],
    incubatingCandidates: [],
    evidenceHints: evidenceHintResult.hints,
    evidenceHintCount: evidenceHintResult.totalCount,
    evidenceHintsTruncated: evidenceHintResult.truncated
  };
}

async function resolveProjectKnowledge(target) {
  return resolveProjectTarget(target);
}

function normalizePreflightLimits(options = {}) {
  return {
    maxMatchedPractices: normalizeLimit(options.maxMatchedPractices, DEFAULT_PREFLIGHT_LIMITS.maxMatchedPractices),
    maxEvidencePerNode: normalizeLimit(options.maxEvidencePerNode, DEFAULT_PREFLIGHT_LIMITS.maxEvidencePerNode),
    maxEvidenceHints: normalizeLimit(options.maxEvidenceHints, DEFAULT_PREFLIGHT_LIMITS.maxEvidenceHints),
    maxScanHintsPerKind: normalizeLimit(options.maxScanHintsPerKind, DEFAULT_PREFLIGHT_LIMITS.maxScanHintsPerKind)
  };
}

function normalizeLimit(value, fallback) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue < 0) {
    return fallback;
  }
  return Math.floor(numberValue);
}

function emptyPreflightResult({ mode, projectRoot, knowledgeRoot, taskText, limits }) {
  return {
    mode,
    projectRoot,
    knowledgeRoot,
    taskText,
    limits,
    matchedPractices: [],
    recommendedOptions: [],
    incubatingCandidates: [],
    evidenceHints: [],
    evidenceHintCount: 0,
    evidenceHintsTruncated: false
  };
}

function scorePracticeMatch(node, taskText, taskIntent) {
  const excludedReasons = collectApplicabilityReasons(
    node.does_not_apply_when,
    taskIntent,
    "exclude"
  );
  if (excludedReasons.length > 0) {
    return { node, score: 0, reasons: [] };
  }

  const lexicalMatch = scoreLexicalTaskMatch(node, taskText);
  const appliesReasons = collectApplicabilityReasons(node.applies_when, taskIntent);
  const score = lexicalMatch.score + appliesReasons.length * 4;

  return {
    node,
    score,
    reasons: dedupeValues([...lexicalMatch.reasons, ...appliesReasons])
  };
}

function scoreLexicalTaskMatch(node, taskText) {
  const taskTerms = tokenize(taskText);
  if (taskTerms.length === 0) {
    return { score: 0, reasons: [] };
  }

  const nodeText = normalizeText([
    node.id,
    node.title,
    node.summary,
    ...(node.keywords || [])
  ].join(" "));

  return taskTerms.reduce((result, term) => {
    if (nodeText.includes(term)) {
      const keywordMatch = (node.keywords || []).some((keyword) => normalizeText(keyword) === term);
      result.score += keywordMatch ? 3 : 1;
      result.reasons.push(`${keywordMatch ? "keyword" : "text"}:${term}`);
    }
    return result;
  }, { score: 0, reasons: [] });
}

export function extractTaskIntent(taskText = "", options = {}) {
  const normalized = normalizePathLikeText(taskText);
  return {
    taskKinds: dedupeValues([
      ...detectTaskKinds(normalized),
      ...asArray(options.taskKinds)
    ]),
    technologies: dedupeValues([
      ...detectTechnologies(normalized),
      ...asArray(options.technologies)
    ]),
    pathHints: dedupeValues([
      ...detectPathHints(taskText),
      ...asArray(options.pathHints)
    ]),
    operationHints: dedupeValues([
      ...detectOperationHints(normalized),
      ...asArray(options.operationHints)
    ])
  };
}

function detectTaskKinds(normalizedText) {
  const kinds = [];

  if (matchesAny(normalizedText, ["frontend", "page", "页面", "视图", "src/views", "src/pages", ".vue", ".tsx", ".jsx"])) {
    kinds.push("frontend-page");
  }
  if (matchesAny(normalizedText, ["crud", "增删改查", "列表", "list", "table", "表格"])) {
    kinds.push("crud-list");
  }
  if (matchesAny(normalizedText, ["api client", "http client", "request client", "src/api", "接口调用", "请求封装"])) {
    kinds.push("api-client");
  }
  if (matchesAny(normalizedText, ["config", "配置", "env", "环境变量"])) {
    kinds.push("config");
  }
  if (matchesAny(normalizedText, ["test", "tests/", ".test.", ".spec.", "测试", "单元测试"])) {
    kinds.push("test");
  }
  if (matchesAny(normalizedText, ["govern", "lint", "治理", "wiki", "knowledge"])) {
    kinds.push("governance");
  }

  return kinds;
}

function detectTechnologies(normalizedText) {
  const technologies = [];
  if (matchesAny(normalizedText, ["vue", ".vue"])) {
    technologies.push("vue");
  }
  if (matchesAny(normalizedText, ["react", ".tsx", ".jsx"])) {
    technologies.push("react");
  }
  if (matchesAny(normalizedText, ["node", "node.js", "npm"])) {
    technologies.push("node");
  }
  if (matchesAny(normalizedText, ["typescript", ".ts", ".tsx"])) {
    technologies.push("typescript");
  }
  return technologies;
}

function detectPathHints(taskText) {
  return dedupeValues(
    Array.from(String(taskText || "").matchAll(/(?:^|[\s"'`(])((?:[A-Za-z]:[\\/])?[\w@.-]+(?:[\\/][\w@.-]+)+)/g))
      .map((match) => normalizePathHint(match[1]))
      .filter(Boolean)
  );
}

function detectOperationHints(normalizedText) {
  const operations = [];
  if (matchesAny(normalizedText, ["add", "create", "new", "新增", "创建", "实现"])) {
    operations.push("create");
  }
  if (matchesAny(normalizedText, ["modify", "update", "change", "调整", "修改", "更新"])) {
    operations.push("modify");
  }
  if (matchesAny(normalizedText, ["review", "审查", "检查"])) {
    operations.push("review");
  }
  if (matchesAny(normalizedText, ["debug", "fix", "bug", "修复", "排查"])) {
    operations.push("debug");
  }
  return operations;
}

function collectApplicabilityReasons(applicability = {}, taskIntent = {}, mode = "include") {
  const reasons = [];
  const prefix = mode === "exclude" ? "excluded-" : "";

  for (const taskKind of asArray(applicability.task_kinds)) {
    if (asArray(taskIntent.taskKinds).includes(taskKind)) {
      reasons.push(`${prefix}task-kind:${taskKind}`);
    }
  }

  for (const technology of asArray(applicability.technologies)) {
    if (asArray(taskIntent.technologies).includes(technology)) {
      reasons.push(`${prefix}technology:${technology}`);
    }
  }

  for (const pathPrefix of asArray(applicability.path_prefixes)) {
    const normalizedPrefix = normalizePathHint(pathPrefix);
    if (
      normalizedPrefix &&
      asArray(taskIntent.pathHints).some(
        (pathHint) => pathHint === normalizedPrefix || pathHint.startsWith(`${normalizedPrefix}/`)
      )
    ) {
      reasons.push(`${prefix}path-prefix:${normalizedPrefix}`);
    }
  }

  return reasons;
}

function matchesAny(value, needles) {
  return needles.some((needle) => value.includes(needle));
}

function normalizePathLikeText(value) {
  return normalizeText(value).replace(/\\/g, "/");
}

function normalizePathHint(value) {
  return normalizePathLikeText(value).replace(/^["'`(]+|[)"'`,.]+$/g, "");
}

function tokenize(value) {
  const normalized = normalizeText(value);
  const baseTerms = normalized
    .split(/[^a-z0-9\u4e00-\u9fff]+/u)
    .map((term) => term.trim())
    .filter((term) => term.length >= 2);
  const phraseTerms = CHINESE_MATCH_PHRASES.filter((phrase) => normalized.includes(phrase));

  return dedupeValues([...baseTerms, ...phraseTerms]);
}

function normalizeText(value) {
  return String(value || "").toLowerCase();
}

function dedupeValues(values) {
  return Array.from(new Set((values || []).filter(Boolean)));
}

function asArray(value) {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

async function recordPreflightHits(knowledgeRoot, nodeIds, options = {}) {
  const uniqueNodeIds = dedupeValues(nodeIds);
  if (uniqueNodeIds.length === 0) {
    return;
  }

  const usagePath = path.join(knowledgeRoot, "state", "usage-index.json");
  const rawUsage = await readJson(usagePath, {});
  const usageIndex = rawUsage.entries || rawUsage;
  const hitDate = extractDate(options.now || new Date());

  for (const nodeId of uniqueNodeIds) {
    const entry = normalizeUsageEntry(usageIndex[nodeId]);
    entry.preflight_hits += 1;
    entry.last_hit_at = hitDate;
    usageIndex[nodeId] = entry;
  }

  await fs.mkdir(path.dirname(usagePath), { recursive: true });
  await fs.writeFile(usagePath, `${JSON.stringify(usageIndex, null, 2)}\n`, "utf8");
}

function extractDate(value) {
  const directMatch = String(value || "").match(/\d{4}-\d{2}-\d{2}/);
  if (directMatch) {
    return directMatch[0];
  }

  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime())
    ? new Date().toISOString().slice(0, 10)
    : date.toISOString().slice(0, 10);
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

async function summarizePractice(node, viewId, limits, evidencePolicy, projectRoot, matchReasons = []) {
  const evidence = await summarizeEvidence(node.source_evidence || [], limits, evidencePolicy, projectRoot);
  return {
    id: node.id,
    title: node.title,
    summary: node.summary,
    maturity: node.maturity,
    source_path: node.source_path,
    recommendation_pool: node.recommendation_pools?.[viewId] || node.recommendation_pools?.global || [],
    recommended_option: node.recommended_options?.[viewId] || node.recommended_options?.global || null,
    matchReasons,
    source_evidence: evidence.preview,
    source_evidence_count: evidence.totalCount,
    source_evidence_truncated: evidence.truncated
  };
}

async function collectRecommendedOptions(practices, nodeMap, viewId, limits, evidencePolicy, projectRoot) {
  const options = [];
  const seen = new Set();

  for (const practice of practices) {
    const optionIds = practice.recommendation_pool || [];
    for (const optionId of optionIds) {
      if (seen.has(optionId)) {
        continue;
      }
      const option = nodeMap.get(optionId);
      if (!option) {
        continue;
      }
      seen.add(optionId);
      options.push(await summarizeOption(option, viewId, practice.id, limits, evidencePolicy, projectRoot));
    }
  }

  return options;
}

async function summarizeOption(node, viewId, practiceId, limits, evidencePolicy, projectRoot) {
  const evidence = await summarizeEvidence(node.source_evidence || [], limits, evidencePolicy, projectRoot);
  return {
    id: node.id,
    title: node.title,
    summary: node.summary,
    practice: practiceId || node.practice,
    maturity: node.maturity,
    final_score: node.final_scores?.[viewId] ?? node.final_scores?.global ?? node.base_score,
    effective_score: node.effective_scores?.[viewId] ?? node.effective_scores?.global ?? node.base_score,
    adopted_count: node.usage_stats?.adopted_count || 0,
    source_path: node.source_path,
    source_evidence: evidence.preview,
    source_evidence_count: evidence.totalCount,
    source_evidence_truncated: evidence.truncated
  };
}

async function summarizeEvidence(sourceEvidence, limits, evidencePolicy, projectRoot) {
  const values = await filterExistingEvidencePaths(projectRoot, sourceEvidence || [], evidencePolicy);
  const preview = values.slice(0, limits.maxEvidencePerNode);
  return {
    preview,
    totalCount: values.length,
    truncated: values.length > preview.length
  };
}

function collectEvidenceHintsFromNodes(nodes, limits) {
  const hints = [];
  const seen = new Set();
  let totalCount = 0;

  for (const node of nodes) {
    totalCount += Number(node.source_evidence_count ?? (node.source_evidence || []).length);
    for (const evidencePath of node.source_evidence || []) {
      const key = `${node.id}:${evidencePath}`;
      if (seen.has(key)) {
        continue;
      }
      if (hints.length >= limits.maxEvidenceHints) {
        continue;
      }
      seen.add(key);
      hints.push({
        kind: "knowledge-evidence",
        node_id: node.id,
        path: evidencePath
      });
    }
  }

  return {
    hints,
    totalCount,
    truncated: totalCount > hints.length
  };
}

function collectEvidenceHintsFromScan(scan, limits, evidencePolicy) {
  const docEvidenceFiles = dedupeValues([
    ...(scan.docEntrypoints || []),
    ...(scan.markdownFiles || []).filter((filePath) =>
      isAllowedByEvidencePolicy(filePath, evidencePolicy)
    )
  ]);
  const hintGroups = [
    ["unified-client", normalizeEvidencePaths(scan.unifiedClientFiles, evidencePolicy)],
    ["direct-call", normalizeEvidencePaths(scan.directCallFiles, evidencePolicy)],
    ["config-module", normalizeEvidencePaths(scan.configModuleFiles, evidencePolicy)],
    ["inline-config", normalizeEvidencePaths(scan.inlineConfigFiles, evidencePolicy)],
    ["logger", normalizeEvidencePaths(scan.loggerFiles, evidencePolicy)],
    ["frontend-page", normalizeEvidencePaths(scan.frontendPageFiles, evidencePolicy)],
    ["doc", normalizeEvidencePaths(docEvidenceFiles, evidencePolicy)]
  ];
  const hints = [];
  let totalCount = 0;

  for (const [kind, filePaths] of hintGroups) {
    const values = filePaths || [];
    totalCount += values.length;
    for (const filePath of values.slice(0, limits.maxScanHintsPerKind)) {
      if (hints.length >= limits.maxEvidenceHints) {
        break;
      }
      hints.push({ kind, path: filePath });
    }
  }

  return {
    hints,
    totalCount,
    truncated: totalCount > hints.length
  };
}

function isAllowedByEvidencePolicy(filePath, evidencePolicy) {
  const comparablePath = normalizeEvidencePaths([filePath], {
    useDefaultIgnores: false,
    ignoredPrefixes: [],
    ignoredBasenames: []
  })[0]?.toLowerCase();

  if (!comparablePath) {
    return false;
  }

  return (evidencePolicy.allowedPrefixes || []).some((prefix) =>
    comparablePath === prefix || comparablePath.startsWith(`${prefix}/`)
  );
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export function parsePreflightCliArgs(argv = []) {
  const positional = [];
  const options = {};

  for (const arg of argv) {
    if (arg === "--record-hits") {
      options.recordHits = true;
      continue;
    }
    positional.push(arg);
  }

  const [targetPath, ...taskParts] = positional;
  return {
    targetPath,
    taskText: taskParts.join(" "),
    options
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { targetPath, taskText, options } = parsePreflightCliArgs(process.argv.slice(2));
  const result = await runPreflight(targetPath || process.cwd(), taskText, options);
  console.log(JSON.stringify(result, null, 2));
}
