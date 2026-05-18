#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildProjectGraphArtifacts } from "./build-project-graph-data.mjs";
import { inspectEvidencePaths, loadEvidencePolicy } from "./evidence-paths.mjs";
import { buildProjectGraphFromDirectory, parseFrontmatterBlock } from "./knowledge-lib.mjs";
import { lintProjectKnowledge } from "./lint-project-knowledge.mjs";
import { createLogEvent, refreshObsidianVault } from "./obsidian-lib.mjs";

const currentFilePath = fileURLToPath(import.meta.url);

export async function governProjectKnowledge(projectRootOrKnowledgeRoot = process.cwd(), options = {}) {
  const knowledgeRoot = await resolveKnowledgeRoot(projectRootOrKnowledgeRoot);
  const report = await lintProjectKnowledge(knowledgeRoot);
  const graph = await buildProjectGraphFromDirectory(knowledgeRoot);
  const nodeMap = new Map(graph.nodes.map((node) => [node.id, node]));
  const dryRun = options.dryRun !== false;
  const actions = [];
  const duplicateNodeIds = new Set();

  for (const issue of report.issues.filter((item) => item.code === "possible-duplicate-node")) {
    duplicateNodeIds.add(issue.node_id);
    duplicateNodeIds.add(issue.duplicate_node_id);
    if (!isStrongDuplicateIssue(issue)) {
      continue;
    }

    const action = dryRun
      ? planRejectDuplicateNode(nodeMap, issue)
      : await rejectDuplicateNode(knowledgeRoot, nodeMap, issue);
    if (action) {
      actions.push(action);
    }
  }

  for (const issue of report.issues.filter((item) => item.code === "incubating-promotion-candidate")) {
    if (duplicateNodeIds.has(issue.node_id)) {
      continue;
    }

    const node = nodeMap.get(issue.node_id);
    if (!node || node.review_status === "rejected") {
      continue;
    }

    actions.push(dryRun ? planPromoteNode(node) : await promoteNode(knowledgeRoot, node));
  }

  for (const issue of report.issues.filter((item) => item.code === "recommendation-pool-eviction-candidate")) {
    for (const nodeId of issue.evicted_option_ids || []) {
      const node = nodeMap.get(nodeId);
      if (!node || node.review_status === "rejected") {
        continue;
      }

      actions.push(dryRun
        ? planRejectKnowledgeNode(node, {
          reason: `evicted-from-${issue.node_id}-${issue.view_id}`,
          actionType: node.maturity === "stable" ? "demote" : "reject"
        })
        : await rejectKnowledgeNode(knowledgeRoot, {
          nodeId,
          reason: `evicted-from-${issue.node_id}-${issue.view_id}`,
          actionType: node.maturity === "stable" ? "demote" : "reject"
        }));
    }
  }

  const uniqueActions = dedupeActions(actions);
  let graphArtifacts = null;
  if (!dryRun && uniqueActions.length > 0 && options.rebuildGraph !== false) {
    graphArtifacts = await buildProjectGraphArtifacts(knowledgeRoot);
    await refreshObsidianVault(knowledgeRoot, {
      graph: graphArtifacts.graph,
      event: createLogEvent("pk:govern", "自动执行知识治理", {
        actions: uniqueActions.map((action) => `${action.type}:${action.node_id}`)
      })
    });
  }

  if (dryRun) {
    return {
      mode: uniqueActions.length > 0 ? "dry-run" : "no-op",
      knowledgeRoot,
      planned_action_count: uniqueActions.length,
      planned_actions: uniqueActions,
      action_count: 0,
      actions: [],
      graph_rebuilt: false
    };
  }

  return {
    mode: uniqueActions.length > 0 ? "governed" : "no-op",
    knowledgeRoot,
    action_count: uniqueActions.length,
    actions: uniqueActions,
    graph_rebuilt: Boolean(graphArtifacts)
  };
}

