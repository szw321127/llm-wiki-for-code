#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildProjectGraphFromDirectory } from "./knowledge-lib.mjs";
import { loadEvidencePolicy, normalizeEvidencePaths } from "./evidence-paths.mjs";
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

  if (!resolved.hasKnowledge) {
    return emptyPreflightResult({
      mode: "no-knowledge",
      projectRoot: target,
      knowledgeRoot: path.join(target, ".project-knowledge"),
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
  const matchedPractices = graph.nodes
    .filter((node) => node.type === "practice")
    .map((node) => ({ node, score: scoreTaskMatch(node, taskText) }))
    .filter((match) => match.score > 0)
    .sort((left, right) => right.score - left.score || left.node.title.localeCompare(right.node.title, "zh-Hans-CN"))
    .slice(0, limits.maxMatchedPractices)
    .map((match) => summarizePractice(match.node, viewId, limits, evidencePolicy));

  if (matchedPractices.length > 0) {
    const recommendedOptions = collectRecommendedOptions(
      matchedPractices,
      nodeMap,
      viewId,
      limits,
      evidencePolicy
    );
    const evidenceHintResult = collectEvidenceHintsFromNodes(
      [...matchedPractices, ...recommendedOptions],
      limits
    );
    return {
      mode: "knowledge-hit",
      projectRoot: resolved.projectRoot,
      knowledgeRoot: resolved.knowledgeRoot,
      taskText,
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
  if (await exists(path.join(target, "project-profile.md"))) {
    return {
      hasKnowledge: true,
      projectRoot: path.dirname(target),
      knowledgeRoot: target
    };
  }

  const knowledgeRoot = path.join(target, ".project-knowledge");
  if (await exists(path.join(knowledgeRoot, "project-profile.md"))) {
    return {
      hasKnowledge: true,
      projectRoot: target,
      knowledgeRoot
    };
  }

  return {
    hasKnowledge: false,
    projectRoot: target,
    knowledgeRoot
  };
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

function scoreTaskMatch(node, taskText) {
  const taskTerms = tokenize(taskText);
  if (taskTerms.length === 0) {
    return 0;
  }

  const nodeText = normalizeText([
    node.id,
    node.title,
    node.summary,
    ...(node.keywords || [])
  ].join(" "));

  return taskTerms.reduce((score, term) => {
    if (nodeText.includes(term)) {
      const keywordMatch = (node.keywords || []).some((keyword) => normalizeText(keyword) === term);
      return score + (keywordMatch ? 3 : 1);
    }
    return score;
  }, 0);
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

function summarizePractice(node, viewId, limits, evidencePolicy) {
  const evidence = summarizeEvidence(node.source_evidence || [], limits, evidencePolicy);
  return {
    id: node.id,
    title: node.title,
    summary: node.summary,
    maturity: node.maturity,
    source_path: node.source_path,
    recommendation_pool: node.recommendation_pools?.[viewId] || node.recommendation_pools?.global || [],
    recommended_option: node.recommended_options?.[viewId] || node.recommended_options?.global || null,
    source_evidence: evidence.preview,
    source_evidence_count: evidence.totalCount,
    source_evidence_truncated: evidence.truncated
  };
}

function collectRecommendedOptions(practices, nodeMap, viewId, limits, evidencePolicy) {
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
      options.push(summarizeOption(option, viewId, practice.id, limits, evidencePolicy));
    }
  }

  return options;
}

function summarizeOption(node, viewId, practiceId, limits, evidencePolicy) {
  const evidence = summarizeEvidence(node.source_evidence || [], limits, evidencePolicy);
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

function summarizeEvidence(sourceEvidence, limits, evidencePolicy) {
  const values = normalizeEvidencePaths(sourceEvidence || [], evidencePolicy);
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

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [targetPath, ...taskParts] = process.argv.slice(2);
  const result = await runPreflight(targetPath || process.cwd(), taskParts.join(" "));
  console.log(JSON.stringify(result, null, 2));
}
