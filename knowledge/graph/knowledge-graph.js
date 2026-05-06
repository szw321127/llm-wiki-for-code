import {
  buildCanvasSnapshot,
  collectFocusNodeIds,
  resolveRecommendedOptionId
} from "./graph-runtime.mjs";

const state = {
  graph: null,
  viewId: "global",
  query: "",
  focusedNodeId: null,
  selectedNodeId: null,
  viewport: { x: 0, y: 0, k: 1 },
  positions: new Map(),
  drag: null,
  lastSnapshotKey: ""
};

const elements = {
  searchInput: document.querySelector("#search-input"),
  nodeCount: document.querySelector("#node-count"),
  graphSummary: document.querySelector("#graph-summary"),
  graphCanvas: document.querySelector("#graph-canvas"),
  graphViewport: document.querySelector("#graph-viewport"),
  graphEdges: document.querySelector("#graph-edges"),
  graphNodes: document.querySelector("#graph-nodes"),
  graphEmptyState: document.querySelector("#graph-empty-state"),
  detailType: document.querySelector("#detail-type"),
  detailPanel: document.querySelector("#detail-panel"),
  detailReadingPanel: document.querySelector("#detail-reading-panel")
};

initialize().catch((error) => {
  elements.graphSummary.textContent = "图谱数据加载失败。";
  elements.graphEmptyState.hidden = false;
  elements.graphEmptyState.textContent = "无法读取图谱数据，请确认已先生成 graph-data.json。";
  elements.detailPanel.innerHTML = `
    <p class="empty-state">
      无法读取 <code>graph-data.json</code>。请先运行
      <code>npm run pk:graph</code>，
      并通过本地静态服务器访问当前目录。
    </p>
    <p class="empty-state">${escapeHtml(String(error.message || error))}</p>
  `;
  elements.detailReadingPanel.innerHTML = `
    <p class="empty-state">正文与证据区域暂不可用。</p>
  `;
});

async function initialize() {
  const graph = await loadGraph();
  state.graph = graph;
  state.viewId = graph.project_views.find((view) => !view.synthetic)?.id || graph.project_views[0]?.id || "global";
  state.selectedNodeId = resolveDefaultSelectedNodeId(graph.nodes);

  bindEvents();
  render();
}

async function loadGraph() {
  const response = await fetch("./graph-data.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`graph-data.json 读取失败: ${response.status}`);
  }
  return await response.json();
}

function bindEvents() {
  elements.searchInput.addEventListener("input", (event) => {
    state.query = event.target.value.trim();
    render();
  });

  elements.detailPanel.addEventListener("click", onNodeReferenceClick);

  elements.graphCanvas.addEventListener("click", onCanvasClick);
  elements.graphCanvas.addEventListener("wheel", onCanvasWheel, { passive: false });
  elements.graphCanvas.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
}

function render() {
  const nodeMap = createNodeMap(state.graph.nodes);
  if (!state.selectedNodeId || !nodeMap.has(state.selectedNodeId)) {
    state.selectedNodeId = resolveDefaultSelectedNodeId(state.graph.nodes);
  }

  const snapshot = buildCanvasSnapshot(state.graph, {
    viewId: state.viewId,
    query: state.query,
    focusedNodeId: state.focusedNodeId
  });
  const focusIds = state.focusedNodeId
    ? collectFocusNodeIds(state.graph, state.focusedNodeId)
    : new Set();

  if (snapshot.nodes.length === 0) {
    elements.graphSummary.textContent = buildGraphSummary();
    elements.nodeCount.textContent = `0 / ${state.graph.nodes.length}`;
    elements.graphEmptyState.hidden = false;
    elements.graphEmptyState.textContent = buildEmptyStateMessage();
    clearCanvas();
    renderDetail(nodeMap.get(state.selectedNodeId) || null, nodeMap);
    return;
  }

  const scene = prepareScene(snapshot, nodeMap);

  elements.graphEmptyState.hidden = true;
  elements.nodeCount.textContent = `${scene.nodes.length} / ${state.graph.nodes.length}`;
  elements.graphSummary.textContent = buildGraphSummary();

  drawScene(scene, focusIds, state.focusedNodeId);
  renderDetail(nodeMap.get(state.selectedNodeId) || null, nodeMap);
}

function resolveDefaultSelectedNodeId(nodes) {
  return nodes.find((node) => node.type === "practice")?.id || nodes[0]?.id || null;
}

