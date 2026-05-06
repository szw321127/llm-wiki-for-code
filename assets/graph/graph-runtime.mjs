export function resolveRecommendedOptionId(practiceNode, viewId) {
  return (
    practiceNode?.recommended_options?.[viewId] ??
    practiceNode?.recommended_options?.global ??
    null
  );
}

export function collectFocusNodeIds(graph, focusedNodeId) {
  const nodeMap = createNodeMap(graph?.nodes || []);
  const focusedNode = nodeMap.get(focusedNodeId);
  if (!focusedNode) {
    return new Set();
  }

  const focusIds = new Set([focusedNode.id, ...(focusedNode.neighbor_ids || [])]);
  if (focusedNode.practice) {
    focusIds.add(focusedNode.practice);
  }

  return focusIds;
}

export function collectVisibleGraphItems(graph, filters) {
  const nodeMap = createNodeMap(graph?.nodes || []);
  const orderedNodeIds = resolveCanvasNodeIds(graph, filters, nodeMap);
  const nodes = orderedNodeIds
    .map((nodeId) => nodeMap.get(nodeId))
    .filter(Boolean)
    .filter((node) => matchesQuery(node, filters?.query, nodeMap));
  const visibleNodeIds = new Set(nodes.map((node) => node.id));
  const edges = (graph?.edges || []).filter(
    (edge) => visibleNodeIds.has(edge.from) && visibleNodeIds.has(edge.to)
  );

  return { nodes, edges };
}

export function buildCanvasSnapshot(graph, filters) {
  return collectVisibleGraphItems(graph, filters);
}

function resolveCanvasNodeIds(graph, filters, nodeMap) {
  const focusedNodeId = filters?.focusedNodeId ?? null;
  if (focusedNodeId) {
    return Array.from(collectFocusNodeIds(graph, focusedNodeId))
      .filter((nodeId) => nodeMap.has(nodeId))
      .sort((leftId, rightId) => compareNodeRank(nodeMap.get(leftId), nodeMap.get(rightId)));
  }

  return collectDefaultSnapshotNodeIds(graph, filters?.viewId || "global", nodeMap);
}

function collectDefaultSnapshotNodeIds(graph, viewId, nodeMap) {
  const orderedNodeIds = [];

  for (const node of graph?.nodes || []) {
    if (node.type === "project_profile") {
      pushUnique(orderedNodeIds, node.id);
    }
  }

  for (const practiceNode of graph?.nodes || []) {
    if (practiceNode.type !== "practice") {
      continue;
    }

    pushUnique(orderedNodeIds, practiceNode.id);

    const recommendedOptionId = resolveRecommendedOptionId(practiceNode, viewId);
    if (recommendedOptionId && nodeMap.has(recommendedOptionId)) {
      pushUnique(orderedNodeIds, recommendedOptionId);
    }
  }

  return orderedNodeIds;
}

function matchesQuery(node, query, nodeMap) {
  if (!query) {
    return true;
  }

  const practiceNode = node.practice ? nodeMap.get(node.practice) : null;
  const normalizedQuery = String(query).trim().toLowerCase();
  const haystack = [
    node.id,
    node.title,
    node.summary,
    ...(node.keywords || []),
    ...(node.tech || []),
    ...(node.contexts || []),
    ...(node.constraints || []),
    ...(practiceNode ? [practiceNode.title, practiceNode.summary] : [])
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(normalizedQuery);
}

function createNodeMap(nodes) {
  return new Map(nodes.map((node) => [node.id, node]));
}

function pushUnique(items, value) {
  if (!items.includes(value)) {
    items.push(value);
  }
}

function compareNodeRank(leftNode, rightNode) {
  const leftRank = nodeTypeRank(leftNode?.type);
  const rightRank = nodeTypeRank(rightNode?.type);

  if (leftRank !== rightRank) {
    return leftRank - rightRank;
  }

  return String(leftNode?.title || leftNode?.id || "").localeCompare(
    String(rightNode?.title || rightNode?.id || ""),
    "zh-Hans-CN"
  );
}

function nodeTypeRank(type) {
  switch (type) {
    case "practice":
      return 0;
    case "option":
      return 1;
    case "context":
      return 2;
    case "constraint":
      return 3;
    case "rule":
      return 4;
    case "project_profile":
      return 5;
    default:
      return 6;
  }
}
