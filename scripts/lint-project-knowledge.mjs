#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  collectVolatileEvidencePaths,
  inspectEvidencePaths,
  listProjectEvidenceFiles,
  loadEvidencePolicy
} from "./evidence-paths.mjs";
import { buildProjectGraphFromDirectory, LIFECYCLE_POLICY } from "./knowledge-lib.mjs";
import { resolveKnowledgeRoot } from "./paths.mjs";

export async function lintProjectKnowledge(projectRootOrKnowledgeRoot = process.cwd(), options = {}) {
  const knowledgeRoot = await resolveKnowledgeRoot(projectRootOrKnowledgeRoot);
  const projectRoot = path.dirname(knowledgeRoot);
  const evidencePolicy = await loadEvidencePolicy(knowledgeRoot);
  const projectFiles = await listProjectEvidenceFiles(projectRoot, evidencePolicy);
  const graph = await buildProjectGraphFromDirectory(knowledgeRoot);
  const nodeMap = new Map(graph.nodes.map((node) => [node.id, node]));
  const recommendationPools = collectRecommendationPools(graph);
  const issues = [
    ...findMissingEvidenceIssues(graph.nodes),
    ...findVolatileEvidenceIssues(graph.nodes, evidencePolicy),
    ...await findMissingEvidencePathIssues(graph.nodes, projectRoot, evidencePolicy, projectFiles),
    ...findMissingPracticeIssues(graph.nodes, nodeMap),
    ...findEmptyRecommendationPoolIssues(graph.nodes),
    ...findPromotionCandidateIssues(graph.nodes),
    ...findRecommendationPoolEvictionIssues(graph.nodes),
    ...findPossibleDuplicateNodeIssues(graph.nodes),
    ...findWikiQualityIssues(graph.nodes),
    ...findStalenessIssues(graph.nodes, options),
    ...findUsefulnessIssues(graph.nodes, options),
    ...findConflictIssues(graph.nodes, graph, nodeMap)
  ];

  return {
    generated_at: new Date().toISOString(),
    knowledgeRoot,
    summary: {
      total_nodes: graph.stats.total_nodes,
      total_edges: graph.stats.total_edges,
      issue_count: issues.length,
      recommendation_pool_count: recommendationPools.length
    },
    recommendationPools,
    wikiQuality: summarizeIssuesByPrefix(issues, "wiki-", [
      "wiki-stale-node",
      "wiki-stale-evidence",
      "wiki-high-rank-stale-recommendation",
      "wiki-missing-owner-for-strong-rule",
      "wiki-missing-verification-date",
      "wiki-invalid-verification-date"
    ]),
    staleness: summarizeIssuesByCodes(issues, [
      "wiki-stale-node",
      "wiki-stale-evidence",
      "wiki-high-rank-stale-recommendation",
      "wiki-missing-owner-for-strong-rule",
      "wiki-missing-verification-date",
      "wiki-invalid-verification-date"
    ]),
    usefulness: summarizeIssuesByCodes(issues, [
      "wiki-never-hit",
      "wiki-hit-but-never-adopted",
      "wiki-frequently-rejected-after-hit"
    ]),
    issues
  };
}

function collectRecommendationPools(graph) {
  const pools = [];

  for (const practice of graph.nodes.filter((node) => node.type === "practice")) {
    for (const [viewId, optionIds] of Object.entries(practice.recommendation_pools || {})) {
      pools.push({
        practice_id: practice.id,
        practice_title: practice.title,
        view_id: viewId,
        option_ids: optionIds,
        recommended_option_id: practice.recommended_options?.[viewId] || null
      });
    }
  }

  return pools.sort(
    (left, right) =>
      left.practice_id.localeCompare(right.practice_id) ||
      left.view_id.localeCompare(right.view_id)
  );
}

function findMissingEvidenceIssues(nodes) {
  return nodes
    .filter((node) => node.type !== "project_profile")
    .filter((node) => (node.source_evidence || []).length === 0)
    .map((node) => ({
      code: "node-missing-evidence",
      severity: "warning",
      node_id: node.id,
      node_type: node.type,
      message: "节点缺少 source_evidence，后续应补充代码或文档证据。"
    }));
}