function buildGraphSummary() {
  if (state.focusedNodeId) {
    return "当前为节点邻域视图，搜索仅作用于当前子图；点击空白画布恢复默认视图。";
  }

  return "默认视图展示项目画像、实践与推荐方案；点击节点进入一阶邻域筛选。";
}

function buildEmptyStateMessage() {
  if (state.focusedNodeId) {
    return "当前聚焦子图内没有匹配节点。点击空白画布恢复默认视图。";
  }

  return "当前搜索条件下没有匹配节点。";
}

function prepareScene(snapshot, nodeMap) {
  const width = 1200;
  const height = 820;
  const sceneKey = snapshot.nodes.map((node) => node.id).join("|");
  const shouldReflow = sceneKey !== state.lastSnapshotKey;

  if (shouldReflow) {
    ensureScenePositions(snapshot.nodes, width, height, nodeMap);
    relaxScene(snapshot.nodes, snapshot.edges, width, height);
    state.lastSnapshotKey = sceneKey;
  }

  const nodes = snapshot.nodes.map((node) => ({
    ...node,
    x: state.positions.get(node.id)?.x ?? width / 2,
    y: state.positions.get(node.id)?.y ?? height / 2,
    ...getNodeGeometry(node)
  }));

  const sceneNodeMap = new Map(nodes.map((node) => [node.id, node]));
  const edges = snapshot.edges
    .map((edge) => ({
      ...edge,
      source: sceneNodeMap.get(edge.from),
      target: sceneNodeMap.get(edge.to)
    }))
    .filter((edge) => edge.source && edge.target);

  return { width, height, nodes, edges };
}

function ensureScenePositions(nodes, width, height, nodeMap) {
  const practiceNodes = nodes.filter((node) => node.type === "practice");
  const practiceIndex = new Map(practiceNodes.map((node, index) => [node.id, index]));
  const practiceCount = Math.max(practiceNodes.length, 1);
  const verticalSpacing = height / (practiceCount + 1);

  for (const node of nodes) {
    if (state.positions.has(node.id)) {
      continue;
    }

    if (node.type === "practice") {
      const index = practiceIndex.get(node.id) ?? 0;
      state.positions.set(node.id, {
        x: width * 0.32,
        y: verticalSpacing * (index + 1),
        anchorX: width * 0.32,
        anchorY: verticalSpacing * (index + 1)
      });
      continue;
    }

    if (node.type === "option") {
      const practiceNode = nodeMap.get(node.practice);
      const practicePos = state.positions.get(practiceNode?.id);
      const isRecommended = isCurrentRecommendedOption(node, nodeMap, state.viewId);
      const offsetX = isRecommended ? 294 : 220;
      const offsetY = isRecommended ? -8 : 88;
      state.positions.set(node.id, {
        x: (practicePos?.x ?? width * 0.56) + offsetX,
        y: (practicePos?.y ?? height / 2) + offsetY,
        anchorX: (practicePos?.x ?? width * 0.56) + offsetX,
        anchorY: (practicePos?.y ?? height / 2) + offsetY
      });
      continue;
    }

    if (node.type === "project_profile") {
      state.positions.set(node.id, {
        x: width * 0.18,
        y: 132,
        anchorX: width * 0.18,
        anchorY: 132
      });
      continue;
    }

    const anchorPracticeId = findAnchorPracticeId(node, nodeMap);
    const anchorPracticePos = state.positions.get(anchorPracticeId);
    const angle = ((hashString(node.id) % 360) * Math.PI) / 180;
    const radius = 182;
    state.positions.set(node.id, {
      x: (anchorPracticePos?.x ?? width * 0.5) + Math.cos(angle) * radius,
      y: (anchorPracticePos?.y ?? height * 0.5) + Math.sin(angle) * radius,
      anchorX: (anchorPracticePos?.x ?? width * 0.5) + Math.cos(angle) * radius,
      anchorY: (anchorPracticePos?.y ?? height * 0.5) + Math.sin(angle) * radius
    });
  }
}

