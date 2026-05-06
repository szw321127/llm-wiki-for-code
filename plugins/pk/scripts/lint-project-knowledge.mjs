#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { collectVolatileEvidencePaths } from "./evidence-paths.mjs";
import { buildProjectGraphFromDirectory, LIFECYCLE_POLICY } from "./knowledge-lib.mjs";

export async function lintProjectKnowledge(projectRootOrKnowledgeRoot = process.cwd()) {
  const knowledgeRoot = await resolveKnowledgeRoot(projectRootOrKnowledgeRoot);
  const graph = await buildProjectGraphFromDirectory(knowledgeRoot);
  const nodeMap = new Map(graph.nodes.map((node) => [node.id, node]));
  const recommendationPools = collectRecommendationPools(graph);
  const issues = [
    ...findMissingEvidenceIssues(graph.nodes),
    ...findVolatileEvidenceIssues(graph.nodes),
    ...findMissingPracticeIssues(graph.nodes, nodeMap),
    ...findEmptyRecommendationPoolIssues(graph.nodes),
    ...findPromotionCandidateIssues(graph.nodes),
    ...findRecommendationPoolEvictionIssues(graph.nodes),
    ...findPossibleDuplicateNodeIssues(graph.nodes)
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
    issues
  };
}

async function resolveKnowledgeRoot(projectRootOrKnowledgeRoot) {
  const resolved = path.resolve(projectRootOrKnowledgeRoot || process.cwd());

  if (await exists(path.join(resolved, "project-profile.md"))) {
    return resolved;
  }

  const knowledgeRoot = path.join(resolved, ".project-knowledge");
  if (await exists(path.join(knowledgeRoot, "project-profile.md"))) {
    return knowledgeRoot;
  }

  throw new Error(`未找到 .project-knowledge: ${resolved}`);
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

function findVolatileEvidenceIssues(nodes) {
  return nodes
    .map((node) => ({
      node,
      volatileSourceEvidence: collectVolatileEvidencePaths(node.source_evidence || [])
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
