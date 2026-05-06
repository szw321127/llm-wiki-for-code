import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { buildCanvasSnapshot } from "../assets/graph/graph-runtime.mjs";
import {
  buildEvidencePreview,
  shortenEvidencePath
} from "../assets/graph/evidence-format.mjs";
import {
  layoutNodeLabel
} from "../assets/graph/node-label-layout.mjs";

const root = path.resolve(".");
const html = fs.readFileSync(path.join(root, "assets", "graph", "knowledge-graph.html"), "utf8");
const css = fs.readFileSync(path.join(root, "assets", "graph", "knowledge-graph.css"), "utf8");
const js = fs.readFileSync(path.join(root, "assets", "graph", "knowledge-graph.js"), "utf8");

const sampleRuntimeGraph = {
  nodes: [
    {
      id: "project-profile-sample-web",
      type: "project_profile",
      title: "示例 Web 项目画像",
      summary: "作为当前项目的上下文入口。",
      tech: ["Vue", "Vite"],
      neighbor_ids: ["rule-use-unified-client", "option-unified-client"]
    },
    {
      id: "practice-config-management",
      type: "practice",
      title: "配置管理实践",
      summary: "配置应优先收敛到集中入口。",
      contexts: [],
      constraints: [],
      rules: [],
      option_ids: ["option-centralized-config", "option-inline-config"],
      ranked_option_ids: {
        global: ["option-centralized-config", "option-inline-config"]
      },
      recommended_options: {
        global: "option-centralized-config"
      },
      neighbor_ids: [
        "option-centralized-config",
        "option-inline-config",
        "context-admin-console"
      ]
    },
    {
      id: "practice-api-client",
      type: "practice",
      title: "接口客户端实践",
      summary: "项目调用后端接口应统一收敛。",
      contexts: [],
      constraints: [],
      rules: ["rule-use-unified-client"],
      option_ids: ["option-unified-client", "option-direct-call"],
      ranked_option_ids: {
        global: ["option-unified-client", "option-direct-call"]
      },
      recommended_options: {
        global: "option-unified-client"
      },
      neighbor_ids: ["option-unified-client", "option-direct-call", "rule-use-unified-client"]
    },
    {
      id: "option-centralized-config",
      type: "option",
      title: "集中配置入口",
      summary: "集中管理配置读取。",
      practice: "practice-config-management",
      neighbor_ids: ["practice-config-management"],
      base_score: 84
    },
    {
      id: "option-inline-config",
      type: "option",
      title: "内联配置",
      summary: "在调用点直接读取配置。",
      practice: "practice-config-management",
      neighbor_ids: ["practice-config-management"],
      base_score: 48
    },
    {
      id: "option-unified-client",
      type: "option",
      title: "统一客户端",
      summary: "通过统一客户端封装接口请求。",
      practice: "practice-api-client",
      neighbor_ids: ["practice-api-client", "project-profile-sample-web"],
      base_score: 88
    },
    {
      id: "option-direct-call",
      type: "option",
      title: "直接调用",
      summary: "在调用点直接发请求。",
      practice: "practice-api-client",
      neighbor_ids: ["practice-api-client"],
      base_score: 42
    },
    {
      id: "context-admin-console",
      type: "context",
      title: "后台管理场景",
      summary: "适用于后台管理端页面。",
      neighbor_ids: ["practice-config-management"]
    },
    {
      id: "rule-use-unified-client",
      type: "rule",
      title: "统一客户端规则",
      summary: "接口请求统一经由客户端封装。",
      neighbor_ids: ["project-profile-sample-web", "practice-api-client"]
    }
  ],
  edges: [
    {
      id: "has_option:practice-config-management->option-centralized-config",
      from: "practice-config-management",
      to: "option-centralized-config",
      type: "has_option"
    },
    {
      id: "has_option:practice-config-management->option-inline-config",
      from: "practice-config-management",
      to: "option-inline-config",
      type: "has_option"
    },
    {
      id: "has_option:practice-api-client->option-unified-client",
      from: "practice-api-client",
      to: "option-unified-client",
      type: "has_option"
    },
    {
      id: "has_option:practice-api-client->option-direct-call",
      from: "practice-api-client",
      to: "option-direct-call",
      type: "has_option"
    },
    {
      id: "supports:practice-config-management->context-admin-console",
      from: "practice-config-management",
      to: "context-admin-console",
      type: "supports"
    },
    {
      id: "follows:practice-api-client->rule-use-unified-client",
      from: "practice-api-client",
      to: "rule-use-unified-client",
      type: "follows"
    },
    {
      id: "prefers:project-profile-sample-web->option-unified-client",
      from: "project-profile-sample-web",
      to: "option-unified-client",
      type: "prefers"
    },
    {
      id: "adopts:project-profile-sample-web->rule-use-unified-client",
      from: "project-profile-sample-web",
      to: "rule-use-unified-client",
      type: "adopts"
    }
  ]
};