function relaxScene(nodes, edges, width, height) {
  for (let iteration = 0; iteration < 140; iteration += 1) {
    const velocity = new Map(nodes.map((node) => [node.id, { x: 0, y: 0 }]));

    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        const left = state.positions.get(nodes[i].id);
        const right = state.positions.get(nodes[j].id);
        const dx = right.x - left.x;
        const dy = right.y - left.y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 1;
        const repel = Math.min(9200 / (distance * distance), 10);
        const nx = dx / distance;
        const ny = dy / distance;

        velocity.get(nodes[i].id).x -= nx * repel;
        velocity.get(nodes[i].id).y -= ny * repel;
        velocity.get(nodes[j].id).x += nx * repel;
        velocity.get(nodes[j].id).y += ny * repel;
      }
    }

    for (const edge of edges) {
      const source = state.positions.get(edge.from);
      const target = state.positions.get(edge.to);
      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const distance = Math.sqrt(dx * dx + dy * dy) || 1;
      const desired = edge.type === "has_option" ? 250 : 184;
      const pull = (distance - desired) * 0.015;
      const nx = dx / distance;
      const ny = dy / distance;

      velocity.get(edge.from).x += nx * pull;
      velocity.get(edge.from).y += ny * pull;
      velocity.get(edge.to).x -= nx * pull;
      velocity.get(edge.to).y -= ny * pull;
    }

    for (const node of nodes) {
      const position = state.positions.get(node.id);
      const drift = velocity.get(node.id);
      position.x += drift.x;
      position.y += drift.y;

      position.x += (position.anchorX - position.x) * 0.024;
      position.y += (position.anchorY - position.y) * 0.024;

      position.x = clamp(position.x, 90, width - 90);
      position.y = clamp(position.y, 80, height - 80);
    }
  }
}

function drawScene(scene, focusIds, activeFocusId) {
  applyViewportTransform();
  drawEdges(scene.edges, focusIds, activeFocusId);
  drawNodes(scene.nodes, focusIds, activeFocusId);
}

function clearCanvas() {
  elements.graphEdges.innerHTML = "";
  elements.graphNodes.innerHTML = "";
}

function drawEdges(edges, focusIds, activeFocusId) {
  elements.graphEdges.innerHTML = edges
    .map((edge) => {
      const isFocusEdge =
        Boolean(activeFocusId) &&
        focusIds.has(edge.source.id) &&
        focusIds.has(edge.target.id) &&
        (edge.source.id === activeFocusId || edge.target.id === activeFocusId);

      const classNames = [
        "graph-edge",
        edge.type === "has_option" ? "edge-primary" : "edge-secondary",
        activeFocusId && !isFocusEdge ? "is-dimmed" : "",
        isFocusEdge ? "is-neighbor" : ""
      ]
        .filter(Boolean)
        .join(" ");

      return `
        <line
          class="${classNames}"
          x1="${edge.source.x}"
          y1="${edge.source.y}"
          x2="${edge.target.x}"
          y2="${edge.target.y}"
        ></line>
      `;
    })
    .join("");
}

function drawNodes(nodes, focusIds, activeFocusId) {
  elements.graphNodes.innerHTML = nodes
    .map((node) => renderSvgNode(node, focusIds, activeFocusId))
    .join("");
}