export async function rejectKnowledgeNode(projectRootOrKnowledgeRoot, input = {}) {
  const knowledgeRoot = await resolveKnowledgeRoot(projectRootOrKnowledgeRoot);
  const nodeId = validateNodeId(input.nodeId);
  const graph = await buildProjectGraphFromDirectory(knowledgeRoot);
  const node = graph.nodes.find((item) => item.id === nodeId);
  if (!node) {
    throw new Error(`未找到知识节点: ${nodeId}`);
  }

  const actionType = input.actionType || (node.maturity === "stable" ? "demote" : "reject");
  const targetMaturity = "incubating";
  const action = await moveNodeToMaturity(knowledgeRoot, node, targetMaturity, {
    review_status: "rejected",
    rejected_reason: input.reason || "manual-reject",
    rejected_at: new Date().toISOString(),
    duplicate_of: input.duplicateOf || node.duplicate_of || null
  });

  if (input.rebuildGraph !== false) {
    const graphArtifacts = await buildProjectGraphArtifacts(knowledgeRoot);
    await refreshObsidianVault(knowledgeRoot, {
      graph: graphArtifacts.graph,
      event: createLogEvent("pk:govern:reject", `打回知识节点 ${nodeId}`, {
        reason: input.reason || "manual-reject",
        duplicate_of: input.duplicateOf || ""
      })
    });
  }

  return {
    ...action,
    type: actionType,
    node_id: nodeId,
    reason: input.reason || "manual-reject"
  };
}

export async function verifyKnowledgeNode(projectRootOrKnowledgeRoot, input = {}) {
  const knowledgeRoot = await resolveKnowledgeRoot(projectRootOrKnowledgeRoot);
  const nodeId = validateNodeId(input.nodeId);
  const verifiedAt = normalizeDateInput(input.verifiedAt || new Date());
  const reason = input.reason || "manual-verify";
  if (input.allowMissingEvidence !== true) {
    await assertNodeEvidenceExists(knowledgeRoot, nodeId);
  }
  const { node } = await updateKnowledgeNode(knowledgeRoot, nodeId, {
    last_verified_at: verifiedAt,
    verified_reason: reason,
    verified_at: new Date().toISOString()
  });

  if (input.rebuildGraph !== false) {
    const graphArtifacts = await buildProjectGraphArtifacts(knowledgeRoot);
    await refreshObsidianVault(knowledgeRoot, {
      graph: graphArtifacts.graph,
      event: createLogEvent("pk:govern:verify", `验证知识节点 ${nodeId}`, {
        reason,
        last_verified_at: verifiedAt
      })
    });
  }

  return {
    type: "verify",
    node_id: nodeId,
    path: node.source_path,
    last_verified_at: verifiedAt,
    reason
  };
}

async function assertNodeEvidenceExists(knowledgeRoot, nodeId) {
  const graph = await buildProjectGraphFromDirectory(knowledgeRoot);
  const node = graph.nodes.find((item) => item.id === nodeId);
  if (!node) {
    throw new Error(`未找到知识节点: ${nodeId}`);
  }

  const evidencePolicy = await loadEvidencePolicy(knowledgeRoot);
  const inspection = await inspectEvidencePaths(path.dirname(knowledgeRoot), node.source_evidence || [], evidencePolicy);
  if (inspection.missingSourceEvidence.length > 0) {
    throw new Error(`缺失证据路径: ${inspection.missingSourceEvidence.join(", ")}`);
  }
}

export async function archiveKnowledgeNode(projectRootOrKnowledgeRoot, input = {}) {
  const knowledgeRoot = await resolveKnowledgeRoot(projectRootOrKnowledgeRoot);
  const nodeId = validateNodeId(input.nodeId);
  const reason = input.reason || "manual-archive";
  const graph = await buildProjectGraphFromDirectory(knowledgeRoot);
  const node = graph.nodes.find((item) => item.id === nodeId);
  if (!node) {
    throw new Error(`未找到知识节点: ${nodeId}`);
  }

  const action = await moveNodeToMaturity(knowledgeRoot, node, "incubating", {
    status: "archived",
    archive_reason: reason,
    archived_at: new Date().toISOString()
  });

  if (input.rebuildGraph !== false) {
    const graphArtifacts = await buildProjectGraphArtifacts(knowledgeRoot);
    await refreshObsidianVault(knowledgeRoot, {
      graph: graphArtifacts.graph,
      event: createLogEvent("pk:govern:archive", `归档知识节点 ${nodeId}`, {
        reason
      })
    });
  }

  return {
    ...action,
    type: "archive",
    node_id: nodeId,
    reason
  };
}

