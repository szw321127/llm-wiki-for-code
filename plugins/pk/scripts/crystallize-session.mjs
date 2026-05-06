#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildProjectGraphArtifacts } from "./build-project-graph-data.mjs";
import { normalizeEvidencePaths } from "./evidence-paths.mjs";
import { parseFrontmatterBlock } from "./knowledge-lib.mjs";
import {
  buildObsidianLinkSection,
  createLogEvent,
  refreshObsidianVault
} from "./obsidian-lib.mjs";

export async function crystallizeSession(projectRootOrKnowledgeRoot, input = {}) {
  const knowledgeRoot = await resolveKnowledgeRoot(projectRootOrKnowledgeRoot);
  const writeSession = input.writeSession !== false;
  const incubatingNodes = input.incubatingNodes || [];
  const stableUpdates = input.stableUpdates || [];
  const adoptedNodeIds = input.adoptedNodeIds || [];

  if (!writeSession && incubatingNodes.length === 0 && stableUpdates.length === 0 && adoptedNodeIds.length === 0) {
    return { mode: "no-op", knowledgeRoot };
  }

  const sessionId = input.sessionId || buildSessionId(input.topic || "session");
  let mode = "session-only";

  if (incubatingNodes.length > 0) {
    mode = "session+incubating";
  } else if (stableUpdates.length > 0 || adoptedNodeIds.length > 0) {
    mode = "session+stable-update";
  }

  if (writeSession) {
    await writeSessionDocument(knowledgeRoot, sessionId, input);
  }

  if (incubatingNodes.length > 0) {
    for (const node of incubatingNodes) {
      await writeKnowledgeNode(knowledgeRoot, {
        ...node,
        maturity: "incubating",
        status: node.status || "active",
        session_refs: dedupeValues([...(node.session_refs || []), sessionId])
      });
    }
  }

  if (stableUpdates.length > 0) {
    for (const update of stableUpdates) {
      await applyStableUpdate(knowledgeRoot, update, sessionId);
    }
  }

  let graphArtifacts = null;
  if (adoptedNodeIds.length > 0 || incubatingNodes.length > 0 || stableUpdates.length > 0) {
    await updateUsageIndex(knowledgeRoot, {
      sessionId,
      adoptedNodeIds,
      mentionedNodeIds: dedupeValues([
        ...incubatingNodes.map((node) => node.id),
        ...stableUpdates.map((node) => node.id),
        ...adoptedNodeIds
      ])
    });
    graphArtifacts = await buildProjectGraphArtifacts(knowledgeRoot);
  }

  await updateRuntimeState(knowledgeRoot, sessionId, mode);
  await refreshObsidianVault(knowledgeRoot, {
    graph: graphArtifacts?.graph,
    event: createLogEvent("pk:crystallize", `结晶会话 ${sessionId}`, {
      mode,
      adopted: adoptedNodeIds,
      incubating: incubatingNodes.map((node) => node.id),
      updated: stableUpdates.map((node) => node.id)
    })
  });

  return {
    mode,
    knowledgeRoot,
    sessionId,
    incubatingNodeIds: incubatingNodes.map((node) => node.id),
    updatedNodeIds: stableUpdates.map((node) => node.id),
    adoptedNodeIds
  };
}