function renderSvgNode(node, focusIds, activeFocusId) {
  const isSelected = Boolean(activeFocusId) && node.id === activeFocusId;
  const isNeighbor = Boolean(activeFocusId) && !isSelected && focusIds.has(node.id);
  const isDimmed = Boolean(activeFocusId) && !isSelected && !isNeighbor;
  const classNames = [
    "graph-node",
    resolveNodeClass(node),
    node.maturity === "incubating" ? "maturity-incubating" : "maturity-stable",
    isSelected ? "is-selected" : "",
    isNeighbor ? "is-neighbor" : "",
    isDimmed ? "is-dimmed" : ""
  ]
    .filter(Boolean)
    .join(" ");

  if (node.type === "practice" || node.type === "option") {
    return `
      <g
        class="${classNames}"
        data-node-id="${escapeAttribute(node.id)}"
        transform="translate(${node.x - node.width / 2} ${node.y - node.height / 2})"
      >
        <rect class="node-card-surface" rx="22" ry="22" width="${node.width}" height="${node.height}"></rect>
        <rect class="node-card-accent" x="16" y="14" rx="10" ry="10" width="${node.width - 32}" height="18"></rect>
        <text class="graph-node-eyebrow" x="24" y="26">${escapeHtml(TYPE_LABELS[node.type])}</text>
        <text class="graph-node-label" x="24" y="${node.type === "practice" ? 54 : 50}">
          ${escapeHtml(node.label)}
        </text>
        <text class="graph-node-meta" x="24" y="${node.height - 16}">
          ${escapeHtml(buildNodeMeta(node))}
        </text>
      </g>
    `;
  }

  if (node.type === "project_profile") {
    return `
      <g
        class="${classNames}"
        data-node-id="${escapeAttribute(node.id)}"
        transform="translate(${node.x - node.width / 2} ${node.y - node.height / 2})"
      >
        <rect class="node-badge-surface" rx="22" ry="22" width="${node.width}" height="${node.height}"></rect>
        <text class="graph-node-badge-type" x="22" y="20">${escapeHtml(TYPE_LABELS[node.type])}</text>
        <text class="graph-node-label node-badge-label" x="22" y="42">${escapeHtml(node.label)}</text>
        <text class="graph-node-meta" x="22" y="62">项目上下文入口</text>
      </g>
    `;
  }

  return `
    <g
      class="${classNames}"
      data-node-id="${escapeAttribute(node.id)}"
      transform="translate(${node.x - node.width / 2} ${node.y - node.height / 2})"
    >
      <rect class="node-badge-surface" rx="18" ry="18" width="${node.width}" height="${node.height}"></rect>
      <text class="graph-node-badge-type" text-anchor="middle" x="${node.width / 2}" y="16">
        ${escapeHtml(TYPE_LABELS[node.type])}
      </text>
      <text class="graph-node-label node-badge-label" text-anchor="middle" x="${node.width / 2}" y="34">
        ${escapeHtml(node.label)}
      </text>
    </g>
  `;
}

function onCanvasClick(event) {
  const nodeElement = event.target.closest("[data-node-id]");
  if (!nodeElement) {
    state.focusedNodeId = null;
    render();
    return;
  }
  state.focusedNodeId = nodeElement.dataset.nodeId;
  state.selectedNodeId = nodeElement.dataset.nodeId;
  render();
}

function onNodeReferenceClick(event) {
  const button = event.target.closest("[data-node-id]");
  if (!button) {
    return;
  }
  state.focusedNodeId = button.dataset.nodeId;
  state.selectedNodeId = button.dataset.nodeId;
  render();
}

function onCanvasWheel(event) {
  event.preventDefault();
  const scaleFactor = event.deltaY < 0 ? 1.1 : 0.92;
  const nextScale = clamp(state.viewport.k * scaleFactor, 0.55, 2.4);
  const point = getLocalPoint(event);

  state.viewport.x = point.x - ((point.x - state.viewport.x) / state.viewport.k) * nextScale;
  state.viewport.y = point.y - ((point.y - state.viewport.y) / state.viewport.k) * nextScale;
  state.viewport.k = nextScale;
  applyViewportTransform();
}

function onPointerDown(event) {
  const nodeElement = event.target.closest("[data-node-id]");
  const localPoint = getGraphPoint(event);

  if (nodeElement) {
    const nodeId = nodeElement.dataset.nodeId;
    state.drag = {
      mode: "node",
      nodeId,
      offsetX: localPoint.x - state.positions.get(nodeId).x,
      offsetY: localPoint.y - state.positions.get(nodeId).y
    };
    return;
  }

  state.drag = {
    mode: "pan",
    pointerX: event.clientX,
    pointerY: event.clientY,
    startX: state.viewport.x,
    startY: state.viewport.y
  };
}

function onPointerMove(event) {
  if (!state.drag) {
    return;
  }

  if (state.drag.mode === "pan") {
    state.viewport.x = state.drag.startX + (event.clientX - state.drag.pointerX);
    state.viewport.y = state.drag.startY + (event.clientY - state.drag.pointerY);
    applyViewportTransform();
    return;
  }

  const point = getGraphPoint(event);
  const position = state.positions.get(state.drag.nodeId);
  if (!position) {
    return;
  }

  position.x = point.x - state.drag.offsetX;
  position.y = point.y - state.drag.offsetY;
  position.anchorX = position.x;
  position.anchorY = position.y;
  render();
}

function onPointerUp() {
  if (!state.drag) {
    return;
  }
  state.drag = null;
}

function applyViewportTransform() {
  elements.graphViewport.setAttribute(
    "transform",
    `translate(${state.viewport.x} ${state.viewport.y}) scale(${state.viewport.k})`
  );
}