export async function linkDuplicateKnowledgeNode(projectRootOrKnowledgeRoot, input = {}) {
  const duplicateOf = validateNodeId(input.duplicateOf);
  const action = await rejectKnowledgeNode(projectRootOrKnowledgeRoot, {
    nodeId: input.nodeId,
    reason: input.reason || `duplicate-of-${duplicateOf}`,
    duplicateOf,
    actionType: "link-duplicate",
    rebuildGraph: false
  });
  const knowledgeRoot = await resolveKnowledgeRoot(projectRootOrKnowledgeRoot);

  if (input.rebuildGraph !== false) {
    const graphArtifacts = await buildProjectGraphArtifacts(knowledgeRoot);
    await refreshObsidianVault(knowledgeRoot, {
      graph: graphArtifacts.graph,
      event: createLogEvent("pk:govern:link-duplicate", `标记重复知识节点 ${action.node_id}`, {
        reason: action.reason,
        duplicate_of: duplicateOf
      })
    });
  }

  return {
    ...action,
    type: "link-duplicate",
    duplicate_of: duplicateOf
  };
}

function planPromoteNode(node) {
  return {
    type: "promote",
    node_id: node.id,
    from: node.source_path,
    to: resolveRelativeNodePath({ ...node, maturity: "stable" }),
    reason: "adopted-threshold-met"
  };
}

function planRejectKnowledgeNode(node, input = {}) {
  const actionType = input.actionType || (node.maturity === "stable" ? "demote" : "reject");
  return {
    type: actionType,
    node_id: node.id,
    from: node.source_path,
    to: resolveRelativeNodePath({ ...node, maturity: "incubating" }),
    reason: input.reason || "manual-reject"
  };
}

function planRejectDuplicateNode(nodeMap, issue) {
  const left = nodeMap.get(issue.node_id);
  const right = nodeMap.get(issue.duplicate_node_id);
  if (!left || !right) {
    return null;
  }

  const [winner, loser] = pickDuplicateWinner(left, right);
  if (loser.review_status === "rejected") {
    return null;
  }

  return {
    ...planRejectKnowledgeNode(loser, {
      reason: `duplicate-of-${winner.id}`,
      actionType: "reject-duplicate"
    }),
    type: "reject-duplicate",
    duplicate_of: winner.id
  };
}

function resolveRelativeNodePath(node) {
  const directory = node.maturity === "incubating" ? `incubating/${node.type}s` : `${node.type}s`;
  return `${directory}/${node.id}.md`;
}
async function promoteNode(knowledgeRoot, node) {
  const action = await moveNodeToMaturity(knowledgeRoot, node, "stable", {
    maturity: "stable",
    review_status: "approved",
    rejected_reason: null,
    rejected_at: null,
    duplicate_of: null
  });

  return {
    ...action,
    type: "promote",
    node_id: node.id,
    reason: "adopted-threshold-met"
  };
}

async function rejectDuplicateNode(knowledgeRoot, nodeMap, issue) {
  const left = nodeMap.get(issue.node_id);
  const right = nodeMap.get(issue.duplicate_node_id);
  if (!left || !right) {
    return null;
  }

  const [winner, loser] = pickDuplicateWinner(left, right);
  if (loser.review_status === "rejected") {
    return null;
  }

  const action = await rejectKnowledgeNode(knowledgeRoot, {
    nodeId: loser.id,
    reason: `duplicate-of-${winner.id}`,
    duplicateOf: winner.id,
    actionType: "reject-duplicate",
    rebuildGraph: false
  });

  return {
    ...action,
    type: "reject-duplicate",
    node_id: loser.id,
    duplicate_of: winner.id
  };
}

function pickDuplicateWinner(left, right) {
  const leftScore = scoreDuplicateCandidate(left);
  const rightScore = scoreDuplicateCandidate(right);
  if (rightScore !== leftScore) {
    return rightScore > leftScore ? [right, left] : [left, right];
  }
  return left.id.localeCompare(right.id) <= 0 ? [left, right] : [right, left];
}

function scoreDuplicateCandidate(node) {
  return (
    Number(node.usage_stats?.adopted_count || 0) * 100 +
    Number(node.source_evidence?.length || 0) * 10 +
    Number(node.base_score || 0) +
    (node.maturity === "stable" ? 5 : 0)
  );
}

function isStrongDuplicateIssue(issue) {
  return ["same-title", "same-summary"].includes(issue.duplicate_reason);
}

async function moveNodeToMaturity(knowledgeRoot, node, maturity, updates = {}) {
  const sourcePath = path.join(knowledgeRoot, node.source_path);
  const targetPath = resolveNodePath(knowledgeRoot, {
    ...node,
    maturity
  });
  const source = await fs.readFile(sourcePath, "utf8");
  const { data, body } = parseFrontmatterBlock(source);
  const nextData = cleanupFrontmatter({
    ...data,
    ...updates,
    maturity
  });
  const nextSource = renderMarkdownDocument(nextData, body);

  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, nextSource, "utf8");
  if (path.resolve(sourcePath) !== path.resolve(targetPath)) {
    await fs.unlink(sourcePath);
  }

  return {
    type: maturity === "stable" ? "promote" : "demote",
    node_id: node.id,
    from: path.relative(knowledgeRoot, sourcePath).replace(/\\/g, "/"),
    to: path.relative(knowledgeRoot, targetPath).replace(/\\/g, "/")
  };
}