function findVolatileEvidenceIssues(nodes, evidencePolicy) {
  return nodes
    .map((node) => ({
      node,
      volatileSourceEvidence: collectVolatileEvidencePaths(node.source_evidence || [], evidencePolicy)
    }))
    .filter(({ volatileSourceEvidence }) => volatileSourceEvidence.length > 0)
    .map(({ node, volatileSourceEvidence }) => ({
      code: "node-volatile-evidence",
      severity: "warning",
      node_id: node.id,
      node_type: node.type,
      volatile_source_evidence: volatileSourceEvidence,
      message: "节点包含临时或本地开发证据路径，应替换为长期存在的源码或文档相对路径。"
    }));
}

async function findMissingEvidencePathIssues(nodes, projectRoot, evidencePolicy, projectFiles) {
  const issues = [];

  for (const node of nodes.filter((candidate) => candidate.type !== "project_profile")) {
    const inspection = await inspectEvidencePaths(projectRoot, node.source_evidence || [], evidencePolicy, {
      projectFiles
    });
    if (inspection.missingSourceEvidence.length === 0) {
      continue;
    }

    issues.push({
      code: "node-missing-evidence-path",
      severity: "warning",
      node_id: node.id,
      node_type: node.type,
      missing_source_evidence: inspection.missingSourceEvidence,
      repair_candidates: inspection.repairCandidates,
      message: "节点包含不存在的 source_evidence 路径，可能是文件移动、重命名或证据已过期。"
    });
  }

  return issues;
}

function findMissingPracticeIssues(nodes, nodeMap) {
  return nodes
    .filter((node) => node.type === "option")
    .filter((node) => !node.practice || !nodeMap.has(node.practice))
    .map((node) => ({
      code: "option-missing-practice",
      severity: "error",
      node_id: node.id,
      node_type: node.type,
      practice_id: node.practice || null,
      message: "方案没有关联到有效 practice，无法进入推荐池。"
    }));
}

function findEmptyRecommendationPoolIssues(nodes) {
  return nodes
    .filter((node) => node.type === "practice")
    .filter((node) =>
      Object.values(node.recommendation_pools || {}).every((optionIds) => optionIds.length === 0)
    )
    .map((node) => ({
      code: "practice-empty-recommendation-pool",
      severity: "warning",
      node_id: node.id,
      node_type: node.type,
      message: "实践没有可推荐方案，应补充 option 或重新归档该实践。"
    }));
}

function findPromotionCandidateIssues(nodes) {
  return nodes
    .filter((node) => node.maturity === "incubating")
    .filter((node) => node.lifecycle_state === "promotion_candidate")
    .map((node) => ({
      code: "incubating-promotion-candidate",
      severity: "info",
      node_id: node.id,
      node_type: node.type,
      adopted_count: Number(node.usage_stats?.adopted_count || 0),
      promotion_adopted_threshold: LIFECYCLE_POLICY.promotionAdoptedThreshold,
      lifecycle_reasons: node.lifecycle_reasons || [],
      message: "孵化节点已达到采纳阈值，可评估是否转入稳定推荐池。"
    }));
}

function findRecommendationPoolEvictionIssues(nodes) {
  const issues = [];

  for (const practice of nodes.filter((node) => node.type === "practice")) {
    for (const [viewId, optionIds] of Object.entries(practice.evicted_option_ids || {})) {
      if (optionIds.length === 0) {
        continue;
      }

      issues.push({
        code: "recommendation-pool-eviction-candidate",
        severity: "info",
        node_id: practice.id,
        node_type: practice.type,
        view_id: viewId,
        evicted_option_ids: optionIds,
        recommendation_pool_limit: LIFECYCLE_POLICY.recommendationPoolLimit,
        message: "该实践的候选方案超过推荐池上限，排位靠后的方案应回到孵化区或删除。"
      });
    }
  }

  return issues.sort(
    (left, right) =>
      left.node_id.localeCompare(right.node_id) || left.view_id.localeCompare(right.view_id)
  );
}

function findPossibleDuplicateNodeIssues(nodes) {
  const comparableNodes = nodes
    .filter((node) => node.type !== "project_profile")
    .filter((node) => node.review_status !== "rejected")
    .slice()
    .sort((left, right) => left.id.localeCompare(right.id));
  const issues = [];

  for (let leftIndex = 0; leftIndex < comparableNodes.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < comparableNodes.length; rightIndex += 1) {
      const left = comparableNodes[leftIndex];
      const right = comparableNodes[rightIndex];
      if (left.type !== right.type) {
        continue;
      }

      const duplicateReason = resolveDuplicateReason(left, right);
      if (!duplicateReason) {
        continue;
      }

      issues.push({
        code: "possible-duplicate-node",
        severity: "warning",
        node_id: left.id,
        duplicate_node_id: right.id,
        node_type: left.type,
        duplicate_reason: duplicateReason,
        message: "发现疑似重复知识节点，应人工判断是否合并或保留差异。"
      });
    }
  }

  return issues;
}