function getLocalPoint(event) {
  const rect = elements.graphCanvas.getBoundingClientRect();
  const scaleX = 1200 / rect.width;
  const scaleY = 820 / rect.height;
  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY
  };
}

function getGraphPoint(event) {
  const local = getLocalPoint(event);
  return {
    x: (local.x - state.viewport.x) / state.viewport.k,
    y: (local.y - state.viewport.y) / state.viewport.k
  };
}

function renderDetail(node, nodeMap) {
  if (!node) {
    elements.detailType.textContent = "未选择";
    elements.detailPanel.innerHTML = `<p class="empty-state">点击图谱节点查看详情。</p>`;
    elements.detailReadingPanel.innerHTML = `<p class="empty-state">点击图谱节点查看正文与证据。</p>`;
    return;
  }

  elements.detailType.textContent = TYPE_LABELS[node.type];
  elements.detailPanel.innerHTML = `
    ${renderDetailHeaderBlock(node, nodeMap)}
    ${renderDetailFactsBlock(node, nodeMap)}
    ${renderDetailRelationsBlock(node, nodeMap)}
  `;
  elements.detailReadingPanel.innerHTML = `
    ${renderDetailBodyBlock(node)}
    ${renderDetailEvidenceBlock(node)}
  `;
}

function renderDetailHeaderBlock(node, nodeMap) {
  return `
    <section class="detail-block detail-header-block">
      <div class="detail-header-top">
        <div class="detail-chip-row">
          <span class="chip type-${node.type}">${TYPE_LABELS[node.type]}</span>
          <span class="chip ${node.maturity === "incubating" ? "maturity-incubating" : "chip-quiet"}">${node.maturity === "incubating" ? "孵化中" : "稳定"}</span>
          ${node.status ? `<span class="chip chip-quiet">${escapeHtml(node.status)}</span>` : ""}
        </div>
        <div class="detail-stat-stack">
          ${renderDetailHeaderHighlights(node, nodeMap)}
        </div>
      </div>
      <div class="detail-header-copy">
        <h3 class="detail-header-title">${escapeHtml(node.title)}</h3>
        <p class="detail-header-summary">${escapeHtml(node.summary || "暂无摘要")}</p>
      </div>
    </section>
  `;
}

function renderDetailFactsBlock(node, nodeMap) {
  return `
    <section class="detail-block detail-facts-block">
      <h3 class="detail-block-title">关键信息</h3>
      ${renderDetailFactsContent(node, nodeMap)}
    </section>
  `;
}

function renderDetailFactsContent(node, nodeMap) {
  if (node.type === "practice") {
    const relatedOptions = resolveRankedOptions(node, nodeMap);
    const recommendedId = resolveRecommendedOptionId(node, state.viewId);
    const recommendedOption = recommendedId ? nodeMap.get(recommendedId) : null;

    return renderFactGrid([
      { label: "当前推荐", value: recommendedOption?.title || "无推荐" },
      { label: "候选方案", value: String(relatedOptions.length) },
      { label: "关联规则", value: String((node.rules || []).length) }
    ]);
  }

  if (node.type === "option") {
    const breakdown = Object.entries(node.score_breakdown || {})
      .map(
        ([key, value]) => `
          <div class="detail-metric-item">
            <strong>${escapeHtml(SCORE_LABELS[key] || key)}</strong>
            <span>${escapeHtml(String(value))}</span>
          </div>
        `
      )
      .join("");

    return `
      ${renderFactGrid([
        { label: "最终分", value: String(getOptionScore(node)) },
        { label: "基础分", value: String(node.base_score ?? 0) },
        { label: "项目加减分", value: formatSignedNumber(getOptionAdjustment(node)) },
        {
          label: "推荐状态",
          value:
            node.maturity === "incubating"
              ? "孵化中"
              : isOptionRecommended(node)
                ? "推荐"
                : "候选"
        }
      ])}
      ${breakdown ? `<div class="detail-metric-list">${breakdown}</div>` : ""}
    `;
  }

  if (node.type === "project_profile") {
    return renderFactGrid([
      { label: "技术栈", value: (node.tech || []).join(" / ") || "未标注" },
      { label: "采用规则", value: String((node.adopted_rules || []).length) },
      { label: "方案偏好", value: String(Object.keys(node.preferred_options || {}).length) },
      { label: "当前视角", value: getCurrentViewTitle() }
    ]);
  }

  const relatedPractices = findRelatedPractices(node, nodeMap);
  return renderFactGrid([
    { label: "关联实践", value: String(relatedPractices.length) },
    { label: "节点类型", value: TYPE_LABELS[node.type] },
    { label: "成熟度", value: node.maturity === "incubating" ? "孵化中" : "稳定" }
  ]);
}

