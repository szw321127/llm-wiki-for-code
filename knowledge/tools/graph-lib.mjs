import fs from "node:fs/promises";
import path from "node:path";

const ENTITY_DIRECTORIES = [
  "practices",
  "options",
  "contexts",
  "constraints",
  "rules",
  "projects"
];

const RELATION_SPECS = {
  practice: [
    { field: "contexts", type: "applies_to" },
    { field: "constraints", type: "limited_by" },
    { field: "rules", type: "governed_by" }
  ],
  option: [
    { field: "alternatives", type: "alternative_to" },
    { field: "constraints", type: "blocked_by" }
  ],
  project_profile: [
    { field: "adopted_rules", type: "adopts_rule" }
  ]
};

export function computeFinalScore(baseScore, projectAdjustment = 0) {
  return Number(baseScore || 0) + Number(projectAdjustment || 0);
}

export function parseFrontmatterBlock(source) {
  const normalized = source.replace(/\r\n/g, "\n");
  if (!normalized.startsWith("---\n")) {
    return { data: {}, body: normalized.trim() };
  }

  const endMarker = normalized.indexOf("\n---\n", 4);
  if (endMarker === -1) {
    throw new Error("Frontmatter 未正常闭合");
  }

  const frontmatter = normalized.slice(4, endMarker);
  const body = normalized.slice(endMarker + 5).trim();
  return {
    data: parseYamlSubset(frontmatter),
    body
  };
}

export async function parseMarkdownDocument(filePath, knowledgeDir) {
  const source = await fs.readFile(filePath, "utf8");
  const { data, body } = parseFrontmatterBlock(source);
  if (!data.id || !data.type || !data.title) {
    throw new Error(`文档缺少必填字段: ${filePath}`);
  }

  const relativePath = path.relative(knowledgeDir, filePath).replace(/\\/g, "/");
  return {
    ...data,
    body,
    summary: extractSummary(body),
    source_path: relativePath
  };
}

export async function buildGraphFromDirectory(knowledgeDir) {
  const documents = await loadDocuments(knowledgeDir);
  const nodes = documents.map((document) => normalizeNode(document));
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const projects = nodes.filter((node) => node.type === "project_profile");
  const optionsByPractice = new Map();

  for (const optionNode of nodes.filter((node) => node.type === "option")) {
    const optionIds = optionsByPractice.get(optionNode.practice) || [];
    optionIds.push(optionNode.id);
    optionsByPractice.set(optionNode.practice, optionIds);
  }

  for (const optionNode of nodes.filter((node) => node.type === "option")) {
    optionNode.project_adjustments = { global: 0 };
    optionNode.final_scores = { global: optionNode.base_score };

    for (const projectNode of projects) {
      const adjustment = Number(projectNode.preferred_options?.[optionNode.id] || 0);
      optionNode.project_adjustments[projectNode.id] = adjustment;
      optionNode.final_scores[projectNode.id] = computeFinalScore(
        optionNode.base_score,
        adjustment
      );
    }
  }

  for (const practiceNode of nodes.filter((node) => node.type === "practice")) {
    const relatedOptionIds = optionsByPractice.get(practiceNode.id) || [];
    practiceNode.option_ids = relatedOptionIds;
    practiceNode.ranked_option_ids = {
      global: rankOptionIds(relatedOptionIds, nodeMap, "global")
    };
    practiceNode.recommended_options = {
      global: pickRecommendedOption(relatedOptionIds, nodeMap, "global")
    };

    for (const projectNode of projects) {
      practiceNode.ranked_option_ids[projectNode.id] = rankOptionIds(
        relatedOptionIds,
        nodeMap,
        projectNode.id
      );
      practiceNode.recommended_options[projectNode.id] = pickRecommendedOption(
        relatedOptionIds,
        nodeMap,
        projectNode.id
      );
    }
  }

  const edges = buildEdges(nodes, nodeMap);
  attachNeighborIds(nodes, edges);
  return {
    generated_at: new Date().toISOString(),
    knowledge_root: ".",
    project_views: [
      { id: "global", title: "全局视角", synthetic: true },
      ...projects.map((projectNode) => ({
        id: projectNode.id,
        title: projectNode.title,
        synthetic: false
      }))
    ],
    stats: {
      total_nodes: nodes.length,
      total_edges: edges.length,
      counts_by_type: countByType(nodes)
    },
    nodes,
    edges
  };
}

export function createGraphIndex(graph) {
  const byType = {};
  const practiceOptions = {};
  const searchTerms = {};

  for (const node of graph.nodes) {
    byType[node.type] = byType[node.type] || [];
    byType[node.type].push(node.id);

    if (node.type === "practice") {
      practiceOptions[node.id] = node.option_ids || [];
    }

    for (const term of buildSearchTerms(node)) {
      searchTerms[term] = searchTerms[term] || [];
      searchTerms[term].push(node.id);
    }
  }

  for (const value of Object.values(byType)) {
    value.sort();
  }

  return {
    generated_at: graph.generated_at,
    project_views: graph.project_views,
    counts_by_type: graph.stats.counts_by_type,
    by_type: byType,
    practice_options: practiceOptions,
    search_terms: searchTerms
  };
}