test("project graph shell removes top controls and keeps only graph plus details", () => {
  assert.doesNotMatch(html, /class="topbar panel"/);
  assert.doesNotMatch(html, /id="project-view"/);
  assert.doesNotMatch(html, /id="context-filter"/);
  assert.doesNotMatch(html, /id="constraint-filter"/);
  assert.doesNotMatch(html, /id="type-filters"/);
  assert.doesNotMatch(html, /id="incubating-toggle"/);
  assert.doesNotMatch(html, /id="adopted-toggle"/);
  assert.doesNotMatch(html, /id="reset-filters"/);
  assert.doesNotMatch(html, /id="filter-toggle"/);
  assert.doesNotMatch(html, /id="filter-panel"/);
  assert.match(html, /class="graph-panel-head"[\s\S]*id="search-input"/);
  assert.match(html, /class="detail-panel detail-panel-column"/);
  assert.match(html, /class="detail-reading panel"/);
  assert.match(html, /id="detail-reading-panel"/);
  assert.match(css, /\.graph-panel-head/);
  assert.match(css, /\.graph-panel-search/);
  assert.match(css, /\.detail-panel-column/);
  assert.match(css, /\.detail-reading/);
  assert.match(css, /\.detail-reading-grid/);
  assert.match(css, /\.maturity-incubating/);
});

test("project graph shell keeps maturity and evidence strings", () => {
  assert.match(js, /成熟度/);
  assert.match(js, /采用次数/);
  assert.match(js, /最近采用/);
  assert.match(js, /source_evidence/);
});

test("evidence formatter shortens long file paths and preserves short paths", () => {
  assert.equal(
    shortenEvidencePath(
      ".worktrees/feat-shein-batch-template/src/views/customerService/ebay/ebayAutoOffer/config.ts"
    ),
    ".../src/views/customerService/ebay/ebayAutoOffer/config.ts"
  );
  assert.equal(
    shortenEvidencePath("practices/practice-config-management.md"),
    "practices/practice-config-management.md"
  );
});

test("evidence formatter keeps only a preview window and exposes overflow items", () => {
  const preview = buildEvidencePreview([
    ".worktrees/feat-shein-batch-template/src/views/customerService/ebay/ebayAutoOffer/config.ts",
    ".worktrees/feat-shein-batch-template/src/views/customerService/ebay/ebayBestOffer/config.ts",
    ".worktrees/feat-shein-batch-template/src/views/customerService/ebay/ebayCancel/config.ts",
    ".worktrees/feat-shein-batch-template/src/views/customerService/ebay/ebayDispute/config.ts",
    ".worktrees/feat-shein-batch-template/src/views/customerService/ebay/ebayFeedback/config.ts",
    ".worktrees/feat-shein-batch-template/src/views/customerService/ebay/ebayMessage/config.ts",
    ".worktrees/feat-shein-batch-template/src/views/customerService/ebay/ebayRefund/config.ts"
  ]);

  assert.equal(preview.visibleItems.length, 5);
  assert.equal(preview.hiddenItems.length, 2);
  assert.equal(preview.hiddenCount, 2);
  assert.equal(preview.visibleItems[0].display, ".../src/views/customerService/ebay/ebayAutoOffer/config.ts");
  assert.equal(preview.hiddenItems[1].display, ".../src/views/customerService/ebay/ebayRefund/config.ts");
});