function findWikiQualityIssues(nodes) {
  const issues = [];
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));

  for (const node of nodes.filter((candidate) => candidate.type !== "project_profile")) {
    const sourcePath = String(node.source_path || "");
    const body = String(node.body || "").trim();
    const isRejected = node.review_status === "rejected";

    if (!isSafeNodeId(node.id)) {
      issues.push(buildWikiIssue("wiki-bad-id", "error", node, "知识节点 id 含有空格或非法字符，应使用稳定的 slug。"));
    }

    if (isWrongDirectory(node)) {
      issues.push(buildWikiIssue("wiki-wrong-directory", "error", node, "知识节点类型与所在目录不一致。"));
    }

    if (isBadTitle(node.title)) {
      issues.push(buildWikiIssue("wiki-bad-title", "warning", node, "知识节点 title 为空或只包含空白字符。"));
    }

    if (node.maturity === "stable" && ["practice", "option", "rule"].includes(node.type) && !node.has_explicit_summary) {
      issues.push(buildWikiIssue("wiki-missing-summary", "warning", node, "稳定 practice、option、rule 需要 summary 以便检索和审查。"));
    }

    if (["practice", "option", "rule"].includes(node.type) && !hasMarkdownSection(body, "Summary")) {
      issues.push(buildWikiIssue("wiki-missing-required-section", "warning", node, "知识页缺少 Summary 章节。"));
    }

    if (!isRejected && body.length > 0 && body.length < 40) {
      issues.push(buildWikiIssue("wiki-thin-page", "warning", node, "知识页内容过薄，后续应补充背景、决策或证据说明。"));
    }

    if (body.length > 12000) {
      issues.push(buildWikiIssue("wiki-oversized-page", "info", node, "知识页过长，建议拆分为更小的 practice、option 或 context。"));
    }

    if (!isRejected && node.type !== "context" && node.type !== "constraint" && hasNoGraphOrEvidence(node)) {
      issues.push(buildWikiIssue("wiki-orphan-node", "warning", node, "知识节点没有图谱连接、session_refs 或 source_evidence，可能不会被后续任务复用。"));
    }

    if (!isRejected && ["practice", "option", "rule"].includes(node.type) && hasNoPreflightSurface(node)) {
      issues.push(buildWikiIssue("wiki-no-preflight-surface", "warning", node, "知识节点缺少 keywords、title 或 summary 等可检索表面，pk-preflight 难以命中。"));
    }

    if (!isRejected && node.maturity === "stable" && node.type === "option" && (node.session_refs || []).length === 0) {
      issues.push(buildWikiIssue("wiki-missing-session-ref", "info", node, "稳定 option 缺少 session_refs，难以追溯采纳或创建来源。"));
    }

    if (!isRejected && node.maturity === "stable" && node.type === "option" && !hasDecisionReason(body)) {
      issues.push(buildWikiIssue("wiki-missing-decision-reason", "info", node, "稳定 option 缺少 Decision/Rationale 说明，难以判断为什么采用。"));
    }

    if (!isRejected && node.maturity === "stable") {
      for (const evidenceRecord of node.evidence_records || []) {
        if (!String(evidenceRecord.reason || "").trim()) {
          issues.push({
            ...buildWikiIssue("wiki-evidence-record-missing-reason", "warning", node, "稳定节点的结构化 evidence record 缺少 reason。"),
            evidence_path: evidenceRecord.path || null
          });
        }
      }
    }

    for (const linkedId of collectWikiLinks(body)) {
      if (!nodeMap.has(linkedId)) {
        issues.push({
          ...buildWikiIssue("wiki-broken-node-link", "warning", node, "知识页包含不存在的 wiki 链接。"),
          linked_node_id: linkedId
        });
      }
    }
  }

  return issues;
}