export async function writeGraphFiles(knowledgeDir, graph) {
  const graphDir = path.join(knowledgeDir, "graph");
  const index = createGraphIndex(graph);

  await fs.mkdir(graphDir, { recursive: true });
  await fs.writeFile(
    path.join(graphDir, "graph-data.json"),
    `${JSON.stringify(graph, null, 2)}\n`,
    "utf8"
  );
  await fs.writeFile(
    path.join(graphDir, "graph-index.json"),
    `${JSON.stringify(index, null, 2)}\n`,
    "utf8"
  );

  return index;
}

async function loadDocuments(knowledgeDir) {
  const documents = [];

  for (const directory of ENTITY_DIRECTORIES) {
    const absoluteDirectory = path.join(knowledgeDir, directory);
    const entries = await safeReadDirectory(absoluteDirectory);

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".md")) {
        continue;
      }
      documents.push(await parseMarkdownDocument(path.join(absoluteDirectory, entry.name), knowledgeDir));
    }
  }

  return documents.sort((left, right) => left.id.localeCompare(right.id));
}

async function safeReadDirectory(directoryPath) {
  try {
    return await fs.readdir(directoryPath, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

function normalizeNode(document) {
  return {
    id: document.id,
    label: document.title || document.id,
    type: document.type,
    title: document.title,
    summary: document.summary,
    body: document.body,
    source_path: document.source_path,
    status: document.status || "active",
    keywords: asArray(document.keywords),
    tech: asArray(document.tech),
    contexts: asArray(document.contexts),
    constraints: asArray(document.constraints),
    rules: asArray(document.rules),
    alternatives: asArray(document.alternatives),
    practice: document.practice || null,
    base_score: Number(document.base_score || 0),
    score_breakdown: document.score_breakdown || {},
    recommended: Boolean(document.recommended),
    node_group: classifyNodeGroup(document),
    neighbor_ids: [],
    adopted_rules: asArray(document.adopted_rules),
    preferred_options: document.preferred_options || {}
  };
}

function buildEdges(nodes, nodeMap) {
  const edges = [];

  for (const node of nodes) {
    if (node.type === "option" && node.practice && nodeMap.has(node.practice)) {
      edges.push(makeEdge("has_option", node.practice, node.id));
    }

    for (const relationSpec of RELATION_SPECS[node.type] || []) {
      for (const targetId of asArray(node[relationSpec.field])) {
        if (nodeMap.has(targetId)) {
          edges.push(makeEdge(relationSpec.type, node.id, targetId));
        }
      }
    }

    if (node.type === "project_profile") {
      for (const targetId of Object.keys(node.preferred_options || {})) {
        if (nodeMap.has(targetId)) {
          edges.push(makeEdge("prefers_option", node.id, targetId));
        }
      }
    }
  }

  return deduplicateEdges(edges);
}

function makeEdge(type, from, to) {
  return {
    id: `${type}:${from}->${to}`,
    type,
    from,
    to
  };
}

function deduplicateEdges(edges) {
  const seen = new Set();
  return edges.filter((edge) => {
    if (seen.has(edge.id)) {
      return false;
    }
    seen.add(edge.id);
    return true;
  });
}

function pickRecommendedOption(optionIds, nodeMap, viewId) {
  const sortedOptions = rankOptionNodes(optionIds, nodeMap, viewId);

  return sortedOptions[0]?.id || null;
}

function rankOptionIds(optionIds, nodeMap, viewId) {
  return rankOptionNodes(optionIds, nodeMap, viewId).map((optionNode) => optionNode.id);
}

function rankOptionNodes(optionIds, nodeMap, viewId) {
  return optionIds
    .map((optionId) => nodeMap.get(optionId))
    .filter(Boolean)
    .sort((left, right) => compareOptions(left, right, viewId));
}

function compareOptions(left, right, viewId) {
  const leftScore = resolveOptionScore(left, viewId);
  const rightScore = resolveOptionScore(right, viewId);

  if (rightScore !== leftScore) {
    return rightScore - leftScore;
  }

  if (left.recommended !== right.recommended) {
    return Number(right.recommended) - Number(left.recommended);
  }

  return left.title.localeCompare(right.title, "zh-Hans-CN");
}

function resolveOptionScore(optionNode, viewId) {
  if (viewId === "global") {
    return optionNode.base_score;
  }
  return optionNode.final_scores?.[viewId] ?? optionNode.base_score;
}

function extractSummary(body) {
  const summarySection = extractSection(body, "Summary");
  if (summarySection) {
    return normalizeWhitespace(summarySection);
  }

  for (const line of body.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("- ")) {
      continue;
    }
    return trimmed;
  }

  return "";
}

function extractSection(body, headingName) {
  const lines = body.split("\n");
  const headingPattern = new RegExp(`^##\\s+${escapeRegExp(headingName)}\\s*$`, "i");
  const sectionLines = [];
  let capturing = false;

  for (const line of lines) {
    if (capturing && /^##\s+/.test(line)) {
      break;
    }
    if (capturing) {
      sectionLines.push(line);
    }
    if (!capturing && headingPattern.test(line.trim())) {
      capturing = true;
    }
  }

  return sectionLines.join("\n").trim();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeWhitespace(value) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ");
}

function countByType(nodes) {
  const counts = {};
  for (const node of nodes) {
    counts[node.type] = (counts[node.type] || 0) + 1;
  }
  return counts;
}

function attachNeighborIds(nodes, edges) {
  const neighborMap = new Map(nodes.map((node) => [node.id, new Set()]));

  for (const edge of edges) {
    if (!neighborMap.has(edge.from) || !neighborMap.has(edge.to)) {
      continue;
    }
    neighborMap.get(edge.from).add(edge.to);
    neighborMap.get(edge.to).add(edge.from);
  }

  for (const node of nodes) {
    node.neighbor_ids = Array.from(neighborMap.get(node.id) || []).sort();
  }
}

function classifyNodeGroup(document) {
  if (document.type === "practice") {
    return "practice";
  }
  if (document.type === "option") {
    return document.recommended ? "option-recommended" : "option-secondary";
  }
  return document.type;
}

function buildSearchTerms(node) {
  return new Set(
    [node.id, node.title, node.summary, ...asArray(node.keywords), ...asArray(node.tech)]
      .flatMap((value) => tokenize(String(value || "")))
      .filter(Boolean)
  );
}

function tokenize(value) {
  return value
    .toLowerCase()
    .split(/[^a-z0-9\u4e00-\u9fff-]+/u)
    .filter(Boolean);
}

function asArray(value) {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function parseYamlSubset(source) {
  const lines = source.split("\n");
  const { value } = parseBlock(lines, 0, 0, "object");
  return value;
}

function parseBlock(lines, startIndex, indentLevel, containerType) {
  const result = containerType === "array" ? [] : {};
  let index = startIndex;

  while (index < lines.length) {
    const rawLine = lines[index];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    const currentIndent = countIndent(rawLine);
    if (currentIndent < indentLevel) {
      break;
    }
    if (currentIndent > indentLevel) {
      throw new Error(`YAML 缩进无效: ${rawLine}`);
    }

    if (containerType === "array") {
      if (!trimmed.startsWith("- ")) {
        break;
      }

      const itemSource = trimmed.slice(2).trim();
      if (!itemSource) {
        const nested = parseNestedValue(lines, index + 1, indentLevel);
        result.push(nested.value);
        index = nested.nextIndex;
        continue;
      }

      result.push(parseScalar(itemSource));
      index += 1;
      continue;
    }

    if (trimmed.startsWith("- ")) {
      throw new Error(`对象块中出现非法数组项: ${rawLine}`);
    }

    const separatorIndex = trimmed.indexOf(":");
    if (separatorIndex === -1) {
      throw new Error(`无法解析 frontmatter 行: ${rawLine}`);
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();

    if (!rawValue) {
      const nested = parseNestedValue(lines, index + 1, indentLevel);
      result[key] = nested.value;
      index = nested.nextIndex;
      continue;
    }

    result[key] = parseScalar(rawValue);
    index += 1;
  }

  return { value: result, nextIndex: index };
}

function parseNestedValue(lines, startIndex, parentIndent) {
  let index = startIndex;
  while (index < lines.length && !lines[index].trim()) {
    index += 1;
  }

  if (index >= lines.length) {
    return { value: {}, nextIndex: index };
  }

  const nextIndent = countIndent(lines[index]);
  if (nextIndent <= parentIndent) {
    return { value: {}, nextIndex: index };
  }

  const containerType = lines[index].trim().startsWith("- ") ? "array" : "object";
  return parseBlock(lines, index, nextIndent, containerType);
}

function parseScalar(rawValue) {
  if (rawValue === "true") {
    return true;
  }
  if (rawValue === "false") {
    return false;
  }
  if (rawValue === "null") {
    return null;
  }
  if (rawValue === "{}") {
    return {};
  }
  if (rawValue === "[]") {
    return [];
  }
  if (/^-?\d+(\.\d+)?$/.test(rawValue)) {
    return Number(rawValue);
  }
  if (
    (rawValue.startsWith("'") && rawValue.endsWith("'")) ||
    (rawValue.startsWith("\"") && rawValue.endsWith("\""))
  ) {
    return rawValue.slice(1, -1);
  }
  if (rawValue.startsWith("[") && rawValue.endsWith("]")) {
    return parseInlineArray(rawValue);
  }
  return rawValue;
}

function parseInlineArray(rawValue) {
  const content = rawValue.slice(1, -1).trim();
  if (!content) {
    return [];
  }
  return content.split(",").map((item) => parseScalar(item.trim()));
}

function countIndent(line) {
  const match = line.match(/^ */);
  return match ? match[0].length : 0;
}
