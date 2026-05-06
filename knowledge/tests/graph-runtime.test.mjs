import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCanvasSnapshot,
  collectFocusNodeIds,
  collectVisibleGraphItems,
  resolveRecommendedOptionId
} from "../graph/graph-runtime.mjs";

const sampleGraph = {
  nodes: [
    {
      id: "practice-http-client",
      type: "practice",
      title: "HTTP 调用封装实践",
      summary: "统一封装远程调用。",
      contexts: ["context-frontend-crud"],
      constraints: ["constraint-auditability"],
      rules: [],
      keywords: ["api", "client"],
      tech: ["http"],
      option_ids: ["option-unified-client", "option-direct-call"],
      ranked_option_ids: {
        global: ["option-unified-client", "option-direct-call"],
        "project-example-enterprise-web": ["option-unified-client", "option-direct-call"]
      },
      recommended_options: {
        global: "option-unified-client",
        "project-example-enterprise-web": "option-unified-client"
      },
      neighbor_ids: [
        "context-frontend-crud",
        "constraint-auditability",
        "option-unified-client",
        "option-direct-call"
      ]
    },
    {
      id: "practice-logging",
      type: "practice",
      title: "日志记录策略实践",
      summary: "结构化日志优先。",
      contexts: ["context-backend-api"],
      constraints: ["constraint-auditability"],
      rules: [],
      keywords: ["logging"],
      tech: ["trace"],
      option_ids: ["option-structured-logging", "option-plain-logging"],
      ranked_option_ids: {
        global: ["option-structured-logging", "option-plain-logging"],
        "project-example-enterprise-web": ["option-structured-logging", "option-plain-logging"]
      },
      recommended_options: {
        global: "option-structured-logging",
        "project-example-enterprise-web": "option-structured-logging"
      },
      neighbor_ids: [
        "context-backend-api",
        "constraint-auditability",
        "option-structured-logging",
        "option-plain-logging"
      ]
    },
    {
      id: "option-unified-client",
      type: "option",
      title: "统一调用封装层",
      summary: "统一 Client 承载横切逻辑。",
      practice: "practice-http-client",
      neighbor_ids: ["practice-http-client", "option-direct-call"],
      current_score: 89,
      final_scores: {
        global: 89,
        "project-example-enterprise-web": 99
      }
    },
    {
      id: "option-direct-call",
      type: "option",
      title: "直接原生调用",
      summary: "各模块直接请求。",
      practice: "practice-http-client",
      neighbor_ids: ["practice-http-client", "option-unified-client"],
      current_score: 68,
      final_scores: {
        global: 68,
        "project-example-enterprise-web": 56
      }
    },
    {
      id: "option-structured-logging",
      type: "option",
      title: "结构化日志",
      summary: "保留稳定字段。",
      practice: "practice-logging",
      neighbor_ids: ["practice-logging", "option-plain-logging"],
      current_score: 90,
      final_scores: {
        global: 90,
        "project-example-enterprise-web": 102
      }
    },
    {
      id: "option-plain-logging",
      type: "option",
      title: "纯文本日志",
      summary: "输出自由文本。",
      practice: "practice-logging",
      neighbor_ids: ["practice-logging", "option-structured-logging"],
      current_score: 62,
      final_scores: {
        global: 62,
        "project-example-enterprise-web": 52
      }
    },
    {
      id: "context-frontend-crud",
      type: "context",
      title: "前端 CRUD 与交互页面",
      summary: "前端页面场景。",
      neighbor_ids: ["practice-http-client"]
    },
    {
      id: "context-backend-api",
      type: "context",
      title: "后端 API 与服务编排",
      summary: "后端服务场景。",
      neighbor_ids: ["practice-logging"]
    },
    {
      id: "constraint-auditability",
      type: "constraint",
      title: "必须可审计",
      summary: "要求关键行为可追踪。",
      neighbor_ids: ["practice-http-client", "practice-logging"]
    }
  ],
  edges: [
    { id: "has_option:practice-http-client->option-unified-client", from: "practice-http-client", to: "option-unified-client", type: "has_option" },
    { id: "has_option:practice-http-client->option-direct-call", from: "practice-http-client", to: "option-direct-call", type: "has_option" },
    { id: "has_option:practice-logging->option-structured-logging", from: "practice-logging", to: "option-structured-logging", type: "has_option" },
    { id: "has_option:practice-logging->option-plain-logging", from: "practice-logging", to: "option-plain-logging", type: "has_option" }
  ]
};

test("resolveRecommendedOptionId 按项目视角选出当前推荐方案", () => {
  const practice = sampleGraph.nodes.find((node) => node.id === "practice-http-client");

  assert.equal(resolveRecommendedOptionId(practice, "global"), "option-unified-client");
  assert.equal(
    resolveRecommendedOptionId(practice, "project-example-enterprise-web"),
    "option-unified-client"
  );
});

test("collectFocusNodeIds 返回当前节点和一阶邻居", () => {
  const focusIds = collectFocusNodeIds(sampleGraph, "practice-http-client");

  assert.deepEqual(Array.from(focusIds).sort(), [
    "constraint-auditability",
    "context-frontend-crud",
    "option-direct-call",
    "option-unified-client",
    "practice-http-client"
  ]);
});

test("collectVisibleGraphItems 按搜索和筛选返回可见节点", () => {
  const visible = collectVisibleGraphItems(sampleGraph, {
    viewId: "global",
    query: "日志"
  });

  assert.deepEqual(
    visible.nodes.map((node) => node.id),
    ["practice-logging", "option-structured-logging"]
  );
  assert.deepEqual(
    visible.edges.map((edge) => edge.id),
    ["has_option:practice-logging->option-structured-logging"]
  );
});

test("buildCanvasSnapshot 默认只展示 Practice + 推荐 Option，选中后补进邻居", () => {
  const initialSnapshot = buildCanvasSnapshot(sampleGraph, {
    viewId: "global",
    query: "",
    focusedNodeId: null
  });

  assert.deepEqual(
    initialSnapshot.nodes.map((node) => node.id),
    [
      "practice-http-client",
      "option-unified-client",
      "practice-logging",
      "option-structured-logging"
    ]
  );

  const focusedSnapshot = buildCanvasSnapshot(sampleGraph, {
    viewId: "global",
    query: "",
    focusedNodeId: "practice-http-client"
  });

  assert.deepEqual(
    focusedSnapshot.nodes.map((node) => node.id).sort(),
    [
      "constraint-auditability",
      "context-frontend-crud",
      "option-direct-call",
      "option-unified-client",
      "practice-http-client"
    ].sort()
  );
});