function findStalenessIssues(nodes, options = {}) {
  const issues = [];
  const now = normalizeNow(options.now);
  const recommendedOptionIds = new Set(
    nodes
      .filter((node) => node.type === "practice")
      .flatMap((node) => Object.values(node.recommendation_pools || {}).flat())
  );

  for (const node of nodes.filter((candidate) => candidate.type !== "project_profile")) {
    if (node.review_status === "rejected" || node.maturity !== "stable") {
      continue;
    }

    const lastVerifiedAt = String(node.last_verified_at || "").trim();
    const staleAfterDays = Number(node.stale_after_days || 0);

    if (node.type === "rule" && node.priority === "strong" && !String(node.owner || "").trim()) {
      issues.push(buildWikiIssue("wiki-missing-owner-for-strong-rule", "warning", node, "strong rule 需要 owner，避免长期无人维护。"));
    }

    if (node.type === "rule" && !lastVerifiedAt) {
      issues.push(buildWikiIssue("wiki-missing-verification-date", "info", node, "稳定 rule 缺少 last_verified_at，后续无法判断是否过期。"));
      continue;
    }

    if (!lastVerifiedAt || staleAfterDays <= 0) {
      continue;
    }

    const verifiedDate = parseDate(lastVerifiedAt);
    if (!verifiedDate) {
      issues.push(buildWikiIssue("wiki-invalid-verification-date", "warning", node, "last_verified_at 不是有效日期。"));
      continue;
    }

    const ageDays = Math.floor((now.getTime() - verifiedDate.getTime()) / 86400000);
    if (ageDays > staleAfterDays) {
      issues.push({
        ...buildWikiIssue("wiki-stale-node", "warning", node, "知识节点超过 stale_after_days 未验证。"),
        last_verified_at: lastVerifiedAt,
        stale_after_days: staleAfterDays,
        age_days: ageDays
      });

      if (node.source_evidence?.length > 0) {
        issues.push({
          ...buildWikiIssue("wiki-stale-evidence", "warning", node, "节点证据超过验证周期，建议重新核对源码或文档。"),
          last_verified_at: lastVerifiedAt,
          stale_after_days: staleAfterDays,
          age_days: ageDays
        });
      }

      if (node.type === "option" && recommendedOptionIds.has(node.id)) {
        issues.push({
          ...buildWikiIssue("wiki-high-rank-stale-recommendation", "warning", node, "高排名推荐方案已经过期，继续推荐前应重新验证。"),
          last_verified_at: lastVerifiedAt,
          stale_after_days: staleAfterDays,
          age_days: ageDays
        });
      }
    }
  }

  return issues;
}

function findUsefulnessIssues(nodes, options = {}) {
  const issues = [];
  const hitButNeverAdoptedThreshold = Number(options.hitButNeverAdoptedThreshold || 3);
  const frequentRejectedHitThreshold = Number(options.frequentRejectedHitThreshold || 3);
  const frequentRejectedCountThreshold = Number(options.frequentRejectedCountThreshold || 2);

  for (const node of nodes.filter(isUsefulnessLintTarget)) {
    const usageStats = node.usage_stats || {};
    const preflightHits = Number(usageStats.preflight_hits || 0);
    const adoptedCount = Number(usageStats.adopted_count || 0);
    const rejectedAfterHitCount = Number(usageStats.rejected_after_hit_count || 0);

    if (node.maturity === "stable" && preflightHits === 0) {
      issues.push({
        ...buildWikiIssue("wiki-never-hit", "info", node, "稳定知识节点从未被 pk-preflight 命中，可能缺少检索表面或不再有用。"),
        preflight_hits: preflightHits,
        adopted_count: adoptedCount,
        rejected_after_hit_count: rejectedAfterHitCount
      });
      continue;
    }

    if (preflightHits >= hitButNeverAdoptedThreshold && adoptedCount === 0) {
      issues.push({
        ...buildWikiIssue("wiki-hit-but-never-adopted", "info", node, "知识节点多次被命中但从未被采纳，应检查推荐表述、适用范围或排序。"),
        preflight_hits: preflightHits,
        adopted_count: adoptedCount,
        rejected_after_hit_count: rejectedAfterHitCount
      });
    }

    if (
      preflightHits >= frequentRejectedHitThreshold &&
      rejectedAfterHitCount >= frequentRejectedCountThreshold &&
      rejectedAfterHitCount / preflightHits >= 0.5
    ) {
      issues.push({
        ...buildWikiIssue("wiki-frequently-rejected-after-hit", "warning", node, "知识节点经常在命中后被拒绝，应降权、收窄适用条件或归档。"),
        preflight_hits: preflightHits,
        adopted_count: adoptedCount,
        rejected_after_hit_count: rejectedAfterHitCount
      });
    }
  }

  return issues;
}