async function updateKnowledgeNode(knowledgeRoot, nodeId, updates = {}) {
  const graph = await buildProjectGraphFromDirectory(knowledgeRoot);
  const node = graph.nodes.find((item) => item.id === nodeId);
  if (!node) {
    throw new Error(`未找到知识节点: ${nodeId}`);
  }

  const nodePath = path.join(knowledgeRoot, node.source_path);
  const source = await fs.readFile(nodePath, "utf8");
  const { data, body } = parseFrontmatterBlock(source);
  const nextData = cleanupFrontmatter({
    ...data,
    ...updates
  });

  await fs.writeFile(nodePath, renderMarkdownDocument(nextData, body), "utf8");

  return {
    node,
    path: path.relative(knowledgeRoot, nodePath).replace(/\\/g, "/")
  };
}

function cleanupFrontmatter(data) {
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined && value !== null)
  );
}

function resolveNodePath(knowledgeRoot, node) {
  const directory =
    node.maturity === "incubating"
      ? path.join(knowledgeRoot, "incubating", `${node.type}s`)
      : path.join(knowledgeRoot, `${node.type}s`);
  return path.join(directory, `${node.id}.md`);
}

function renderMarkdownDocument(frontmatter, body) {
  return `---\n${serializeYamlObject(frontmatter).join("\n")}\n---\n\n${String(body || "").trim()}\n`;
}

function serializeYamlObject(value, indentLevel = 0) {
  return Object.entries(value).flatMap(([key, nestedValue]) =>
    serializeYamlEntry(key, nestedValue, indentLevel)
  );
}

function serializeYamlEntry(key, value, indentLevel) {
  const indent = " ".repeat(indentLevel);
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return [`${indent}${key}: []`];
    }
    return [`${indent}${key}:`, ...value.map((item) => `${indent}  - ${serializeScalar(item)}`)];
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value);
    if (entries.length === 0) {
      return [`${indent}${key}: {}`];
    }
    return [
      `${indent}${key}:`,
      ...entries.flatMap(([childKey, childValue]) =>
        serializeYamlEntry(childKey, childValue, indentLevel + 2)
      )
    ];
  }
  return [`${indent}${key}: ${serializeScalar(value)}`];
}

function serializeScalar(value) {
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value === "") {
    return '""';
  }
  return String(value);
}

function dedupeActions(actions) {
  const seen = new Set();
  return actions.filter((action) => {
    const key = `${action.type}:${action.node_id}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

async function resolveKnowledgeRoot(projectRootOrKnowledgeRoot) {
  const resolved = path.resolve(projectRootOrKnowledgeRoot || process.cwd());
  if (await exists(path.join(resolved, "project-profile.md"))) {
    return resolved;
  }

  const projectKnowledgeRoot = path.join(resolved, ".project-knowledge");
  if (await exists(path.join(projectKnowledgeRoot, "project-profile.md"))) {
    return projectKnowledgeRoot;
  }

  throw new Error(`未找到 .project-knowledge: ${resolved}`);
}

function validateNodeId(nodeId) {
  const value = String(nodeId || "").trim();
  if (!/^[a-zA-Z0-9\u4e00-\u9fff][a-zA-Z0-9\u4e00-\u9fff_.-]*$/.test(value)) {
    throw new Error(`非法 nodeId: ${nodeId}`);
  }
  return value;
}

function normalizeDateInput(value) {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  const rawValue = String(value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(rawValue)) {
    return rawValue;
  }
  const date = new Date(rawValue);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`非法验证日期: ${value}`);
  }
  return date.toISOString().slice(0, 10);
}

function parseGovernCliArgs(args) {
  const filteredArgs = [];
  let dryRun = true;

  for (const arg of args) {
    if (arg === "--apply") {
      dryRun = false;
      continue;
    }
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    filteredArgs.push(arg);
  }

  return {
    projectRoot: filteredArgs[0] || process.cwd(),
    options: { dryRun }
  };
}
async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === currentFilePath) {
  const { projectRoot, options } = parseGovernCliArgs(process.argv.slice(2));
  const result = await governProjectKnowledge(projectRoot, options);
  console.log(JSON.stringify(result, null, 2));
}