export async function loadCrystallizeCliInput(projectRootOrKnowledgeRoot, cliArgs = [], defaults = {}) {
  const args = [...cliArgs].filter((arg) => arg !== undefined && arg !== null);
  const defaultInput = {
    topic: "manual-crystallize",
    title: "手动结晶",
    decisionSummary: "手动执行了一次项目知识结晶。",
    ...defaults
  };

  if (args.length === 0) {
    return defaultInput;
  }

  if (args[0] === "--input" || args[0] === "-i") {
    if (!args[1]) {
      throw new Error("缺少结晶输入 JSON 文件路径");
    }
    return {
      ...defaultInput,
      ...(await readCrystallizeInputFile(projectRootOrKnowledgeRoot, args[1]))
    };
  }

  const inputPath = await resolveExistingInputFile(projectRootOrKnowledgeRoot, args[0]);
  if (inputPath) {
    return {
      ...defaultInput,
      ...(await readJson(inputPath, {}))
    };
  }

  return {
    ...defaultInput,
    topic: args.join(" ")
  };
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

async function readCrystallizeInputFile(projectRootOrKnowledgeRoot, inputFilePath) {
  const resolvedInputPath = await resolveExistingInputFile(projectRootOrKnowledgeRoot, inputFilePath);
  if (!resolvedInputPath) {
    throw new Error(`未找到结晶输入 JSON: ${inputFilePath}`);
  }

  const input = await readJson(resolvedInputPath, {});
  if (!input || Array.isArray(input) || typeof input !== "object") {
    throw new Error(`结晶输入 JSON 必须是对象: ${resolvedInputPath}`);
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

function buildSessionId(topic) {
  const date = new Date().toISOString().slice(0, 10);
  const slug = String(topic || "session")
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff-]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  return `session-${date}-${slug || "session"}`;
}

async function writeSessionDocument(knowledgeRoot, sessionId, input) {
  const touchedFiles = normalizeEvidencePaths(input.touchedFiles || []);
  const sessionPath = path.join(knowledgeRoot, "sessions", `${sessionId}.md`);
  const frontmatter = {
    id: sessionId,
    type: "session",
    title: input.title || sessionId,
    date: extractDateFromSessionId(sessionId),
    topic: input.topic || "session",
    decision_summary: input.decisionSummary || "本轮未形成新的稳定知识。",
    touched_files: touchedFiles,
    derived_nodes: dedupeValues([
      ...(input.incubatingNodes || []).map((node) => node.id),
      ...(input.stableUpdates || []).map((node) => node.id)
    ]),
    adopted_nodes: dedupeValues(input.adoptedNodeIds || []),
    status: "recorded"
  };
  const body = {
    Goal: [input.goal || input.title || input.topic || "记录本轮任务"],
    Changes: [input.decisionSummary || "本轮未形成新的稳定知识。"],
    Crystallization: [buildCrystallizationLine(input)]
  };

  await fs.mkdir(path.dirname(sessionPath), { recursive: true });
  await fs.writeFile(sessionPath, renderMarkdownDocument(frontmatter, body), "utf8");
}

function buildCrystallizationLine(input) {
  if ((input.incubatingNodes || []).length > 0) {
    return `新增孵化知识：${input.incubatingNodes.map((node) => node.id).join(", ")}`;
  }
  if ((input.stableUpdates || []).length > 0) {
    return `更新稳定知识：${input.stableUpdates.map((node) => node.id).join(", ")}`;
  }
  return "本轮仅记录 session，没有新增知识节点。";
}

async function writeKnowledgeNode(knowledgeRoot, node) {
  const normalizedNode = {
    ...node,
    source_evidence: normalizeEvidencePaths(node.source_evidence || [])
  };
  const nodePath = resolveNodePath(knowledgeRoot, normalizedNode);
  const body = buildNodeBody(normalizedNode);
  await fs.mkdir(path.dirname(nodePath), { recursive: true });
  await fs.writeFile(nodePath, renderMarkdownDocument(normalizedNode, body), "utf8");
}

async function applyStableUpdate(knowledgeRoot, update, sessionId) {
  const nodePath = await findExistingNodePath(knowledgeRoot, update.id, update.type);
  const source = await fs.readFile(nodePath, "utf8");
  const { data, body } = parseFrontmatterBlock(source);
  const sections = parseMarkdownSections(body);
  const frontmatter = {
    ...data,
    ...update,
    id: data.id,
    type: data.type,
    title: update.title || data.title,
    summary: update.summary || data.summary || "",
    session_refs: dedupeValues([...(data.session_refs || []), ...(update.session_refs || []), sessionId]),
    source_evidence: normalizeEvidencePaths([...(data.source_evidence || []), ...(update.source_evidence || [])])
  };

  if (update.summary) {
    sections.Summary = [update.summary];
  }

  await fs.writeFile(nodePath, renderMarkdownDocument(frontmatter, sections), "utf8");
}

async function updateUsageIndex(knowledgeRoot, { sessionId, adoptedNodeIds, mentionedNodeIds }) {
  const usagePath = path.join(knowledgeRoot, "state", "usage-index.json");
  const rawUsage = await readJson(usagePath, {});
  const usageIndex = rawUsage.entries || rawUsage;

  for (const nodeId of dedupeValues(mentionedNodeIds)) {
    usageIndex[nodeId] = usageIndex[nodeId] || {
      session_mentions: 0,
      adopted_count: 0,
      last_used_at: extractDateFromSessionId(sessionId),
      last_session_id: sessionId
    };
    usageIndex[nodeId].session_mentions += 1;
    usageIndex[nodeId].last_used_at = extractDateFromSessionId(sessionId);
    usageIndex[nodeId].last_session_id = sessionId;
  }

  for (const nodeId of dedupeValues(adoptedNodeIds)) {
    usageIndex[nodeId] = usageIndex[nodeId] || {
      session_mentions: 0,
      adopted_count: 0,
      last_used_at: extractDateFromSessionId(sessionId),
      last_session_id: sessionId
    };
    usageIndex[nodeId].adopted_count += 1;
    usageIndex[nodeId].last_used_at = extractDateFromSessionId(sessionId);
    usageIndex[nodeId].last_session_id = sessionId;
  }

  await fs.writeFile(usagePath, `${JSON.stringify(usageIndex, null, 2)}\n`, "utf8");
}

async function updateRuntimeState(knowledgeRoot, sessionId, mode) {
  const runtimePath = path.join(knowledgeRoot, "state", "runtime-state.json");
  const runtimeState = await readJson(runtimePath, {});
  runtimeState.initialized = true;
  runtimeState.last_session_id = sessionId;
  runtimeState.last_crystallized_at = new Date().toISOString();
  runtimeState.graph_dirty = mode === "session-only" || mode === "no-op" ? false : false;
  runtimeState.last_graph_build_at = runtimeState.last_graph_build_at || new Date().toISOString();
  await fs.writeFile(runtimePath, `${JSON.stringify(runtimeState, null, 2)}\n`, "utf8");
}

function extractDateFromSessionId(sessionId) {
  const match = String(sessionId).match(/(\d{4}-\d{2}-\d{2})/);
  return match?.[1] || new Date().toISOString().slice(0, 10);
}

async function findExistingNodePath(knowledgeRoot, nodeId, type) {
  const candidates = [
    path.join(knowledgeRoot, `${type}s`, `${nodeId}.md`),
    path.join(knowledgeRoot, "incubating", `${type}s`, `${nodeId}.md`)
  ];

  for (const candidate of candidates) {
    if (await exists(candidate)) {
      return candidate;
    }
  }

  throw new Error(`未找到节点文件: ${nodeId}`);
}

function resolveNodePath(knowledgeRoot, node) {
  const baseDirectory =
    node.maturity === "incubating"
      ? path.join(knowledgeRoot, "incubating", `${node.type}s`)
      : path.join(knowledgeRoot, `${node.type}s`);

  return path.join(baseDirectory, `${node.id}.md`);
}

function buildNodeBody(node) {
  const sections = {
    Summary: [node.summary]
  };

  if (node.type === "option") {
    sections.Advantages = [
      node.maturity === "incubating" ? "当前仅作为孵化候选。" : "当前可作为稳定默认方案。"
    ];
    sections.Risks = [
      node.maturity === "incubating" ? "尚未形成稳定默认做法。" : "需要在后续任务中持续验证。"
    ];
  } else {
    sections.Evidence = node.source_evidence || [];
  }

  if ((node.source_evidence || []).length > 0 && node.type === "option") {
    sections.Evidence = node.source_evidence;
  }

  const links = buildObsidianLinkSection(node);
  if (links.length > 0) {
    sections.Links = links;
  }

  return sections;
}

function parseMarkdownSections(markdown) {
  const sections = {};
  let currentTitle = "Summary";
  let buffer = [];

  for (const line of String(markdown || "").split("\n")) {
    const headingMatch = line.match(/^##\s+(.+)$/);
    if (headingMatch) {
      sections[currentTitle] = trimSectionBuffer(buffer);
      currentTitle = headingMatch[1].trim();
      buffer = [];
      continue;
    }
    buffer.push(line);
  }

  sections[currentTitle] = trimSectionBuffer(buffer);

  return Object.fromEntries(
    Object.entries(sections).filter(([, value]) => value.length > 0)
  );
}

function trimSectionBuffer(buffer) {
  return buffer.map((line) => line.trim()).filter(Boolean);
}

function renderMarkdownDocument(frontmatter, sections) {
  const normalizedFrontmatter = { ...frontmatter };
  delete normalizedFrontmatter.body;

  const lines = ["---", ...serializeYamlObject(normalizedFrontmatter), "---", ""];

  for (const [title, items] of Object.entries(sections)) {
    lines.push(`## ${title}`, "");
    for (const item of items) {
      lines.push(item);
    }
    lines.push("");
  }

  return `${lines.join("\n").trim()}\n`;
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
    const childEntries = Object.entries(value);
    if (childEntries.length === 0) {
      return [`${indent}${key}: {}`];
    }
    return [
      `${indent}${key}:`,
      ...childEntries.flatMap(([childKey, childValue]) =>
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
  if (value === null || value === undefined || value === "") {
    return '""';
  }
  return String(value);
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
  const input = await loadCrystallizeCliInput(projectRoot, process.argv.slice(3));
  const result = await crystallizeSession(projectRoot, input);
  console.log(JSON.stringify(result, null, 2));
}