function findConflictIssues(nodes, graph, nodeMap) {
  return [
    ...findActiveConflictingRuleIssues(nodes, nodeMap),
    ...findSupersededRecommendationIssues(nodes, graph),
    ...findDuplicatePracticeScopeIssues(nodes)
  ];
}

function findActiveConflictingRuleIssues(nodes, nodeMap) {
  const issues = [];
  const seenPairs = new Set();

  for (const node of nodes.filter((candidate) => candidate.type === "rule" && isActiveKnowledgeNode(candidate))) {
    for (const conflictingNodeId of asArray(node.conflicts_with)) {
      const conflictingNode = nodeMap.get(conflictingNodeId);
      if (!conflictingNode || conflictingNode.type !== "rule" || !isActiveKnowledgeNode(conflictingNode)) {
        continue;
      }

      const pairKey = [node.id, conflictingNode.id].sort().join("::");
      if (seenPairs.has(pairKey)) {
        continue;
      }
      seenPairs.add(pairKey);

      issues.push({
        ...buildWikiIssue("wiki-active-conflicting-rules", "warning", node, "两条 active stable rule 声明互相冲突，应人工确认保留、收窄或 supersede。"),
        conflicting_node_id: conflictingNode.id
      });
    }
  }

  return issues;
}

function findSupersededRecommendationIssues(nodes, graph) {
  const issues = [];
  const recommendationSourcesByNodeId = collectRecommendationSources(graph);

  for (const node of nodes.filter((candidate) => candidate.superseded_by && candidate.review_status !== "rejected")) {
    const recommendationSources = recommendationSourcesByNodeId.get(node.id) || [];
    if (recommendationSources.length === 0) {
      continue;
    }

    issues.push({
      ...buildWikiIssue("wiki-superseded-node-still-recommended", "warning", node, "已被 superseded 的节点仍残留在推荐或偏好配置中，应移出推荐面。"),
      superseded_by: node.superseded_by,
      recommendation_sources: recommendationSources
    });
  }

  return issues;
}

function collectRecommendationSources(graph) {
  const sources = new Map();

  for (const practice of graph.nodes.filter((node) => node.type === "practice")) {
    for (const optionId of asArray(practice.option_ids)) {
      appendMapValue(sources, optionId, `practice-option:${practice.id}`);
    }
    for (const [viewId, optionIds] of Object.entries(practice.recommendation_pools || {})) {
      for (const optionId of optionIds) {
        appendMapValue(sources, optionId, `recommendation-pool:${practice.id}:${viewId}`);
      }
    }
  }

  for (const projectProfile of graph.nodes.filter((node) => node.type === "project_profile")) {
    for (const optionId of Object.keys(projectProfile.preferred_options || {})) {
      appendMapValue(sources, optionId, `project-preferred:${projectProfile.id}`);
    }
  }

  return sources;
}

function findDuplicatePracticeScopeIssues(nodes) {
  const practicesByScope = new Map();
  const issues = [];

  for (const practice of nodes.filter((node) => node.type === "practice" && isActiveKnowledgeNode(node))) {
    const scopeKey = normalizeComparableText(practice.scope);
    if (!scopeKey) {
      continue;
    }
    const scopedPractices = practicesByScope.get(scopeKey) || [];
    scopedPractices.push(practice);
    practicesByScope.set(scopeKey, scopedPractices);
  }

  for (const scopedPractices of practicesByScope.values()) {
    const sortedPractices = scopedPractices.slice().sort((left, right) => left.id.localeCompare(right.id));
    for (let index = 1; index < sortedPractices.length; index += 1) {
      issues.push({
        ...buildWikiIssue("wiki-duplicate-practice-scope", "warning", sortedPractices[0], "多个 active stable practice 声明了同一 scope，应合并、拆分或标记 supersedes。"),
        duplicate_node_id: sortedPractices[index].id,
        scope: sortedPractices[index].scope
      });
    }
  }

  return issues;
}

function isActiveKnowledgeNode(node) {
  return (
    node.review_status !== "rejected" &&
    node.status !== "archived" &&
    !node.superseded_by &&
    node.maturity === "stable"
  );
}