function renderDetailRelationsBlock(node, nodeMap) {
  const groups = resolveDetailRelationGroups(node, nodeMap);

  return `
    <section class="detail-block detail-relations-block">
      <h3 class="detail-block-title">关联节点</h3>
      <div class="relation-group-list">
        ${groups.join("") || `<div class="relation-group"><span class="relation-group-label">无关联节点</span><div class="chip-group"><span class="chip chip-quiet">无</span></div></div>`}
      </div>
    </section>
  `;
}

function resolveDetailRelationGroups(node, nodeMap) {
  if (node.type === "practice") {
    const recommendedId = resolveRecommendedOptionId(node, state.viewId);
    const optionIds = resolveRankedOptions(node, nodeMap).map((option) => option.id);
    return [
      renderRelationGroup("当前推荐", recommendedId ? [recommendedId] : [], nodeMap),
      renderRelationGroup("候选方案", optionIds, nodeMap),
      renderRelationGroup("适用场景", node.contexts, nodeMap),
      renderRelationGroup("约束条件", node.constraints, nodeMap),
      renderRelationGroup("采用规则", node.rules, nodeMap)
    ].filter(Boolean);
  }

  if (node.type === "option") {
    return [
      renderRelationGroup("所属实践", node.practice ? [node.practice] : [], nodeMap),
      renderRelationGroup("约束条件", node.constraints, nodeMap),
      renderRelationGroup("备选方案", node.alternatives, nodeMap)
    ].filter(Boolean);
  }

  if (node.type === "project_profile") {
    return [
      renderRelationGroup("采用规则", node.adopted_rules, nodeMap),
      renderPreferredOptionRelationGroup(node, nodeMap)
    ].filter(Boolean);
  }

  return [
    renderRelationGroup(
      "关联实践",
      findRelatedPractices(node, nodeMap).map((practice) => practice.id),
      nodeMap
    )
  ].filter(Boolean);
}

function renderPreferredOptionRelationGroup(project, nodeMap) {
  const preferredOptions = Object.entries(project.preferred_options || {}).sort(
    (left, right) => right[1] - left[1]
  );

  if (preferredOptions.length === 0) {
    return "";
  }

  return `
    <div class="relation-group">
      <span class="relation-group-label">方案偏好</span>
      <div class="chip-group">
        ${preferredOptions
          .map(([optionId, adjustment]) => {
            const option = nodeMap.get(optionId);
            return `
              <button class="chip ${adjustment >= 0 ? "type-option" : "chip-quiet"} is-button" type="button" data-node-id="${escapeAttribute(optionId)}">
                ${escapeHtml(option?.title || optionId)} ${formatSignedNumber(adjustment)}
              </button>
            `;
          })
          .join("")}
      </div>
    </div>
  `;
}

function renderDetailBodyBlock(node) {
  const bodyMarkup = String(node.body || "").trim()
    ? `<div class="markdown-body">${markdownToHtml(node.body)}</div>`
    : `<p class="empty-state">暂无正文。</p>`;

  return `
    <section class="detail-block detail-body-block">
      <h3 class="detail-block-title">正文</h3>
      ${bodyMarkup}
    </section>
  `;
}

function renderDetailEvidenceBlock(node) {
  const usage = node.usage_stats || {};
  const sourceEvidence = node.source_evidence || [];
  const sessionRefs = node.session_refs || [];

  return `
    <section class="detail-block detail-evidence-block">
      <h3 class="detail-block-title">证据与来源</h3>
      ${renderFactGrid([
        { label: "成熟度", value: node.maturity === "incubating" ? "孵化中" : "稳定" },
        { label: "采用次数", value: String(usage.adopted_count || 0) },
        { label: "最近采用", value: usage.last_used_at || "无" }
      ])}
      <div class="detail-evidence-list">
        ${renderEvidenceItem(
          "source_path",
          `<div class="source-path">${escapeHtml(node.source_path || "无")}</div>`
        )}
        ${renderEvidenceItem("source_evidence", escapeHtml(sourceEvidence.join(" / ") || "无"))}
        ${renderEvidenceItem("session_refs", escapeHtml(sessionRefs.join(" / ") || "无"))}
      </div>
    </section>
  `;
}