test("project graph shell wires focus filtering through canvas and detail interactions", () => {
  assert.match(js, /focusedNodeId:\s*null/);
  assert.doesNotMatch(js, /projectView:\s*document\.querySelector\("#project-view"\)/);
  assert.doesNotMatch(js, /contextFilter:\s*document\.querySelector\("#context-filter"\)/);
  assert.doesNotMatch(js, /constraintFilter:\s*document\.querySelector\("#constraint-filter"\)/);
  assert.doesNotMatch(js, /incubatingToggle:\s*document\.querySelector\("#incubating-toggle"\)/);
  assert.doesNotMatch(js, /adoptedToggle:\s*document\.querySelector\("#adopted-toggle"\)/);
  assert.doesNotMatch(js, /resetFilters:\s*document\.querySelector\("#reset-filters"\)/);
  assert.match(js, /state\.focusedNodeId\s*=\s*nodeElement\.dataset\.nodeId/);
  assert.match(js, /state\.selectedNodeId\s*=\s*nodeElement\.dataset\.nodeId/);
  assert.match(js, /state\.focusedNodeId\s*=\s*button\.dataset\.nodeId/);
  assert.match(js, /state\.selectedNodeId\s*=\s*button\.dataset\.nodeId/);
  assert.match(js, /if\s*\(!nodeElement\)\s*{\s*state\.focusedNodeId\s*=\s*null;/);
  assert.doesNotMatch(js, /onCanvasClick[\s\S]*state\.selectedNodeId\s*=\s*null/);
  assert.match(js, /点击空白画布恢复默认视图/);
  assert.match(js, /默认视图展示项目画像、实践与推荐方案/);
  assert.doesNotMatch(js, /setPointerCapture\?\.\(event\.pointerId\)/);
});

test("project graph shell exposes graph-header search hooks", () => {
  assert.match(html, /class="graph-panel-head"[\s\S]*class="graph-panel-search"/);
  assert.match(html, /id="search-input"/);
  assert.match(css, /\.graph-panel-search/);
  assert.match(css, /\.graph-panel-tools/);
});

test("project graph shell wraps long node labels inside fixed node surfaces", () => {
  const label = layoutNodeLabel("自动同步任务使用全局调度器", {
    maxWidth: 126,
    maxLines: 2
  });
  const overflowingLabel = layoutNodeLabel("自动同步任务使用全局调度器并记录失败重试状态", {
    maxWidth: 126,
    maxLines: 2
  });

  assert.equal(label.lines.length, 2);
  assert.equal(label.truncated, false);
  assert.ok(label.lines.every((line) => line.estimatedWidth <= 126));
  assert.equal(overflowingLabel.truncated, true);
  assert.ok(overflowingLabel.lines.every((line) => line.estimatedWidth <= 126));
  assert.match(overflowingLabel.lines.at(-1).text, /\.\.\.$/);
  assert.match(js, /renderNodeLabelText/);
  assert.match(js, /layoutNodeLabel/);
  assert.match(js, /<tspan/);
});

test("project graph shell removes stale top-control style hooks", () => {
  assert.doesNotMatch(css, /\.topbar\b/);
  assert.doesNotMatch(css, /\.topbar-head/);
  assert.doesNotMatch(css, /\.topbar-note/);
  assert.doesNotMatch(css, /\.toolbar-compact/);
  assert.doesNotMatch(css, /\.toolbar-primary/);
  assert.doesNotMatch(css, /\.toolbar-secondary/);
  assert.doesNotMatch(css, /\.toolbar-filter-toggle/);
  assert.doesNotMatch(css, /\.filter-panel/);
  assert.doesNotMatch(css, /\.field-toggle/);
  assert.doesNotMatch(css, /\.type-toggle-group/);
  assert.doesNotMatch(css, /\.type-toggle-pill/);
});

test("project graph shell promotes project profile into the canvas model", () => {
  assert.match(js, /项目上下文入口/);
  assert.match(js, /node-project-profile/);
  assert.match(css, /\.node-project-profile/);
  assert.doesNotMatch(js, /renderProjectSummary/);
  assert.doesNotMatch(js, /projectSummaryTitle/);
  assert.doesNotMatch(js, /projectSummaryTech/);
  assert.doesNotMatch(js, /projectSummaryStable/);
  assert.doesNotMatch(js, /projectSummaryIncubating/);
});

test("project graph shell renders unified single-column detail blocks", () => {
  assert.match(js, /detail-block detail-header-block/);
  assert.match(js, /detail-block detail-facts-block/);
  assert.match(js, /detail-block detail-relations-block/);
  assert.match(js, /detail-block detail-body-block/);
  assert.match(js, /detail-block detail-evidence-block/);
  assert.match(js, /renderEvidenceCollection/);
  assert.match(js, /还有 \$\{preview\.hiddenCount\} 项/);
  assert.match(js, /markdown-evidence-section/);
  assert.match(js, /isEvidenceSection\(currentSection\.title\)\s*&&\s*isPathLikeEvidence\(trimmed\)/);
  assert.match(js, /detailReadingPanel:\s*document\.querySelector\("#detail-reading-panel"\)/);
  assert.match(js, /elements\.detailReadingPanel\.innerHTML\s*=\s*`\s*\$\{renderDetailBodyBlock\(node\)\}\s*\$\{renderDetailEvidenceBlock\(node\)\}\s*`/);
  assert.match(js, /elements\.detailPanel\.innerHTML\s*=\s*`\s*\$\{renderDetailHeaderBlock\(node,\s*nodeMap\)\}\s*\$\{renderDetailGovernanceBlock\(node\)\}\s*\$\{renderDetailFactsBlock\(node,\s*nodeMap\)\}\s*\$\{renderDetailRelationsBlock\(node,\s*nodeMap\)\}\s*`/);
  assert.match(css, /\.detail-block/);
  assert.match(css, /\.detail-header-block/);
  assert.match(css, /\.detail-facts-grid/);
  assert.match(css, /\.detail-evidence-list/);
  assert.match(css, /\.evidence-preview-list/);
  assert.match(css, /\.evidence-more/);
  assert.match(css, /\.markdown-evidence-section/);
  assert.doesNotMatch(html, /id="detail-panel"[\s\S]*detail-body-block/);
  assert.doesNotMatch(html, /id="detail-panel"[\s\S]*detail-evidence-block/);
  assert.doesNotMatch(js, /detail-stage/);
  assert.doesNotMatch(js, /detail-score-hero/);
  assert.doesNotMatch(js, /score-hero-primary/);
});

test("project graph shell exposes governance rejection actions", () => {
  assert.match(js, /renderDetailGovernanceBlock/);
  assert.match(js, /data-governance-action="reject"/);
  assert.match(js, /\/api\/governance\/reject/);
  assert.match(js, /reloadGraphData/);
  assert.match(css, /\.governance-action-row/);
  assert.match(css, /\.governance-button/);
});

test("project graph runtime keeps project profile, practices, and recommended options in the default snapshot", () => {
  const snapshot = buildCanvasSnapshot(sampleRuntimeGraph, {
    viewId: "global",
    query: "",
    focusedNodeId: null
  });

  assert.deepEqual(snapshot.nodes.map((node) => node.id), [
    "project-profile-sample-web",
    "practice-config-management",
    "option-centralized-config",
    "practice-api-client",
    "option-unified-client"
  ]);
});

test("project graph runtime narrows a focused practice to first-degree neighbors", () => {
  const snapshot = buildCanvasSnapshot(sampleRuntimeGraph, {
    viewId: "global",
    query: "",
    focusedNodeId: "practice-config-management"
  });

  assert.deepEqual(
    snapshot.nodes.map((node) => node.id).sort(),
    [
      "context-admin-console",
      "option-centralized-config",
      "option-inline-config",
      "practice-config-management"
    ].sort()
  );
});

test("project graph runtime preserves the owning practice when focusing an option", () => {
  const snapshot = buildCanvasSnapshot(sampleRuntimeGraph, {
    viewId: "global",
    query: "",
    focusedNodeId: "option-inline-config"
  });

  assert.deepEqual(
    snapshot.nodes.map((node) => node.id).sort(),
    ["option-inline-config", "practice-config-management"].sort()
  );
});

test("project graph runtime preserves direct project links when focusing project profile", () => {
  const snapshot = buildCanvasSnapshot(sampleRuntimeGraph, {
    viewId: "global",
    query: "",
    focusedNodeId: "project-profile-sample-web"
  });

  assert.deepEqual(
    snapshot.nodes.map((node) => node.id).sort(),
    ["option-unified-client", "project-profile-sample-web", "rule-use-unified-client"].sort()
  );
});

test("project graph runtime applies search only inside the active snapshot", () => {
  const defaultSnapshot = buildCanvasSnapshot(sampleRuntimeGraph, {
    viewId: "global",
    query: "统一客户端",
    focusedNodeId: null
  });
  const focusedSnapshot = buildCanvasSnapshot(sampleRuntimeGraph, {
    viewId: "global",
    query: "统一客户端",
    focusedNodeId: "practice-config-management"
  });

  assert.deepEqual(defaultSnapshot.nodes.map((node) => node.id), ["option-unified-client"]);
  assert.deepEqual(focusedSnapshot.nodes.map((node) => node.id), []);
});