function appendMapValue(map, key, value) {
  if (!key || !value) {
    return;
  }
  const values = map.get(key) || [];
  values.push(value);
  map.set(key, values);
}

function isUsefulnessLintTarget(node) {
  return (
    node.type !== "project_profile" &&
    ["practice", "option", "rule"].includes(node.type) &&
    node.review_status !== "rejected" &&
    node.status !== "archived"
  );
}

function summarizeIssuesByPrefix(issues, prefix, excludedCodes = []) {
  const excluded = new Set(excludedCodes);
  const matched = issues.filter((issue) => issue.code.startsWith(prefix) && !excluded.has(issue.code));
  return summarizeIssueSet(matched);
}

function summarizeIssuesByCodes(issues, codes) {
  const codeSet = new Set(codes);
  return summarizeIssueSet(issues.filter((issue) => codeSet.has(issue.code)));
}

function summarizeIssueSet(issues) {
  const byCode = {};
  for (const issue of issues) {
    byCode[issue.code] = (byCode[issue.code] || 0) + 1;
  }
  return {
    issue_count: issues.length,
    by_code: byCode
  };
}

function buildWikiIssue(code, severity, node, message) {
  return {
    code,
    severity,
    node_id: node.id,
    node_type: node.type,
    message
  };
}

function isSafeNodeId(nodeId) {
  return /^[a-zA-Z0-9\u4e00-\u9fff][a-zA-Z0-9\u4e00-\u9fff_.-]*$/.test(String(nodeId || ""));
}

function isWrongDirectory(node) {
  const sourcePath = String(node.source_path || "");
  const expectedStablePrefix = `${node.type}s/`;
  const expectedIncubatingPrefix = `incubating/${node.type}s/`;
  return node.maturity === "incubating"
    ? !sourcePath.startsWith(expectedIncubatingPrefix)
    : !sourcePath.startsWith(expectedStablePrefix);
}

function isBadTitle(title) {
  return typeof title !== "string" || title.trim().length === 0;
}

function hasMarkdownSection(body, heading) {
  return new RegExp(`^#{1,6}\\s+${escapeRegExp(heading)}\\s*$`, "im").test(body);
}

function hasDecisionReason(body) {
  return ["Decision", "Rationale", "Reason", "Why"].some((heading) =>
    hasMarkdownSection(body, heading)
  );
}

function hasNoGraphOrEvidence(node) {
  return (
    (node.neighbor_ids || []).length === 0 &&
    (node.session_refs || []).length === 0 &&
    (node.source_evidence || []).length === 0
  );
}

function hasNoPreflightSurface(node) {
  return (node.keywords || []).length === 0;
}

function collectWikiLinks(body) {
  return Array.from(String(body || "").matchAll(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g))
    .map((match) => match[1].trim())
    .filter(Boolean);
}

function normalizeNow(value) {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function parseDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function resolveDuplicateReason(left, right) {
  const leftTitle = normalizeComparableText(left.title);
  const rightTitle = normalizeComparableText(right.title);
  if (leftTitle && leftTitle === rightTitle) {
    return "same-title";
  }

  const leftSummary = normalizeComparableText(left.summary);
  const rightSummary = normalizeComparableText(right.summary);
  if (leftSummary && leftSummary === rightSummary) {
    return "same-summary";
  }

  const leftKeywords = toComparableSet(left.keywords);
  const rightKeywords = toComparableSet(right.keywords);
  if (
    leftKeywords.size > 0 &&
    rightKeywords.size > 0 &&
    jaccardSimilarity(leftKeywords, rightKeywords) >= 0.8
  ) {
    return "high-keyword-overlap";
  }

  return null;
}

function normalizeComparableText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[\p{P}\p{S}]/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    .join(" ")
    .trim();
}

function toComparableSet(values) {
  return new Set(
    asArray(values)
      .flatMap((value) => normalizeComparableText(value).split(/\s+/))
      .filter(Boolean)
  );
}

function jaccardSimilarity(leftSet, rightSet) {
  const intersectionSize = Array.from(leftSet).filter((value) => rightSet.has(value)).length;
  const unionSize = new Set([...leftSet, ...rightSet]).size;
  return unionSize === 0 ? 0 : intersectionSize / unionSize;
}

function asArray(value) {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
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
  const report = await lintProjectKnowledge(process.argv[2] || process.cwd());
  console.log(JSON.stringify(report, null, 2));
}