function renderDetailHeaderHighlights(node, nodeMap) {
  if (node.type === "practice") {
    return [
      renderDetailStatPill("当前视角", getCurrentViewTitle()),
      renderDetailStatPill("推荐方案", resolveRecommendedOptionTitle(node, nodeMap))
    ].join("");
  }

  if (node.type === "option") {
    const practice = node.practice ? nodeMap.get(node.practice) : null;
    return [
      renderDetailStatPill("所属实践", practice?.title || "未绑定实践"),
      renderDetailStatPill("最终分", String(getOptionScore(node)))
    ].join("");
  }

  if (node.type === "project_profile") {
    return [
      renderDetailStatPill("采用规则", String((node.adopted_rules || []).length)),
      renderDetailStatPill("方案偏好", String(Object.keys(node.preferred_options || {}).length))
    ].join("");
  }

  return renderDetailStatPill(
    "关联实践",
    String(findRelatedPractices(node, nodeMap).length)
  );
}

function renderDetailStatPill(label, value) {
  return `
    <div class="detail-stat-pill">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

function renderFactGrid(items) {
  return `
    <div class="detail-facts-grid">
      ${items.map((item) => renderFactCard(item.label, item.value, item.detail)).join("")}
    </div>
  `;
}

function renderFactCard(label, value, detail = "") {
  return `
    <div class="detail-fact-card">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      ${detail ? `<p>${escapeHtml(detail)}</p>` : ""}
    </div>
  `;
}

function renderEvidenceItem(label, valueHtml) {
  return `
    <div class="detail-metric-item">
      <strong>${escapeHtml(label)}</strong>
      <div>${valueHtml}</div>
    </div>
  `;
}

function renderRelationGroup(title, ids, nodeMap) {
  const targets = (ids || []).map((id) => nodeMap.get(id)).filter(Boolean);
  if (targets.length === 0) {
    return "";
  }

  return `
    <div class="relation-group">
      <span class="relation-group-label">${escapeHtml(title)}</span>
      <div class="chip-group">
        ${targets
          .map(
            (target) => `
              <button class="chip type-${target.type} is-button" type="button" data-node-id="${escapeAttribute(target.id)}">
                ${escapeHtml(target.title)}
              </button>
            `
          )
          .join("")}
      </div>
    </div>
  `;
}

function resolveRankedOptions(practice, nodeMap) {
  return (
    practice.ranked_option_ids?.[state.viewId] ||
    practice.ranked_option_ids?.global ||
    practice.option_ids ||
    []
  )
    .map((id) => nodeMap.get(id))
    .filter(Boolean);
}

function markdownToHtml(markdown) {
  const lines = String(markdown || "").split("\n");
  const sections = [];
  let currentSection = null;
  let listBuffer = [];

  function flushList() {
    if (!listBuffer.length || !currentSection) {
      return;
    }
    currentSection.content.push(
      `<ul>${listBuffer.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
    );
    listBuffer = [];
  }

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushList();
      continue;
    }

    if (trimmed.startsWith("## ")) {
      flushList();
      currentSection = {
        title: trimmed.slice(3),
        content: []
      };
      sections.push(currentSection);
      continue;
    }

    if (!currentSection) {
      currentSection = { title: "Overview", content: [] };
      sections.push(currentSection);
    }

    if (trimmed.startsWith("- ")) {
      listBuffer.push(trimmed.slice(2));
      continue;
    }

    flushList();
    currentSection.content.push(`<p>${escapeHtml(trimmed)}</p>`);
  }

  flushList();

  return sections
    .map(
      (section) => `
        <section>
          <h5>${escapeHtml(section.title)}</h5>
          ${section.content.join("")}
        </section>
      `
    )
    .join("");
}

function createNodeMap(nodes) {
  return new Map(nodes.map((node) => [node.id, node]));
}

function resolveRecommendedOptionTitle(practice, nodeMap) {
  const optionId = resolveRecommendedOptionId(practice, state.viewId);
  return nodeMap.get(optionId)?.title || "无推荐";
}

function getOptionScore(option) {
  if (!option) {
    return 0;
  }
  return state.viewId === "global"
    ? option.base_score
    : option.final_scores?.[state.viewId] ?? option.base_score;
}

function getOptionAdjustment(option) {
  if (!option) {
    return 0;
  }
  return state.viewId === "global"
    ? 0
    : option.project_adjustments?.[state.viewId] ?? 0;
}

function getCurrentViewTitle() {
  return state.graph.project_views.find((view) => view.id === state.viewId)?.title || state.viewId;
}

function getNodeGeometry(node) {
  if (node.type === "practice") {
    return {
      width: 276,
      height: 96,
      radius: 0
    };
  }

  if (node.type === "option") {
    return {
      width: 248,
      height: 84,
      radius: 0
    };
  }

  if (node.type === "project_profile") {
    return {
      width: 228,
      height: 78,
      radius: 0
    };
  }

  return {
    width: clamp((node.label || node.title || "").length * 10 + 54, 118, 186),
    height: 46,
    radius: 0
  };
}

function resolveNodeClass(node) {
  if (node.type === "practice") {
    return "node-practice-card";
  }

  if (node.type === "option") {
    if (node.maturity === "incubating") {
      return "node-option-card node-option-incubating";
    }
    return isOptionRecommended(node)
      ? "node-option-card node-option-recommended"
      : "node-option-card node-option-candidate";
  }

  if (node.type === "context") {
    return "node-badge node-context-badge";
  }

  if (node.type === "constraint") {
    return "node-badge node-constraint-badge";
  }

  if (node.type === "rule") {
    return "node-badge node-rule-badge";
  }

  if (node.type === "project_profile") {
    return "node-badge node-project-badge node-project-profile";
  }

  return "node-badge node-project-badge";
}

function buildNodeMeta(node) {
  if (node.type === "practice") {
    return `${node.option_ids?.length || 0} 个候选方案 / ${node.maturity === "incubating" ? "孵化中" : "稳定"}`;
  }

  if (node.type === "option") {
    return `${node.maturity === "incubating" ? "孵化中 / " : ""}最终分 ${getOptionScore(node)} / 基础分 ${node.base_score}`;
  }

  return TYPE_LABELS[node.type];
}

function isCurrentRecommendedOption(optionNode, nodeMap, viewId) {
  const practiceNode = optionNode.practice ? nodeMap.get(optionNode.practice) : null;
  return practiceNode ? resolveRecommendedOptionId(practiceNode, viewId) === optionNode.id : false;
}

function isOptionRecommended(option) {
  const practice = option.practice
    ? state.graph.nodes.find((node) => node.id === option.practice)
    : null;
  return practice ? resolveRecommendedOptionId(practice, state.viewId) === option.id : false;
}

function buildOptionRecommendationText(option) {
  return isOptionRecommended(option)
    ? "当前视角下，这个方案会作为实践的默认推荐方案显示。"
    : "当前视角下，这个方案仍保留为候选方案，用于横向比较。";
}

function findRelatedPractices(node, nodeMap) {
  return state.graph.nodes.filter((practice) => {
    if (practice.type !== "practice") {
      return false;
    }

    if (practice.id === node.practice) {
      return true;
    }

    if (practice.contexts?.includes(node.id)) {
      return true;
    }

    if (practice.constraints?.includes(node.id)) {
      return true;
    }

    if (practice.rules?.includes(node.id)) {
      return true;
    }

    return false;
  });
}

function findAnchorPracticeId(node, nodeMap) {
  if (node.practice) {
    return node.practice;
  }

  const neighborIds = node.neighbor_ids || [];
  const practiceNeighbor = neighborIds.find((neighborId) => nodeMap.get(neighborId)?.type === "practice");
  return practiceNeighbor || nodeMap.values().next().value?.id || null;
}

function hashString(value) {
  let hash = 0;
  for (const character of String(value)) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  return hash;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function formatSignedNumber(value) {
  const numericValue = Number(value || 0);
  if (numericValue > 0) {
    return `+${numericValue}`;
  }
  return String(numericValue);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

const TYPE_LABELS = {
  practice: "实践",
  option: "方案",
  context: "场景",
  constraint: "约束",
  rule: "规则",
  project_profile: "项目画像"
};

const SCORE_LABELS = {
  consistency: "一致性",
  efficiency: "开发效率",
  maintainability: "可维护性",
  extensibility: "扩展性",
  risk: "风险"
};
